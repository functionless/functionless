import { Project } from "./project";
import {
  App,
  aws_apigateway,
  aws_lambda,
  aws_stepfunctions,
  CfnElement,
  NestedStack,
  Stack,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  ExpressStepFunction,
  ExpressStepFunctionKind,
  isEventBus,
  isExpressStepFunction,
  isLambdaFunction,
  isMethod,
  isRestApi,
  isStepFunction,
  isTableDecl,
  LambdaFunction,
  LambdaFunctionKind,
  StepFunction,
} from "./interface";
import {
  ASL,
  FunctionlessNode,
  inferIamPolicies,
  isReferenceExpr,
  reflect,
  validateFunctionLike,
} from "@functionless/aws-constructs";
import * as functionless from "@functionless/aws-constructs";
import { forEachChild } from "@functionless/aws-constructs/lib/visit";
import { logicalIdForPath } from "./logical-id";
import { bundleLambdaFunction, getBundleOutFolder } from "./bundle-lambda";
import { getEnvironmentVariableName } from "./util";
import { Tree } from "./tree/tree";
import { isFile, File } from "./tree/file";
import { isFolder } from "./tree/folder";

export class FunctionlessStack extends Stack {
  protected allocateLogicalId(cfnElement: CfnElement): string {
    return logicalIdForPath(cfnElement.node.path);
  }
}

export class FunctionlessNestedStack extends NestedStack {
  protected allocateLogicalId(cfnElement: CfnElement): string {
    return logicalIdForPath(cfnElement.node.path);
  }
}

