import path from "path";
import express, { Router, Response } from "express";
import {
  ExpressStepFunction,
  isExpressStepFunction,
  isLambdaFunction,
  isMethod,
  isTableDecl,
  LambdaFunction,
  Resource,
  StepFunction,
} from "@functionless/aws-lib";
import { Project } from "./project";
import type {
  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyResult,
  APIGatewayProxyEvent,
} from "aws-lambda";
import http from "http";
import { bundleLambdaFunction, getBundleOutFolder } from "./bundle-lambda";
import { logicalIdForPath, resolveStackDetail } from "./logical-id";

import Lambda from "aws-sdk/clients/lambda";
import StepFunctions from "aws-sdk/clients/stepfunctions";
import STS from "aws-sdk/clients/sts";
import IAM from "aws-sdk/clients/iam";
import { isStepFunction } from "@functionless/aws-lib-constructs";
import { getClientProps } from "@functionless/aws-util";
import { getEnvironmentVariableName } from "@functionless/util";
import { Tree } from "./tree/tree";
import { isFile } from "./tree/file";

const lambda = new Lambda(getClientProps());
const stepFunctions = new StepFunctions(getClientProps());

const sts = new STS(getClientProps());

const iam = new IAM(getClientProps());

interface FunctionMetadata {
  roleArn: string;
  functionArn: string;
}

type LocalRunnableFunction =
  | LambdaFunction
  | StepFunction
  | ExpressStepFunction;

function isLocalRunnableFunction(
  resource: Resource
): resource is LocalRunnableFunction {
  return (
    isLambdaFunction(resource) ||
    isStepFunction(resource) ||
    isExpressStepFunction(resource)
  );
}

export async function localServeProject(project: Project): Promise<void> {
  const functionArns = new Map<LocalRunnableFunction, FunctionMetadata>();
  await Promise.all(
    Object.values(project.module.tree).map(async (file) => {
      await setEnvironment(file);
      (await getFunctionArns(file)).forEach(([func, functionArn]) =>
        functionArns.set(func, functionArn)
      );
    })
  );

  // eslint-disable-next-line turbo/no-undeclared-env-vars
  process.env.FL_LOCAL = "true";
  const app = express().use(express.json());
  Object.values(project.module.tree)
    .flatMap((stack) =>
      Object.values(stack).flatMap((resource) =>
        "_resource" in resource &&
        "kind" in resource._resource.resource &&
        resource._resource.resource.kind === "fl.RestApi"
          ? expandResourceTree(resource)
          : []
      )
    )
    .forEach((r) => route(project, app, "", "", r, functionArns));
  http.createServer(app).listen(3000);
  console.log("server running on port 3000");
}

async function setEnvironment(node: Tree) {
  if (isFile(node)) {
    if (isTableDecl(node.resource)) {
      const resourceId = node.address;
      const logicalId = logicalIdForPath(resourceId);
      const envKey = getEnvironmentVariableName(resourceId);

      const tableArn = (await resolveStackDetail(node.stackName, logicalId))
        ?.PhysicalResourceId!;

      const tableName = path.basename(tableArn);

      process.env[`${envKey}_NAME`] = tableName;
      process.env[`${envKey}_ARN`] = tableArn;
    }
  } else {
    await Promise.all(node.files.map(setEnvironment));
  }
}

async function getRoleArn(
  resource: LocalRunnableFunction,
  functionArn: string
) {
  if (isLambdaFunction(resource)) {
    const functionResponse = await lambda
      .getFunction({
        FunctionName: path.basename(functionArn),
      })
      .promise();

    return functionResponse.Configuration?.Role!;
  } else if (isStepFunction(resource) || isExpressStepFunction(resource)) {
    const response = await stepFunctions
      .describeStateMachine({ stateMachineArn: functionArn })
      .promise();
    return response.roleArn;
  }
  return undefined;
}

async function getFunctionArns(node: Tree): Promise<
  [
    LocalRunnableFunction,
    {
      roleArn: string;
      functionArn: string;
    }
  ][]
