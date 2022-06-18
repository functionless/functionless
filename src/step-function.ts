import * as appsync from "@aws-cdk/aws-appsync-alpha";
import {
  aws_apigateway,
  aws_events_targets,
  aws_stepfunctions,
  Stack,
} from "aws-cdk-lib";
// eslint-disable-next-line import/no-extraneous-dependencies
import { StepFunctions } from "aws-sdk";
import { Construct } from "constructs";
import { ApiGatewayVtlIntegration } from "./api";
import { AppSyncVtlIntegration } from "./appsync";
import {
  ASL,
  isMapOrForEach,
  MapTask,
  StateMachine,
  States,
  Task,
} from "./asl";
import { assertDefined } from "./assert";
import {
  validateFunctionDecl,
  FunctionDecl,
  isFunctionDecl,
} from "./declaration";
import { isErr } from "./error";
import { ErrorCodes, SynthError } from "./error-code";
import { EventBus, PredicateRuleBase, Rule } from "./event-bridge";
import {
  EventBusTargetIntegration,
  makeEventBusIntegration,
} from "./event-bridge/event-bus";
import { Event } from "./event-bridge/types";
import {
  CallExpr,
  isComputedPropertyNameExpr,
  isFunctionExpr,
  isObjectLiteralExpr,
  isSpreadAssignExpr,
} from "./expression";
import { NativeIntegration } from "./function";
import { PrewarmClients } from "./function-prewarm";
import {
  Integration,
  IntegrationCall,
  IntegrationInput,
  makeIntegration,
} from "./integration";
import { AnyFunction, ensureItemOf } from "./util";
import { VTL } from "./vtl";

export type AnyStepFunction =
  | ExpressStepFunction<any, any>
  | StepFunction<any, any>;

export namespace $SFN {
  export const kind = "SFN";
  /**
   * Wait for a specific number of {@link seconds}.
   *
   * ```ts
   * new ExpressStepFunction(this, "F", (seconds: number) => $SFN.waitFor(seconds))
   * ```
   *
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html
   */
  export const waitFor = makeStepFunctionIntegration<
    "waitFor",
    (seconds: number) => void
  >("waitFor", {
    asl(call) {
      const seconds = call.args[0].expr;
      if (seconds === undefined) {
        throw new Error("the 'seconds' argument is required");
      }

      if (seconds.kind === "NumberLiteralExpr") {
        return {
          Type: "Wait" as const,
          Seconds: seconds.value,
        };
      } else {
        return {
          Type: "Wait" as const,
          SecondsPath: ASL.toJsonPath(seconds),
        };
      }
    },
  });

  /**
   * Wait until a {@link timestamp}.
   *
   * ```ts
   * new ExpressStepFunction(this, "F", (timestamp: string) => $SFN.waitUntil(timestamp))
   * ```
   *
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html
   */
  export const waitUntil = makeStepFunctionIntegration<
    "waitUntil",
    (timestamp: string) => void
  >("waitUntil", {
    asl(call) {
      const timestamp = call.args[0]?.expr;
      if (timestamp === undefined) {
        throw new Error("the 'timestamp' argument is required");
      }

      if (timestamp.kind === "StringLiteralExpr") {
        return {
          Type: "Wait",
          Timestamp: timestamp.value,
        };
      } else {
        return {
          Type: "Wait",
          TimestampPath: ASL.toJsonPath(timestamp),
        };
      }
    },
  });

  interface ForEach {
    /**
     * Process each item in an {@link array} in parallel and run with the default maxConcurrency.
     *
     * Example:
     * ```ts
     * new ExpressStepFunction(this, "F"} (items: string[]) => {
     *   $SFN.forEach(items, { maxConcurrency: 2 }, item => task(item));
     * });
     * ```
     *
     * @param array the list of items to process
     * @param callbackfn function to process each item
     */
    <T>(
      array: T[],
      callbackfn: (item: T, index: number, array: T[]) => void
    ): void;
    /**
     * Process each item in an {@link array} in parallel and run with the default maxConcurrency.
     *
     * Example:
     * ```ts
     * new ExpressStepFunction(this, "F"} (items: string[]) => {
     *   $SFN.forEach(items, { maxConcurrency: 2 }, item => task(item));
     * });
     * ```
     *
     * @param array the list of items to process
     * @param props configure the maxConcurrency
     * @param callbackfn function to process each item
     */
    <T>(
      array: T[],
      props: {
        maxConcurrency: number;
      },
      callbackfn: (item: T, index: number, array: T[]) => void
    ): void;
  }

  export const forEach = makeStepFunctionIntegration<"forEach", ForEach>(
    "forEach",
    {
      asl(call, context) {
        return mapOrForEach(call, context);
      },
    }
  );