export async function synthesizeProject(project: Project): Promise<void> {
  functionless.registerSubstitution(
    StepFunction.waitSeconds,
    functionless.$SFN.waitFor
  );

  const app = new App({
    autoSynth: false,
  });
  const rootStack = new FunctionlessStack(app, project.projectName);

  await constructProject();
  connectProject(project, app);

  app.synth();

  async function constructProject() {
    for (const file of project.module.files) {
      if (isFolder(file) && file._stack) {
        await synthesizeNode(app, file, undefined);
      } else {
        await synthesizeNode(rootStack, file, undefined);
      }
    }
  }

  async function synthesizeNode(
    scope: Construct,
    node: Tree,
    ctx: Construct | undefined,
    overrideId?: string
  ): Promise<Construct> {
    if (isFile(node)) {
      return synthesizeResource(scope, overrideId ?? node.name, node, ctx);
    } else {
      if (node._stack) {
        if (node.isSrcRoot) {
          // Folders containing `_stack.ts` in a top-level folder are considered top-level stacks
          // src/my-stack/_stack.ts => `my-stack` is a top-level stack
          scope = new FunctionlessStack(app, overrideId ?? node.name);
        } else {
          // src/my-stack/_stack.ts
          //             /nested-stack/_stack.ts => `nested-stack` is nested within `my-stack`.
          scope = new FunctionlessNestedStack(app, overrideId ?? node.name);
        }
      } else {
        // create a Construct to represent the Folder's scope
        scope = new Construct(scope, overrideId ?? node.name);
      }

      if (node._api) {
        // if this folder marks the beginning of a new RestApi, then instantiate the
        // RestApi Resource and set it as the surrounding scope and context of all children nodes.
        ctx = await synthesizeNode(scope, node._api, ctx);
      }

      const children = node.files.filter(
        (file) => !["_api", "_stack"].includes(file.name)
      );

      // synthesize all nodes that are not the `_stack` or `_api` special nodes
      for (const child of children) {
        await synthesizeNode(scope, child, ctx);
      }
      return scope;
    }
  }

  async function synthesizeResource(
    scope: Construct,
    id: string,
    file: File,
    ctx: Construct | undefined
  ): Promise<Construct> {
    const construct = await _synthesizeResource(scope, id, file, ctx);
    if (construct instanceof Construct) {
      return construct;
    } else {
      functionless.registerSubstitution(file.resource, construct);
      // @ts-ignore
      return construct.resource;
    }
  }

  async function _synthesizeResource(
    scope: Construct,
    id: string,
    file: File,
    ctx: Construct | undefined
  ): Promise<SynthesizedResource> {
    if (isLambdaFunction(file.resource)) {
      const outFolder = getBundleOutFolder(id);
      await bundleLambdaFunction(project, file.filePath, outFolder);

      const func = new aws_lambda.Function(scope, id, {
        runtime: aws_lambda.Runtime.NODEJS_16_X,
        handler: "index.default",
        code: aws_lambda.Code.fromAsset(outFolder),
        environment: {
          NODE_OPTIONS: "--enable-source-maps",
        },
      });
      func.addEnvironment("RESOURCE_ID", func.node.path);
      return functionless.Function.fromFunction(func);
    } else if (isStepFunction(file.resource)) {
      return functionless.StepFunction.fromStateMachine(
        new aws_stepfunctions.StateMachine(scope, id, {
          ...file.resource.props,
          stateMachineType: aws_stepfunctions.StateMachineType.STANDARD,
          definition: new aws_stepfunctions.Pass(scope, "dummy"),
        })
      );
    } else if (isExpressStepFunction(file.resource)) {
      return functionless.ExpressStepFunction.fromStateMachine(
        new aws_stepfunctions.StateMachine(scope, id, {
          ...file.resource.props,
          stateMachineType: aws_stepfunctions.StateMachineType.EXPRESS,
          definition: new aws_stepfunctions.Pass(scope, "dummy"),
        })
      );
    } else if (isTableDecl(file.resource)) {
      return new functionless.Table(scope, id, file.resource.props);
      ``;
    } else if (isEventBus(file.resource)) {
      return new functionless.EventBus(scope, id, file.resource.props);
      ``;
    } else if (isRestApi(file.resource)) {
      return new aws_apigateway.RestApi(scope, id, file.resource.props);
      ``;
    } else if (isMethod(file.resource)) {
      if (!(ctx instanceof aws_apigateway.RestApi)) {
        throw new Error(
          `cannot synthesize a Method outside the scope of a RestApi`
        );
      }
      const api = ctx as any as aws_apigateway.RestApi;

      const handler = await synthesizeResource(
        scope,
        id,
        new File({
          ...file,
          resource: file.resource.handler,
        }),
        api
      );

      const resourcePath = formatResourcePath(api, handler);

      if (
        !(
          isLambdaFunction(file.resource.handler) ||
          isExpressStepFunction(file.resource.handler)
        )
      ) {
        throw new Error(
          `Method handler must be a ${LambdaFunctionKind} or ${ExpressStepFunctionKind}, but was ${file.resource.handler.kind}`
        );
      }

      return api.root
        .resourceForPath(resourcePath)
        .addMethod(
          file.resource.props.httpMethod,
          isLambdaFunction(file.resource.handler)
            ? new aws_apigateway.LambdaIntegration(handler as any)
            : aws_apigateway.StepFunctionsIntegration.startExecution(
                handler as any
              )
        );
    }

    throw new Error(`Resource not yet implemented: ${file.resource}`);
  }
}

export type SynthesizedResource =
  | functionless.StepFunction<any, any>
  | functionless.IStepFunction<any, any>
  | functionless.ExpressStepFunction<any, any>
  | functionless.IExpressStepFunction<any, any>
  | functionless.Function<any, any>
  | functionless.Table<any, any, any>
  | functionless.EventBus<any>
  | Construct;

function formatResourcePath(
  apiConstruct: aws_apigateway.IRestApi,
  handlerConstruct: Construct
) {
  const apiPath = apiConstruct.node.scope?.node.path;

  if (!apiPath) {
    throw new Error("Expected a node path but found none.");
  }

  const handlerPath = handlerConstruct.node.scope?.node.path;

  if (!handlerPath) {
    throw new Error("Expected a node path but found none.");
  }

  if (!handlerPath.startsWith(apiPath)) {
    throw new Error("Api and handler don't share a common root.");
  }

  const relativePath = handlerPath.replace(apiPath, "");

  return relativePath.replace(/\[/g, "{").replace(/\]/g, "}");
}

