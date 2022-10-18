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

import { registerSubstitution, validateFunctionLike } from "@functionless/ast";
import { logicalIdForPath } from "./logical-id";
import { Tree } from "./tree/tree";
import { isFile, File } from "./tree/file";
import { isFolder } from "./tree/folder";

import { ASL } from "@functionless/asl";
import { isRestApi, isMethod, Method } from "@functionless/aws-apigateway";
import {
  isLambdaFunction,
  LambdaFunction,
  LambdaFunctionKind,
} from "@functionless/aws-lambda";
import { isTable } from "@functionless/aws-dynamodb";
import { Table } from "@functionless/aws-dynamodb-constructs";
import { isEventBus } from "@functionless/aws-events";
import { EventBus } from "@functionless/aws-events-constructs";
import {
  Function,
  inferIamPolicies,
} from "@functionless/aws-lambda-constructs";
import {
  StepFunction as StepFunctionConstruct,
  ExpressStepFunction as ExpressStepFunctionConstruct,
  $SFN,
  IStepFunction,
  IExpressStepFunction,
} from "@functionless/aws-stepfunctions-constructs";
import {
  ExpressStepFunction,
  ExpressStepFunctionKind,
  isExpressStepFunction,
  isStepFunction,
  StepFunction,
} from "@functionless/aws-stepfunctions";
import { EntryEnvMap } from "./esbuild-resource-processor";
import pMap from "p-map";
import { processLambdaFunction } from "./process-lambda";
import { Resource } from "./resource";

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
  registerSubstitution(StepFunction.waitSeconds, $SFN.waitFor);

  const app = new App({
    autoSynth: false,
  });
  const rootStack = new FunctionlessStack(app, project.projectName);

  const synthedResourceMap: Record<string, SynthesizedResource> = {};
  const entryEnvMaps: EntryEnvMap[] = [];
  await constructProject();
  await connectProject(project, app, synthedResourceMap, entryEnvMaps);

  app.synth();

  async function constructProject() {
    for (const file of project.module.files) {
      if (isFolder(file) && file._stack) {
        await synthesizeNode(app, project, file, undefined);
      } else {
        await synthesizeNode(rootStack, project, file, undefined);
      }
    }
  }

  async function synthesizeNode(
    scope: Construct,
    project: Project,
    node: Tree,
    ctx: Construct | undefined,
    overrideId?: string
  ): Promise<Construct> {
    if (isFile(node)) {
      return synthesizeResource(
        scope,
        overrideId ?? node.name,
        project,
        node,
        ctx
      );
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
        ctx = await synthesizeNode(scope, project, node._api, ctx);
      }

      const children = node.files.filter(
        (file) => !["_api", "_stack"].includes(file.name)
      );

      // synthesize all nodes that are not the `_stack` or `_api` special nodes
      for (const child of children) {
        await synthesizeNode(scope, project, child, ctx);
      }
      return scope;
    }
  }

  async function synthesizeResource(
    scope: Construct,
    id: string,
    project: Project,
    file: File,
    ctx: Construct | undefined
  ): Promise<Construct> {
    const construct = await _synthesizeResource(scope, id, project, file, ctx);
    if (construct instanceof Construct) {
      return construct;
    } else {
      registerSubstitution(file.resource, construct);
      synthedResourceMap[file.address] = construct;
      // @ts-ignore
      return construct.resource;
    }
  }

  async function _synthesizeResource(
    scope: Construct,
    id: string,
    project: Project,
    file: File,
    ctx: Construct | undefined
  ): Promise<SynthesizedResource> {
    if (isLambdaFunction(file.resource)) {
      const { bundleFolder, env } = await processLambdaFunction(file, "synth");
      entryEnvMaps.push(env);

      const func = new aws_lambda.Function(scope, id, {
        runtime: aws_lambda.Runtime.NODEJS_16_X,
        handler: "index.default",
        code: aws_lambda.Code.fromAsset(bundleFolder),

        ...file.resource.props,
        environment: {
          NODE_OPTIONS: "--enable-source-maps",
          ...file.resource.props?.environment,
        },
      });
      return Function.fromFunction(func);
    } else if (isStepFunction(file.resource)) {
      return StepFunctionConstruct.fromStateMachine(
        new aws_stepfunctions.StateMachine(scope, id, {
          ...file.resource.props,
          stateMachineType: aws_stepfunctions.StateMachineType.STANDARD,
          definition: new aws_stepfunctions.Pass(scope, "dummy"),
        })
      );
    } else if (isExpressStepFunction(file.resource)) {
      return ExpressStepFunctionConstruct.fromStateMachine(
        new aws_stepfunctions.StateMachine(scope, id, {
          ...file.resource.props,
          stateMachineType: aws_stepfunctions.StateMachineType.EXPRESS,
          definition: new aws_stepfunctions.Pass(scope, "dummy"),
        })
      );
    } else if (isTable(file.resource)) {
      return new Table(scope, id, file.resource.props as any);
      ``;
    } else if (isEventBus(file.resource)) {
      return new EventBus(scope, id, file.resource.props);
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
        project,
        methodHandlerFile(file),
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
          isLambdaFunction((file.resource as any).handler)
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
  | StepFunctionConstruct<any, any>
  | IStepFunction<any, any>
  | ExpressStepFunctionConstruct<any, any>
  | IExpressStepFunction<any, any>
  | Function<any, any>
  | Table<any, any, any>
  | EventBus<any>
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

async function synthesizeLambdaEnvironment(
  resource: LambdaFunction,
  lambdaFunction: aws_lambda.Function,
  entryFile: File,
  synthedResourceMap: Record<string, SynthesizedResource>,
  entryEnvMaps: EntryEnvMap[]
) {
  const ast = validateFunctionLike(resource.handler, resource.kind);

  inferIamPolicies(ast, lambdaFunction);

  const envs = await pMap(
    entryEnvMaps,
    async (entryEnvMap) =>
      await pMap(
        Object.entries(entryEnvMap[entryFile.address] ?? {}),
        ([resourceFileAddress, materializeEnv]) => {
          const resource = synthedResourceMap[resourceFileAddress];
          return materializeEnv({ functionTarget: "synth", resource });
        }
      )
  );

  envs
    .flatMap((x) => x)
    .flatMap((e) => Object.entries(e))
    .forEach(([name, value]) => {
      lambdaFunction.addEnvironment(name, value);
    });
}

async function connectProject(
  project: Project,
  scope: Construct,
  synthedResourceMap: Record<string, SynthesizedResource>,
  entryEnvMaps: EntryEnvMap[]
) {
  if (scope instanceof aws_stepfunctions.StateMachine) {
    const resource = project.lookupResource(scope.node.path)
      .resource as Resource & { handler: any };
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
    const resourceFile = project.lookupResource(scope.node.path) as File & {
      resource: { handler: any };
    };
    if (
      isMethod(resourceFile.resource) &&
      isLambdaFunction(resourceFile.resource.handler)
    ) {
      await synthesizeLambdaEnvironment(
        resourceFile.resource.handler,
        scope,
        methodHandlerFile(resourceFile),
        synthedResourceMap,
        entryEnvMaps
      );
    } else if (isLambdaFunction(resourceFile.resource)) {
      await synthesizeLambdaEnvironment(
        resourceFile.resource,
        scope,
        resourceFile,
        synthedResourceMap,
        entryEnvMaps
      );
    }
  }
  await pMap(scope.node.children, (child) =>
    connectProject(project, child, synthedResourceMap, entryEnvMaps)
  );
}

function methodHandlerFile(methodFile: File): File {
  const handlerFile = new File({
    ...methodFile,
    resource: (methodFile.resource as Method).handler,
  });
  Object.defineProperty(handlerFile, "parent", { value: methodFile });
  return handlerFile;
}
