import express, { Router, Response } from "express";
import { Project } from "./project";
import type {
  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyResult,
  APIGatewayProxyEvent,
} from "aws-lambda";
import http from "http";
import { isStepFunction } from "@functionless/aws-stepfunctions";
import { isRestApi, isMethod, Method } from "@functionless/aws-apigateway";
import { isLambdaFunction, LambdaFunction } from "@functionless/aws-lambda";
import {
  ExpressStepFunction,
  isExpressStepFunction,
  StepFunction,
} from "@functionless/aws-stepfunctions";
import { Resource } from "./resource";
import { getResourceFiles } from "./tree/tree";
import { File } from "./tree/file";
import pMap from "p-map";
import { processLambdaFunction } from "./process-lambda";

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
  const app = express().use(express.json());
  const routeFiles = project.resourceFiles.flatMap((projectFile) =>
    isRestApi(projectFile.resource)
      ? projectFile.parent.files
          .flatMap(getResourceFiles)
          .flatMap((resourceFile) =>
            resourceFile.address !== projectFile.address &&
            isMethod(resourceFile.resource) &&
            isLocalRunnableFunction(resourceFile.resource.handler)
              ? [
                  {
                    apiFile: projectFile,
                    entryFile: resourceFile,
                    method: resourceFile.resource,
                    handler: resourceFile.resource.handler,
                  },
                ]
              : []
          )
      : []
  );

  await pMap(routeFiles, async (props) => route({ ...props, router: app }));
  http.createServer(app).listen(3000);
  console.log("server running on port 3000");
}

function expressifyPathSegment(segment: string) {
  return segment.replace(/\[(.*)\]/, ":$1");
}

async function route({
  apiFile,
  entryFile,
  method,
  handler,
  router,
}: {
  apiFile: File;
  entryFile: File;
  method: Method<object, APIGatewayProxyResult>;
  handler: LocalRunnableFunction;
  router: Router;
}) {
  const isLambda = isLambdaFunction(handler);
  const handlers = {
    GET: router.get,
    POST: router.post,
    PUT: router.put,
    DELETE: router.delete,
  };
  const fullPath = entryFile.address.slice(apiFile.address.length);
  const path = expressifyPathSegment(
    fullPath.slice(0, fullPath.lastIndexOf("/"))
  );
  const { bundleFolder, env } = await processLambdaFunction(entryFile, "local");
  console.log(`${path} - ${method.props.httpMethod}`);
  handlers[method.props.httpMethod as keyof typeof handlers].bind(router)(
    path,
    async (req, res) => {
      try {
        //Map over all resources in the env map, and pick out the ones mapped to this entry point
        const envs = await pMap(
          Object.values(env[entryFile.address] ?? {}),
          (materializeEnv) => materializeEnv({ functionTarget: "local" })
        );
        envs
          .flatMap((x) => Object.entries(x))
          .forEach(([k, v]) => {
            // eslint-disable-next-line turbo/no-undeclared-env-vars
            process.env[k] = v;
          });
        const { default: wrapper } = await import(bundleFolder);
        console.log(`Loaded - ${path} - ${method.props.httpMethod}`);
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

function setExpressResult(res: Response<any>, result: APIGatewayProxyResult) {
  res.status(result.statusCode);
  if (result.headers) {
    Object.entries(result.headers).forEach(([header, value]) => {
      res.header(header, value.toString());
    });
  }
  res.send(result.body);
}