  interface Map {
    /**
     * Map over each item in an {@link array} in parallel and run with the default maxConcurrency.
     *
     * Example:
     * ```ts
     * new ExpressStepFunction(this, "F", (items: string[]) => {
     *   return $SFN.map(items, item => task(item))
     * });
     * ```
     *
     * @param array the list of items to map over
     * @param callbackfn function to process each item
     * @returns an array containing the result of each mapped item
     */
    <T, U>(
      array: T[],
      callbackfn: (item: T, index: number, array: T[]) => U
    ): U[];
    /**
     * Map over each item in an {@link array} in parallel and run with the default maxConcurrency.
     *
     * Example:
     * ```ts
     * new ExpressStepFunction(this, "F", (items: string[]) => {
     *   return $SFN.map(items, item => task(item))
     * });
     * ```
     *
     * @param array the list of items to map over
     * @param props configure the maxConcurrency
     * @param callbackfn function to process each item
     * @returns an array containing the result of each mapped item
     */
    <T, U>(
      array: T[],
      props: {
        maxConcurrency: number;
      },
      callbackfn: (item: T, index: number, array: T[]) => U
    ): U[];
  }

  export const map = makeStepFunctionIntegration<"map", Map>("map", {
    asl(call, context) {
      return mapOrForEach(call, context);
    },
  });

  function mapOrForEach(call: CallExpr, context: ASL): MapTask {
    if (isMapOrForEach(call)) {
      const callbackfn = call.getArgument("callbackfn")?.expr;
      if (callbackfn === undefined || callbackfn.kind !== "FunctionExpr") {
        throw new Error("missing callbackfn in $SFN.map");
      }
      const callbackStates = context.execute(callbackfn.body);
      const callbackStart = context.getStateName(callbackfn.body.step()!);
      const props = call.getArgument("props")?.expr;
      let maxConcurrency: number | undefined;
      if (props !== undefined) {
        if (props.kind === "ObjectLiteralExpr") {
          const maxConcurrencyProp = props.getProperty("maxConcurrency");
          if (
            maxConcurrencyProp?.kind === "PropAssignExpr" &&
            maxConcurrencyProp.expr.kind === "NumberLiteralExpr"
          ) {
            maxConcurrency = maxConcurrencyProp.expr.value;
            if (maxConcurrency <= 0) {
              throw new Error("maxConcurrency must be > 0");
            }
          } else {
            throw new Error(
              "property 'maxConcurrency' must be a NumberLiteralExpr"
            );
          }
        } else {
          throw new Error("argument 'props' must be an ObjectLiteralExpr");
        }
      }
      const array = call.getArgument("array")?.expr;
      if (array === undefined) {
        throw new Error("missing argument 'array'");
      }
      const arrayPath = ASL.toJsonPath(array);
      return {
        Type: "Map",
        ...(maxConcurrency
          ? {
              MaxConcurrency: maxConcurrency,
            }
          : {}),
        Iterator: {
          States: callbackStates,
          StartAt: callbackStart,
        },
        ItemsPath: arrayPath,
        Parameters: Object.fromEntries(
          callbackfn.parameters.map((param, i) => [
            `${param.name}.$`,
            i === 0
              ? "$$.Map.Item.Value"
              : i == 1
              ? "$$.Map.Item.Index"
              : arrayPath,
          ])
        ),
      };
    }
    throw new Error("invalid arguments to $SFN.map");
  }

  /**
   * Run 1 or more workflows in parallel.
   *
   * ```ts
   * new ExpressStepFunction(this, "F", (id: string) => {
   *   const results = $SFN.parallel(
   *     () => task1(id)
   *     () => task2(id)
   *   )
   * })
   * ```
   * @param paths
   */
  export const parallel = makeStepFunctionIntegration<
    "parallel",
    <Paths extends readonly (() => any)[]>(
      ...paths: Paths
    ) => {
      [i in keyof Paths]: i extends `${number}`
        ? ReturnType<Extract<Paths[i], () => any>>
        : Paths[i];
    }
  >("parallel", {
    asl(call, context) {
      const paths = call.getArgument("paths")?.expr;
      if (paths === undefined) {
        throw new Error("missing required argument 'paths'");
      }
      if (paths.kind !== "ArrayLiteralExpr") {
        throw new Error("invalid arguments to $SFN.parallel");
      }
      ensureItemOf(
        paths.items,
        isFunctionExpr,
        "each parallel path must be an inline FunctionExpr"
      );

      return {
        Type: "Parallel",
        Branches: paths.items.map((func) => ({
          StartAt: context.getStateName(func.body.step()!),
          States: context.execute(func.body),
        })),
      };
    },
  });
}

function makeStepFunctionIntegration<K extends string, F extends AnyFunction>(
  methodName: K,
  integration: Omit<IntegrationInput<`$SFN.${K}`, F>, "kind">
): F {
  return makeIntegration<`$SFN.${K}`, F>({
    kind: `$SFN.${methodName}`,
    unhandledContext(kind, context) {
      throw new Error(
        `${kind} is only allowed within a '${VTL.ContextName}' context, but was called within a '${context}' context.`
      );
    },
    ...integration,
  });
}