> {
  if (isFile(node)) {
    if (isMethod(node.resource)) {
      return getFunctionArns(node);
    } else if (isLocalRunnableFunction(node.resource)) {
      const logicalId = logicalIdForPath(node.address);

      const functionArn = (await resolveStackDetail(node.stackName, logicalId))
        ?.PhysicalResourceId!;

      const roleArn = await getRoleArn(node.resource, functionArn);
      if (!roleArn) {
        console.error(`Couldn't get role arn for ${functionArn}`);
        return [];
      }
      const roleName = path.basename(roleArn);

      const [role, whoami] = await Promise.all([
        iam
          .getRole({
            RoleName: roleName,
          })
          .promise(),
        sts.getCallerIdentity().promise(),
      ] as const);
      const assumeRolePolicyDocument: {
        Version: string;
        Statement: {
          Action: string;
          Effect: string;
          Principal: {
            Service?: string;
            AWS?: string;
          };
        }[];
      } = JSON.parse(decodeURIComponent(role.Role.AssumeRolePolicyDocument!));

      const existing = assumeRolePolicyDocument.Statement?.find(
        (stmt) => whoami.Arn && stmt.Principal.AWS === whoami.Arn
      );
      if (!existing) {
        assumeRolePolicyDocument.Statement.push({
          Action: "sts:AssumeRole",
          Effect: "Allow",
          Principal: {
            AWS: whoami.Arn,
          },
        });
        await iam
          .updateAssumeRolePolicy({
            RoleName: roleName,
            PolicyDocument: JSON.stringify(assumeRolePolicyDocument),
          })
          .promise();

        await (async function wait(waitTime: number) {
          try {
            await sts
              .assumeRole({
                RoleArn: roleArn,
                RoleSessionName: "FL_LOCAL",
              })
              .promise();
          } catch (err: any) {
            if (err.code === "AccessDenied") {
              console.log(`waiting ${waitTime}ms for Role`);
              await new Promise((resolve) => setTimeout(resolve, waitTime));
              await wait(Math.min(waitTime * 1.5, 10 * 1000));
            }
          }
        })(100);
      }

      return [
        [
          node.resource,
          {
            functionArn,
            roleArn,
          },
        ],
      ];
    }
    return [];
  } else {
    return (await Promise.all(node.files.map(getFunctionArns))).flat();
  }
}

function expandResourceTree(tree: Tree) {
  return Object.entries(tree).filter(([path]) => path != "_resource");
}

function expressifyPathSegment(segment: string) {
  return segment.replace(/\[(.*)\]/, ":$1");
}

async function route(
  project: Project,
  router: Router,
  id: string,
  path: string,
  [segment, resource]: [string, Tree],
  functionArns: Map<LocalRunnableFunction, FunctionMetadata>
) {
  if (isFile(resource)) {
    if (isMethod(resource.resource)) {
      if (isLocalRunnableFunction(resource.resource.handler)) {
        const isLambda = isLambdaFunction(resource.resource.handler);
        const method = resource.resource;
        const handlers = {
          GET: router.get,
          POST: router.post,
          PUT: router.put,
          DELETE: router.delete,
        };
        console.log(`${path} - ${method.props.httpMethod}`);
        const outFolder = getBundleOutFolder(`${id}_${segment}`);
        const bundle = await bundleLambdaFunction(
          project,
          resource.filePath,
          outFolder,
          functionArns.get(resource.resource.handler)?.roleArn
        );
        handlers[method.props.httpMethod as keyof typeof handlers].bind(router)(
          path,
          async (req, res) => {
            try {
              const { default: wrapper } = await import(bundle);

              const event = {
                body: JSON.stringify(req.body),
                headers: req.headers as any,
                httpMethod: req.method,
                path,
                queryStringParameters:
                  req.query as APIGatewayProxyEventQueryStringParameters,
                pathParameters: req.params,
              } as APIGatewayProxyEvent;
              if (isLambda) {
                const result: APIGatewayProxyResult = await wrapper(event);
                setExpressResult(res, result);
              } else {
                const result = await wrapper.handler.handler(event);
                setExpressResult(res, result);
              }
            } catch (e) {
              console.error(e);
            }
          }
        );
      }
    }
  } else {
    expandResourceTree(resource).forEach((r) =>
      route(
        project,
        router,
        `${id ? `${id}_` : ""}${r[0]}`,
        `${path}/${expressifyPathSegment(segment)}`,
        r,
        functionArns
      )
    );
  }
}
function setExpressResult(res: Response<any>, result: APIGatewayProxyResult) {
  res.status(result.statusCode);
  if (result.headers) {
    Object.entries(result.headers).forEach(([header, value]) => {
      res.header(header, value.toString());
    });
  }
  res.send(result.body);
}