function synthesizeStepFunctionDefinition(
  resource: StepFunction | ExpressStepFunction,
  machine: aws_stepfunctions.StateMachine
) {
  const decl = validateFunctionLike(resource.handler, resource.kind);

  try {
    const definition = new ASL(machine, machine.role, decl).definition;

    const resource = machine.node.findChild(
      "Resource"
    ) as aws_stepfunctions.CfnStateMachine;

    resource.definitionString = Stack.of(resource).toJsonString(definition);

    return [definition, machine];
  } finally {
    // remove the dummy pass node because we don't need it.
    machine.node.tryRemoveChild("dummy");
  }
}

function synthesizeLambdaEnvironment(
  resource: LambdaFunction,
  lambdaFunction: aws_lambda.Function
) {
  const ast = validateFunctionLike(resource.handler, resource.kind);

  inferIamPolicies(ast, lambdaFunction);

  const seen = new Set();
  forEachChild(ast, function visit(node: FunctionlessNode): void {
    if (isReferenceExpr(node)) {
      let ref: any = node.ref();
      if (typeof ref === "function") {
        if (!seen.has(ref)) {
          seen.add(ref);
          const ast = reflect(ref);
          if (ast) {
            visit(ast);
          }
        }
      } else {
        let resource = ref;
        if (resource?.__esModule === true && "default" in resource) {
          resource = ref.default;
        }
        const construct = functionless.resolveSubstitution(resource);
        if (
          functionless.isTable(construct) ||
          functionless.isFunction(construct) ||
          functionless.isStepFunction(construct)
        ) {
          if (construct && !seen.has(construct)) {
            const resourceID = construct.resource.node.path;
            if (resourceID === undefined) {
              console.error(`Could not look up Resource ID`, ref);
              throw new Error(`Could not look up Resource ID`);
            }
            seen.add(construct);
            const envKey = getEnvironmentVariableName(resourceID);
            if (functionless.isTable(construct)) {
              const table = construct.resource;
              lambdaFunction.addEnvironment(`${envKey}_NAME`, table.tableName);
              lambdaFunction.addEnvironment(`${envKey}_ARN`, table.tableArn);
              lambdaFunction.addEnvironment("TODO", "TODO");
            } else if (functionless.isFunction(construct)) {
              const func = construct.resource;
              lambdaFunction.addEnvironment(
                `${envKey}_NAME`,
                func.functionName
              );
              lambdaFunction.addEnvironment(`${envKey}_ARN`, func.functionArn);
            } else if (functionless.isStepFunction(construct)) {
              const machine = construct.resource;
              lambdaFunction.addEnvironment(
                `${envKey}_NAME`,
                machine.stateMachineName
              );
              lambdaFunction.addEnvironment(
                `${envKey}_ARN`,
                machine.stateMachineArn
              );
            }
          }
        }
      }
    }
    forEachChild(node, visit);
  });
}

function connectProject(project: Project, scope: Construct) {
  if (scope instanceof aws_stepfunctions.StateMachine) {
    const resource = project.lookupResource(scope.node.path).resource;
    if (
      isMethod(resource) &&
      (isStepFunction(resource.handler) ||
        isExpressStepFunction(resource.handler))
    ) {
      synthesizeStepFunctionDefinition(resource.handler, scope);
    } else if (isStepFunction(resource) || isExpressStepFunction(resource)) {
      synthesizeStepFunctionDefinition(resource, scope);
    }
  } else if (scope instanceof aws_lambda.Function) {
    const resource = project.lookupResource(scope.node.path).resource;
    if (isMethod(resource) && isLambdaFunction(resource.handler)) {
      synthesizeLambdaEnvironment(resource.handler, scope);
    } else if (isLambdaFunction(resource)) {
      synthesizeLambdaEnvironment(resource, scope);
    }
  }
  for (const child of scope.node.children) {
    connectProject(project, child);
  }
}