export function isStepFunction<P = any, O = any>(
  a: any
): a is StepFunction<P, O> | ExpressStepFunction<P, O> {
  return a?.kind === "StepFunction";
}

/**
 * {@see https://docs.aws.amazon.com/step-functions/latest/dg/cw-events.html}
 */
interface StepFunctionDetail {
  executionArn: string;
  stateMachineArn: string;
  name: string;
  status: "SUCCEEDED" | "RUNNING" | "FAILED" | "TIMED_OUT" | "ABORTED";
  startDate: number;
  stopDate: number | null;
  input: string;
  inputDetails: {
    included: boolean;
  };
  output: null | string;
  outputDetails: null | {
    included: boolean;
  };
}

export interface StepFunctionStatusChangedEvent
  extends Event<
    StepFunctionDetail,
    "Step Functions Execution Status Change",
    "aws.states"
  > {}

interface StepFunctionEventBusTargetProps
  extends Omit<aws_events_targets.SfnStateMachineProps, "input"> {}

abstract class BaseStepFunction<
  Payload extends Record<string, any> | undefined,
  CallIn,
  CallOut
> implements
    Integration<
      "StepFunction",
      (input: CallIn) => CallOut,
      EventBusTargetIntegration<
        Payload,
        StepFunctionEventBusTargetProps | undefined
      >
    >
{
  readonly kind = "StepFunction";
  readonly functionlessKind = "StepFunction";

  readonly appSyncVtl: AppSyncVtlIntegration;

  // @ts-ignore
  readonly __functionBrand: (arg: CallIn) => CallOut;

  constructor(readonly resource: aws_stepfunctions.StateMachine) {
    // Integration object for appsync vtl
    this.appSyncVtl = this.appSyncIntegration({
      request: (call, context) => {
        const { name, input, traceHeader } = retrieveMachineArgs(call);

        const inputObj = context.var("{}");
        input &&
          context.put(
            inputObj,
            context.str("input"),
            `$util.toJson(${context.eval(input)})`
          );
        name && context.put(inputObj, context.str("name"), context.eval(name));
        traceHeader &&
          context.put(
            inputObj,
            context.str("traceHeader"),
            context.eval(traceHeader)
          );
        context.put(
          inputObj,
          context.str("stateMachineArn"),
          context.str(resource.stateMachineArn)
        );

        return `{
  "version": "2018-05-29",
  "method": "POST",
  "resourcePath": "/",
  "params": {
    "headers": {
      "content-type": "application/x-amz-json-1.0",
      "x-amz-target": "${
        this.resource.stateMachineType ===
        aws_stepfunctions.StateMachineType.EXPRESS
          ? "AWSStepFunctions.StartSyncExecution"
          : "AWSStepFunctions.StartExecution"
      }"
    },
    "body": $util.toJson(${inputObj})
  }
}`;
      },
    });
  }

  public appSyncIntegration(
    integration: Pick<AppSyncVtlIntegration, "request">
  ): AppSyncVtlIntegration {
    return {
      ...integration,
      dataSourceId: () => this.resource.node.addr,
      dataSource: (api, dataSourceId) => {
        const ds = new appsync.HttpDataSource(api, dataSourceId, {
          api,
          endpoint: `https://${
            this.resource.stateMachineType ===
            aws_stepfunctions.StateMachineType.EXPRESS
              ? "sync-states"
              : "states"
          }.${this.resource.stack.region}.amazonaws.com/`,
          authorizationConfig: {
            signingRegion: api.stack.region,
            signingServiceName: "states",
          },
        });

        this.resource.grantRead(ds.grantPrincipal);
        if (
          this.resource.stateMachineType ===
          aws_stepfunctions.StateMachineType.EXPRESS
        ) {
          this.resource.grantStartSyncExecution(ds.grantPrincipal);
        } else {
          this.resource.grantStartExecution(ds.grantPrincipal);
        }
        return ds;
      },
      result: (resultVariable) => {
        const returnValName = "$sfn__result";

        if (
          this.resource.stateMachineType ===
          aws_stepfunctions.StateMachineType.EXPRESS
        ) {
          return {
            returnVariable: returnValName,
            template: `#if(${resultVariable}.statusCode == 200)
    #set(${returnValName} = $util.parseJson(${resultVariable}.body))
    #if(${returnValName}.output == 'null')
    $util.qr(${returnValName}.put("output", $null))
    #else
    #set(${returnValName}.output = $util.parseJson(${returnValName}.output))
    #end
    #else 
    $util.error(${resultVariable}.body, "${resultVariable}.statusCode")
    #end`,
          };
        } else {
          return {
            returnVariable: returnValName,
            template: `#if(${resultVariable}.statusCode == 200)
    #set(${returnValName} = $util.parseJson(${resultVariable}.body))
    #else 
    $util.error(${resultVariable}.body, "${resultVariable}.statusCode")
    #end`,
          };
        }
      },
    };
  }

  public asl(call: CallExpr, context: ASL) {
    this.resource.grantStartExecution(context.role);
    if (
      this.resource.stateMachineType ===
      aws_stepfunctions.StateMachineType.EXPRESS
    ) {
      this.resource.grantStartSyncExecution(context.role);
    }

    const { name, input, traceHeader } = retrieveMachineArgs(call);

    return {
      Type: "Task" as const,
      Resource: `arn:aws:states:::aws-sdk:sfn:${
        this.resource.stateMachineType ===
        aws_stepfunctions.StateMachineType.EXPRESS
          ? "startSyncExecution"
          : "startExecution"
      }`,
      Parameters: {
        StateMachineArn: this.resource.stateMachineArn,
        ...(input ? ASL.toJsonAssignment("Input", input) : {}),
        ...(name ? ASL.toJsonAssignment("Name", name) : {}),
        ...(traceHeader
          ? ASL.toJsonAssignment("TraceHeader", traceHeader)
          : {}),
      },
    };
  }

  public readonly eventBus = makeEventBusIntegration<
    Payload,
    StepFunctionEventBusTargetProps | undefined
  >({
    target: (props, targetInput) => {
      return new aws_events_targets.SfnStateMachine(this.resource, {
        ...props,
        input: targetInput,
      });
    },
  });

  private statusChangeEventDocument() {
    return {
      doc: {
        source: { value: "aws.states" },
        "detail-type": { value: "Step Functions Execution Status Change" },
        detail: {
          doc: {
            stateMachineArn: { value: this.resource.stateMachineArn },
          },
        },
      },
    };
  }

  public onSucceeded(
    scope: Construct,
    id: string
  ): Rule<StepFunctionStatusChangedEvent> {
    const bus = EventBus.default<StepFunctionStatusChangedEvent>(this.resource);

    return new PredicateRuleBase(
      scope,
      id,
      bus,
      this.statusChangeEventDocument(),
      {
        doc: {
          detail: {
            doc: {
              status: { value: "SUCCEEDED" },
            },
          },
        },
      }
    );
  }

  public onFailed(
    scope: Construct,
    id: string
  ): Rule<StepFunctionStatusChangedEvent> {
    const bus = EventBus.default<StepFunctionStatusChangedEvent>(this.resource);

    return new PredicateRuleBase<StepFunctionStatusChangedEvent>(
      scope,
      id,
      bus,
      this.statusChangeEventDocument(),
      {
        doc: {
          detail: {
            doc: {
              status: { value: "FAILED" },
            },
          },
        },
      }
    );
  }

  public onStarted(
    scope: Construct,
    id: string
  ): Rule<StepFunctionStatusChangedEvent> {
    const bus = EventBus.default<StepFunctionStatusChangedEvent>(this.resource);

    return new PredicateRuleBase<StepFunctionStatusChangedEvent>(
      scope,
      id,
      bus,
      this.statusChangeEventDocument(),
      {
        doc: {
          detail: {
            doc: {
              status: { value: "RUNNING" },
            },
          },
        },
      }
    );
  }

  public onTimedOut(
    scope: Construct,
    id: string
  ): Rule<StepFunctionStatusChangedEvent> {
    const bus = EventBus.default<StepFunctionStatusChangedEvent>(this.resource);

    return new PredicateRuleBase(
      scope,
      id,
      bus,
      this.statusChangeEventDocument(),
      {
        doc: {
          detail: {
            doc: {
              status: { value: "TIMED_OUT" },
            },
          },
        },
      }
    );
  }

  public onAborted(
    scope: Construct,
    id: string
  ): Rule<StepFunctionStatusChangedEvent> {
    const bus = EventBus.default<StepFunctionStatusChangedEvent>(this.resource);

    return new PredicateRuleBase<StepFunctionStatusChangedEvent>(
      scope,
      id,
      bus,
      this.statusChangeEventDocument(),
      {
        doc: {
          detail: {
            doc: {
              status: { value: "ABORTED" },
            },
          },
        },
      }
    );
  }

  /**
   * Create event bus rule that matches any status change on this machine.
   */
  public onStatusChanged(
    scope: Construct,
    id: string
  ): Rule<StepFunctionStatusChangedEvent> {
    const bus = EventBus.default<StepFunctionStatusChangedEvent>(this.resource);

    // We are not able to use the nice "when" function here because we don't compile
    return new PredicateRuleBase<StepFunctionStatusChangedEvent>(
      scope,
      id,
      bus,
      this.statusChangeEventDocument()
    );
  }
}

function retrieveMachineArgs(call: CallExpr) {
  // object reference
  // machine(inputObj) => inputObj: { name: "hi", input: ... }
  // Inline Object
  // machine({ input: { ... } })
  // Inline with reference
  // machine({ input: ref, name: "hi", traceHeader: "hi" })
  const arg = call.args[0];

  if (!arg.expr || !isObjectLiteralExpr(arg.expr)) {
    throw Error(
      "Step function invocation must use a single, inline object parameter. Variable references are not supported currently."
    );
  } else if (
    arg.expr.properties.some(
      (x) => isSpreadAssignExpr(x) || isComputedPropertyNameExpr(x.name)
    )
  ) {
    throw Error(
      "Step function invocation must use a single, inline object instantiated without computed or spread keys."
    );
  }

  // we know the keys cannot be computed, so it is safe to use getProperty
  return {
    name: arg.expr.getProperty("name")?.expr,
    traceHeader: arg.expr.getProperty("traceHeader")?.expr,
    input: arg.expr.getProperty("input")?.expr,
  };
}

export interface StepFunctionProps
  extends Omit<
    aws_stepfunctions.StateMachineProps,
    "definition" | "stateMachineType"
  > {}

/**
 * An {@link ExpressStepFunction} is a callable Function which executes on the managed
 * AWS Step Function infrastructure. Like a Lambda Function, it runs within memory of
 * a single machine, except unlike Lambda, the entire environment is managed and operated
 * by AWS. Meaning, there is no Operating System, Memory, CPU, Credentials or API Clients
 * to manage. The entire workflow is configured at build-time via the Amazon State Language (ASL).
 *
 * With Functionless, the ASL is derived from type-safe TypeScript code instead of JSON.
 *
 * ```ts
 * import * as f from "functionless";
 *
 * const table = new f.Table(this, "Table", { ... });
 *
 * const getItem = new ExpressStepFunction(this, "F", () => {
 *   return f.$AWS.DynamoDB.GetItem({
 *     TableName: table,
 *     Key: {
 *       ..
 *     }
 *   });
 * });
 * ```
 */
export interface IExpressStepFunction<
  Payload extends Record<string, any> | undefined,
  Out
> {
  (input: StepFunctionRequest<Payload>): SyncExecutionResult<Out>;
}

class BaseExpressStepFunction<
    Payload extends Record<string, any> | undefined,
    Out
  >
  extends BaseStepFunction<
    Payload,
    StepFunctionRequest<Payload>,
    SyncExecutionResult<Out>
  >
  implements IExpressStepFunction<Payload, Out>
{
  /**
   * This static property identifies this class as an ExpressStepFunction to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "ExpressStepFunction";

  readonly native: NativeIntegration<
    (input: StepFunctionRequest<Payload>) => SyncExecutionResult<Out>
  >;

  constructor(machine: aws_stepfunctions.StateMachine) {
    super(machine);

    const stateMachineArn = this.resource.stateMachineArn;

    this.native = {
      bind: (context) => {
        this.resource.grantStartSyncExecution(context.resource);
      },
      preWarm(preWarmContext) {
        preWarmContext.getOrInit(PrewarmClients.STEP_FUNCTIONS);
      },
      call: async (args, prewarmContext) => {
        const stepFunctionsClient = prewarmContext.getOrInit<StepFunctions>(
          PrewarmClients.STEP_FUNCTIONS
        );
        const [payload] = args;
        const result = await stepFunctionsClient
          .startSyncExecution({
            ...payload,
            stateMachineArn: stateMachineArn,
            input: payload.input ? JSON.stringify(payload.input) : undefined,
          })
          .promise();

        return result.error
          ? ({
              ...result,
              error: result.error,
              status: result.status as "FAILED" | "TIMED_OUT",
              startDate: result.startDate.getUTCMilliseconds(),
              stopDate: result.stopDate.getUTCMilliseconds(),
            } as SyncExecutionFailedResult)
          : ({
              ...result,
              startDate: result.startDate.getUTCMilliseconds(),
              stopDate: result.stopDate.getUTCMilliseconds(),
              output: result.output ? JSON.parse(result.output) : undefined,
            } as SyncExecutionSuccessResult<Out>);
      },
    };
  }
}

interface BaseExpressStepFunction<
  Payload extends Record<string, any> | undefined,
  Out
> {
  (input: StepFunctionRequest<Payload>): SyncExecutionResult<Out>;
}

/**
 * An {@link ExpressStepFunction} is a callable Function which executes on the managed
 * AWS Step Function infrastructure. Like a Lambda Function, it runs within memory of
 * a single machine, except unlike Lambda, the entire environment is managed and operated
 * by AWS. Meaning, there is no Operating System, Memory, CPU, Credentials or API Clients
 * to manage. The entire workflow is configured at build-time via the Amazon State Language (ASL).
 *
 * With Functionless, the ASL is derived from type-safe TypeScript code instead of JSON.
 *
 * ```ts
 * import * as f from "functionless";
 *
 * const table = new f.Table(this, "Table", { ... });
 *
 * const getItem = new ExpressStepFunction(this, "F", () => {
 *   return f.$AWS.DynamoDB.GetItem({
 *     TableName: table,
 *     Key: {
 *       ..
 *     }
 *   });
 * });
 * ```
 */
export class ExpressStepFunction<
  Payload extends Record<string, any> | undefined,
  Out
> extends BaseExpressStepFunction<Payload, Out> {
  readonly definition: StateMachine<States>;

  // Integration object for api gateway vtl
  readonly apiGWVtl: ApiGatewayVtlIntegration = {
    renderRequest: (call, context) => {
      const args = retrieveMachineArgs(call);

      return `{\n"stateMachineArn":"${
        this.resource.stateMachineArn
      }",\n${Object.entries(args)
        .filter(
          (arg): arg is [typeof arg[0], Exclude<typeof arg[1], undefined>] =>
            arg[1] !== undefined
        )
        .map(([argName, argVal]) => {
          if (argName === "input") {
            // stringify the JSON input
            const input = context.exprToJson(argVal).replace(/"/g, '\\"');
            return `"${argName}":"${input}"`;
          } else {
            return `"${argName}":${context.exprToJson(argVal)}`;
          }
        })
        .join(",")}\n}`;
    },

    createIntegration: (options) => {
      const credentialsRole = options.credentialsRole;

      this.resource.grantRead(credentialsRole);
      this.resource.grantStartSyncExecution(credentialsRole);

      return new aws_apigateway.AwsIntegration({
        service: "states",
        action: "StartSyncExecution",
        integrationHttpMethod: "POST",
        options: {
          ...options,
          credentialsRole,
          passthroughBehavior: aws_apigateway.PassthroughBehavior.NEVER,
        },
      });
    },
  };

  /**
   * Wrap a {@link aws_stepfunctions.StateMachine} with Functionless.
   *
   * A wrapped {@link StepFunction} provides common integrations like execute (`machine()`) and `describeExecution`.
   *
   * {@link ExpressStepFunction} should only be used to wrap a Express Step Function.
   * Express Step Functions should use {@link StepFunction}.
   *
   * ```ts
   * ExpressStepFunction.fromStateMachine(new aws_stepfunctions.StateMachine(this, "F", {
   *    stateMachineType: aws_stepfunctions.StateMachineType.EXPRESS,
   *    ...
   * }));
   * ```
   */
  public static fromStateMachine<
    Payload extends Record<string, any> | undefined,
    Out
  >(
    machine: aws_stepfunctions.StateMachine
  ): IExpressStepFunction<Payload, Out> {
    return new ImportedExpressStepFunction<Payload, Out>(machine);
  }

  constructor(
    scope: Construct,
    id: string,
    props: StepFunctionProps,
    func: (arg: Payload) => Out
  );
  constructor(scope: Construct, id: string, func: (arg: Payload) => Out);
  constructor(
    scope: Construct,
    id: string,
    ...args:
      | [props: StepFunctionProps, func: (arg: Payload) => Out]
      | [func: (arg: Payload) => Out]
  ) {
    const [props, func] = getStepFunctionArgs(...args);

    const [definition, machine] = synthesizeStateMachine(scope, id, func, {
      ...props,
      stateMachineType: aws_stepfunctions.StateMachineType.EXPRESS,
    });

    super(machine);

    this.definition = definition;
  }
}

class ImportedExpressStepFunction<
  Payload extends Record<string, any> | undefined,
  Out
> extends BaseExpressStepFunction<Payload, Out> {
  constructor(machine: aws_stepfunctions.StateMachine) {
    if (
      machine.stateMachineType !== aws_stepfunctions.StateMachineType.EXPRESS
    ) {
      throw new SynthError(ErrorCodes.Incorrect_StateMachine_Import_Type);
    }

    super(machine);
  }
}

interface BaseSyncExecutionResult {
  billingDetails?: {
    billedDurationInMilliseconds: number;
    billedMemoryUsedInMB: number;
  };
  executionArn: string;
  input: string;
  inputDetails: {
    included: boolean;
  };
  name: string;

  outputDetails: {
    included: boolean;
  };
  startDate: number;
  stateMachineArn: string;
  status: "SUCCEEDED" | "FAILED" | "TIMED_OUT";
  stopDate: number;
  traceHeader: string;
}
export interface SyncExecutionFailedResult extends BaseSyncExecutionResult {
  cause: string;
  error: string;
  status: "FAILED" | "TIMED_OUT";
}
export interface SyncExecutionSuccessResult<T> extends BaseSyncExecutionResult {
  output: T;
  status: "SUCCEEDED";
}
export type SyncExecutionResult<T> =
  | SyncExecutionFailedResult
  | SyncExecutionSuccessResult<T>;

// do not support undefined values, arguments must be present or missing
export type StepFunctionRequest<P extends Record<string, any> | undefined> =
  (P extends undefined ? { input?: P } : { input: P }) &
    (
      | {
          name: string;
          traceHeader: string;
        }
      | {
          name: string;
        }
      | {
          traceHeader: string;
        }
      | {}
    );

export interface ExpressStepFunction<
  Payload extends Record<string, any> | undefined,
  Out
> {
  (input: StepFunctionRequest<Payload>): SyncExecutionResult<Out>;
}

/**
 * A {@link StepFunction} is a callable Function which executes on the managed
 * AWS Step Function infrastructure. Like a Lambda Function, it runs within memory of
 * a single machine, except unlike Lambda, the entire environment is managed and operated
 * by AWS. Meaning, there is no Operating System, Memory, CPU, Credentials or API Clients
 * to manage. The entire workflow is configured at build-time via the Amazon State Language (ASL).
 *
 * With Functionless, the ASL is derived from type-safe TypeScript code instead of JSON.
 *
 * ```ts
 * import * as f from "functionless";
 *
 * const table = new f.Table(this, "Table", { ... });
 *
 * const getItem = new StepFunction(this, "F", () => {
 *   return f.$AWS.DynamoDB.GetItem({
 *     TableName: table,
 *     Key: {
 *       ..
 *     }
 *   });
 * });
 * ```
 *
 * @typeParam Payload - the object payload to the step function.
 * @typeParam Out - the type of object the step function outputs.
 *                  currently not used: https://github.com/functionless/functionless/issues/129
 */
export interface IStepFunction<
  Payload extends Record<string, any> | undefined,
  _Out
> extends Integration<
    "StepFunction",
    (
      input: StepFunctionRequest<Payload>
    ) => AWS.StepFunctions.StartExecutionOutput,
    EventBusTargetIntegration<
      Payload,
      StepFunctionEventBusTargetProps | undefined
    >
  > {
  describeExecution: IntegrationCall<
    "StepFunction.describeExecution",
    (executionArn: string) => AWS.StepFunctions.DescribeExecutionOutput
  >;

  (input: StepFunctionRequest<Payload>): AWS.StepFunctions.StartExecutionOutput;
}

class BaseStandardStepFunction<
    Payload extends Record<string, any> | undefined,
    Out
  >
  extends BaseStepFunction<
    Payload,
    StepFunctionRequest<Payload>,
    AWS.StepFunctions.StartExecutionOutput
  >
  implements IStepFunction<Payload, Out>
{
  /**
   * This static property identifies this class as an StepFunction to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "StepFunction";

  readonly native: NativeIntegration<
    (
      input: StepFunctionRequest<Payload>
    ) => AWS.StepFunctions.StartExecutionOutput
  >;

  constructor(resource: aws_stepfunctions.StateMachine) {
    super(resource);

    const stateMachineArn = this.resource.stateMachineArn;

    this.native = {
      bind: (context) => {
        this.resource.grantStartExecution(context.resource);
      },
      preWarm(preWarmContext) {
        preWarmContext.getOrInit(PrewarmClients.STEP_FUNCTIONS);
      },
      call: async (args, prewarmContext) => {
        const stepFunctionsClient = prewarmContext.getOrInit<StepFunctions>(
          PrewarmClients.STEP_FUNCTIONS
        );
        const [payload] = args;
        const result = await stepFunctionsClient
          .startExecution({
            ...payload,
            stateMachineArn: stateMachineArn,
            input: payload.input ? JSON.stringify(payload.input) : undefined,
          })
          .promise();

        return result;
      },
    };
  }

  public describeExecution = makeIntegration<
    "StepFunction.describeExecution",
    (executionArn: string) => AWS.StepFunctions.DescribeExecutionOutput
  >({
    kind: "StepFunction.describeExecution",
    appSyncVtl: this.appSyncIntegration({
      request(call, context) {
        const executionArn = getArgs(call);
        return `{
  "version": "2018-05-29",
  "method": "POST",
  "resourcePath": "/",
  "params": {
    "headers": {
      "content-type": "application/x-amz-json-1.0",
      "x-amz-target": "AWSStepFunctions.DescribeExecution"
    },
    "body": {
      "executionArn": ${context.json(context.eval(executionArn))}
    }
  }
}`;
      },
    }),
    asl: (call, context) => {
      // need DescribeExecution
      this.resource.grantRead(context.role);

      const executionArnExpr = assertDefined(
        call.args[0].expr,
        "Describe Execution requires a single string argument."
      );

      const argValue = ASL.toJsonAssignment("ExecutionArn", executionArnExpr);

      const task: Task = {
        Type: "Task",
        Resource: "arn:aws:states:::aws-sdk:sfn:describeExecution",
        Parameters: argValue,
      };
      return task;
    },
    native: {
      bind: (context) => this.resource.grantRead(context.resource),
      preWarm(prewarmContext) {
        prewarmContext.getOrInit(PrewarmClients.STEP_FUNCTIONS);
      },
      call: async (args, prewarmContext) => {
        const stepFunctionClient = prewarmContext.getOrInit<StepFunctions>(
          PrewarmClients.STEP_FUNCTIONS
        );

        const [arn] = args;

        const result = await stepFunctionClient
          .describeExecution({
            executionArn: arn,
          })
          .promise();

        return result;
      },
    },
    unhandledContext: (kind, contextKind) => {
      throw new Error(
        `${kind} is only available in the ${ASL.ContextName} and ${VTL.ContextName} context, but was used in ${contextKind}.`
      );
    },
  });
}

interface BaseStandardStepFunction<
  Payload extends Record<string, any> | undefined,
  Out
> {
  (input: StepFunctionRequest<Payload>): AWS.StepFunctions.StartExecutionOutput;
}

/**
 * A {@link StepFunction} is a callable Function which executes on the managed
 * AWS Step Function infrastructure. Like a Lambda Function, it runs within memory of
 * a single machine, except unlike Lambda, the entire environment is managed and operated
 * by AWS. Meaning, there is no Operating System, Memory, CPU, Credentials or API Clients
 * to manage. The entire workflow is configured at build-time via the Amazon State Language (ASL).
 *
 * With Functionless, the ASL is derived from type-safe TypeScript code instead of JSON.
 *
 * ```ts
 * import * as f from "functionless";
 *
 * const table = new f.Table(this, "Table", { ... });
 *
 * const getItem = new StepFunction(this, "F", () => {
 *   return f.$AWS.DynamoDB.GetItem({
 *     TableName: table,
 *     Key: {
 *       ..
 *     }
 *   });
 * });
 * ```
 *
 * @typeParam Payload - the object payload to the step function.
 * @typeParam Out - the type of object the step function outputs.
 *                  currently not used: https://github.com/functionless/functionless/issues/129
 */
export class StepFunction<Payload extends Record<string, any> | undefined, Out>
  extends BaseStandardStepFunction<Payload, Out>
  implements IStepFunction<Payload, Out>
{
  readonly definition: StateMachine<States>;

  /**
   * Wrap a {@link aws_stepfunctions.StateMachine} with Functionless.
   *
   * A wrapped {@link StepFunction} provides common integrations like execute (`machine()`) and `describeExecution`.
   *
   * {@link StepFunction} should only be used to wrap a Standard Step Function.
   * Express Step Functions should use {@link ExpressStepFunction}.
   *
   * ```ts
   * StepFunction.fromStateMachine(new aws_stepfunctions.StateMachine(this, "F", {
   *    ...
   * }));
   * ```
   */
  public static fromStateMachine<
    Payload extends Record<string, any> | undefined,
    Out
  >(machine: aws_stepfunctions.StateMachine): IStepFunction<Payload, Out> {
    return new ImportedStepFunction<Payload, Out>(machine);
  }

  constructor(
    scope: Construct,
    id: string,
    props: StepFunctionProps,
    func: (arg: Payload) => Out
  );

  constructor(scope: Construct, id: string, func: (arg: Payload) => Out);

  constructor(
    scope: Construct,
    id: string,
    ...args:
      | [props: StepFunctionProps, func: (arg: Payload) => Out]
      | [func: (arg: Payload) => Out]
  ) {
    const [props, func] = getStepFunctionArgs(...args);

    const [definition, machine] = synthesizeStateMachine(scope, id, func, {
      ...props,
      stateMachineType: aws_stepfunctions.StateMachineType.STANDARD,
    });

    super(machine);

    this.definition = definition;
  }
}

function getStepFunctionArgs<
  Payload extends Record<string, any> | undefined,
  Out
>(
  ...args:
    | [props: StepFunctionProps, func: (arg: Payload) => Out]
    | [func: (arg: Payload) => Out]
) {
  const props =
    isFunctionDecl(args[0]) || isErr(args[0])
      ? {}
      : (args[1] as StepFunctionProps);
  const func = validateFunctionDecl(
    args.length > 1 ? args[1] : args[0],
    "StepFunction"
  );

  return [props, func] as const;
}

function synthesizeStateMachine(
  scope: Construct,
  id: string,
  decl: FunctionDecl,
  props: StepFunctionProps & {
    stateMachineType: aws_stepfunctions.StateMachineType;
  }
): [StateMachine<States>, aws_stepfunctions.StateMachine] {
  const machine = new aws_stepfunctions.StateMachine(scope, id, {
    ...props,
    definition: new aws_stepfunctions.Pass(scope, "dummy"),
  });

  const definition = new ASL(scope, machine.role, decl).definition;

  const resource = machine.node.findChild(
    "Resource"
  ) as aws_stepfunctions.CfnStateMachine;

  resource.definitionString = Stack.of(resource).toJsonString(definition);

  // remove the dummy pass node because we don't need it.
  scope.node.tryRemoveChild("dummy");

  return [definition, machine];
}

class ImportedStepFunction<
  Payload extends Record<string, any> | undefined,
  Out
> extends BaseStandardStepFunction<Payload, Out> {
  constructor(machine: aws_stepfunctions.StateMachine) {
    if (
      machine.stateMachineType !== aws_stepfunctions.StateMachineType.STANDARD
    ) {
      throw new SynthError(ErrorCodes.Incorrect_StateMachine_Import_Type);
    }

    super(machine);
  }
}

function getArgs(call: CallExpr) {
  const executionArn = call.args[0]?.expr;
  if (executionArn === undefined) {
    throw new Error("missing argument 'executionArn'");
  }
  return executionArn;
}
