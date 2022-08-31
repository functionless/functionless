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
import { ASL, ASLGraph, StateMachine, States } from "./asl";
import { assertDefined } from "./assert";
import { FunctionLike } from "./declaration";
import { ErrorCodes, SynthError } from "./error-code";
import { EventBus, PredicateRuleBase, Rule } from "./event-bridge";
import {
  EventBusTargetIntegration,
  makeEventBusIntegration,
} from "./event-bridge/event-bus";
import { Event } from "./event-bridge/types";
import { CallExpr } from "./expression";
import { NativeIntegration } from "./function";
import { PrewarmClients } from "./function-prewarm";
import {
  isComputedPropertyNameExpr,
  isErr,
  isFunctionLike,
  isGetAccessorDecl,
  isMethodDecl,
  isNumberLiteralExpr,
  isObjectLiteralExpr,
  isPropAssignExpr,
  isSetAccessorDecl,
  isSpreadAssignExpr,
} from "./guards";
import {
  Integration,
  IntegrationCall,
  IntegrationInput,
  makeIntegration,
} from "./integration";
import { validateFunctionLike } from "./reflect";
import { AnyFunction } from "./util";
import { VTL } from "./vtl";

export type AnyStepFunction =
  | ExpressStepFunction<any, any>
  | StepFunction<any, any>;

/**
 * Machine and Execution context available during runtime.
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/input-output-contextobject.html
 *
 * To access this data, use the second parameter in a new {@link StepFunction}'s callback.
 *
 * ```ts
 * new StepFunction(stack, 'sfn', (input, context) => {
 *    return context.Execution.Name;
 * })
 * ```
 *
 * > Note: missing fields (ex: `$$.State.Name`) are abstracted away from {@link StepFunction}.
 * > Note: `$$.Execution.Input` is available as the first parameter of the closure `(input) => {}`.
 */
export interface SfnContext {
  /**
   * Data associated with the current execution of the state machine which is available during execution.
   */
  readonly Execution: {
    /**
     * Unique name of the current execution of the {@link StateMachine}.
     *
     * @example - executionName
     */
    readonly Name: string;
    /**
     * Arn of the current execution of the {@link StateMachine}.
     *
     * @example - arn:aws:states:us-east-1:123456789012:execution:stateMachineName:executionName
     */
    readonly Id: string;
    /**
     * Time the current execution started.
     *
     * Format: ISO 8601
     *
     * @example - 2019-03-26T20:14:13.192Z
     */
    readonly StartTime: string;
    /**
     * Execution role ARN
     *
     * @example - arn:aws:iam::123456789012:role
     */
    readonly RoleArn: string;
  };
  /**
   * Data associated with the state machine which is available during execution.
   */
  readonly StateMachine: {
    /**
     * Unique name of the {@link StateMachine}.
     *
     * @example - stateMachineName
     */
    readonly Name: string;
    /**
     * Arn of the {@link StateMachine}.
     *
     * @example  arn:aws:states:us-east-1:123456789012:stateMachine:stateMachineName
     */
    readonly Id: string;
  };
}

export type StepFunctionClosure<
  Payload extends Record<string, any> | undefined,
  Out
> = (arg: Payload, context: SfnContext) => Promise<Out> | Out;

type ParallelFunction<T> = () => Promise<T> | T;

type ParallelFunctionReturnType<T extends ParallelFunction<T>> =
  T extends ParallelFunction<infer P> ? P : never;

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
    asl(call, context) {
      const seconds = call.args[0]?.expr;
      if (seconds === undefined) {
        throw new Error("the 'seconds' argument is required");
      }

      return context.evalExpr(seconds, call, (secondsOutput) => {
        if (
          ASLGraph.isLiteralValue(secondsOutput) &&
          typeof secondsOutput.value === "number"
        ) {
          return context.stateWithVoidOutput({
            Type: "Wait",
            Seconds: secondsOutput.value,
            Next: ASLGraph.DeferNext,
          });
        } else if (ASLGraph.isJsonPath(secondsOutput)) {
          return context.stateWithVoidOutput({
            Type: "Wait",
            SecondsPath: secondsOutput.jsonPath,
            Next: ASLGraph.DeferNext,
          });
        }

        throw new SynthError(
          ErrorCodes.Invalid_Input,
          "Expected the first parameter (seconds) to $SFN.waitFor to be a number or a variable."
        );
      });
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
    asl(call, context) {
      const timestamp = call.args[0]?.expr;
      if (timestamp === undefined) {
        throw new Error("the 'timestamp' argument is required");
      }

      return context.evalExpr(timestamp, call, (timestampOutput) => {
        if (
          ASLGraph.isLiteralValue(timestampOutput) &&
          typeof timestampOutput.value === "string"
        ) {
          return context.stateWithVoidOutput({
            Type: "Wait",
            Timestamp: timestampOutput.value,
            Next: ASLGraph.DeferNext,
          });
        } else if (ASLGraph.isJsonPath(timestampOutput)) {
          return context.stateWithVoidOutput({
            Type: "Wait",
            TimestampPath: timestampOutput.jsonPath,
            Next: ASLGraph.DeferNext,
          });
        }

        throw new SynthError(
          ErrorCodes.Invalid_Input,
          "Expected first parameter (timestamp) parameter to $SFN.waitUntil to be a string or a reference."
        );
      });
    },
  });

  interface ForEach {
    /**
     * Process each item in an {@link array} in parallel and run with the default maxConcurrency.
     *
     * Example:
     * ```ts
     * new ExpressStepFunction(this, "F", async (items: string[]) => {
     *   await $SFN.forEach(items, { maxConcurrency: 2 }, item => task(item));
     * });
     * ```
     *
     * @param array the list of items to process
     * @param callbackfn function to process each item
     */
    <T>(
      array: T[],
      callbackfn: (item: T, index: number, array: T[]) => void
    ): Promise<void>;
    /**
     * Process each item in an {@link array} in parallel and run with the default maxConcurrency.
     *
     * Example:
     * ```ts
     * new ExpressStepFunction(this, "F", async (items: string[]) => {
     *   await $SFN.forEach(items, { maxConcurrency: 2 }, item => task(item));
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
    ): Promise<void>;
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
      callbackfn: (item: T, index: number, array: T[]) => U | Promise<U>
    ): Promise<U[]>;
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
      callbackfn: (item: T, index: number, array: T[]) => U | Promise<U>
    ): Promise<U[]>;
  }

  export const map = makeStepFunctionIntegration<"map", Map>("map", {
    asl(call, context) {
      return mapOrForEach(call, context);
    },
  });

  function mapOrForEach(call: CallExpr, context: ASL) {
    const callbackfn =
      call.args.length === 3 ? call.args[2]?.expr : call.args[1]?.expr;
    if (callbackfn === undefined || !isFunctionLike(callbackfn)) {
      throw new Error("missing callbackfn in $SFN.map");
    }

    const callbackStates = context.evalStmt(
      callbackfn.body,
      // when a return statement is hit, end the sub-machine in the map and return the given value.
      {
        End: true,
        ResultPath: "$",
      }
    );

    const props = call.args.length === 3 ? call.args[1]?.expr : undefined;
    let maxConcurrency: number | undefined;
    if (props !== undefined) {
      if (isObjectLiteralExpr(props)) {
        const maxConcurrencyProp = props.getProperty("maxConcurrency");
        if (
          isPropAssignExpr(maxConcurrencyProp) &&
          isNumberLiteralExpr(maxConcurrencyProp.expr)
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
    const array = call.args[0]?.expr;
    if (array === undefined) {
      throw new Error("missing argument 'array'");
    }

    return context.evalExprToJsonPath(array, call, (output) => {
      const arrayPath = output.jsonPath;

      const [itemParam, indexParam, arrayParam] = callbackfn.parameters;

      const [paramInit, paramStates] =
        context.evalParameterDeclForStateParameter(
          callbackfn,
          [itemParam, { jsonPath: "$$.Map.Item.Value" }],
          [indexParam, { jsonPath: "$$.Map.Item.Index" }],
          [arrayParam, { jsonPath: arrayPath }]
        );

      const bodyStates = ASLGraph.joinSubStates(
        callbackfn,
        // run any parameter initializers if they exist
        paramStates,
        callbackStates
      );

      if (!bodyStates) {
        throw new SynthError(
          ErrorCodes.Unexpected_Error,
          `a $SFN.Map or $SFN.ForEach block must have at least one Stmt`
        );
      }

      return context.stateWithHeapOutput(
        {
          Type: "Map",
          ...(maxConcurrency
            ? {
                MaxConcurrency: maxConcurrency,
              }
            : {}),
          Iterator: context.aslGraphToStates(bodyStates),
          ItemsPath: arrayPath,
          Parameters: {
            ...context.cloneLexicalScopeParameters(call),
            ...paramInit,
          },
          Next: ASLGraph.DeferNext,
        },
        call
      );
    });
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
    <Paths extends readonly ParallelFunction<any>[]>(
      ...paths: Paths
    ) => Promise<{
      [i in keyof Paths]: i extends `${number}`
        ? ParallelFunctionReturnType<Paths[i]>
        : Paths[i];
    }>
  >("parallel", {
    asl(call, context) {
      const paths = call.args.map((arg): FunctionLike => {
        if (isFunctionLike(arg.expr)) {
          return arg.expr;
        } else {
          throw new Error("each parallel path must be an inline FunctionExpr");
        }
      });

      return context.stateWithHeapOutput({
        Type: "Parallel",
        Branches: paths.map((func) => {
          const funcBody = context.evalStmt(
            func.body,
            // when a return statement is hit, end the sub-machine in the parallel branch and return the given value.
            {
              End: true,
              ResultPath: "$",
            }
          );

          if (!funcBody) {
            return context.aslGraphToStates({
              Type: "Pass",
              ResultPath: null,
              Next: ASLGraph.DeferNext,
            });
          }

          return context.aslGraphToStates(funcBody);
        }),
        Next: ASLGraph.DeferNext,
      });
    },
  });

  export const partition = makeStepFunctionIntegration<
    "partition",
    <T>(arr: T[]) => T[][]
  >("partition", {
    asl(call, context) {
      return { jsonPath: "$" };
    },
  });

  /**
   * Use the States.ArrayRange intrinsic function to create a new array containing a specific range of elements.
   * The new array can contain up to 1000 elements.
   *
   * @param start - first element in the new array
   * @param end - final element of the new array (inclusive)
   * @param
   */
  export const range = makeStepFunctionIntegration<
    "partition",
    (start: number, end: number, step: Exclude<number, 0>) => number[]
  >("partition", {
    asl(call, context) {
      return { jsonPath: "$" };
    },
  });

  /**
   * The States.ArrayUnique intrinsic function removes duplicate values from an array and returns an array containing only unique elements.
   * This function takes an array, which can be unsorted, as its sole argument.
   *
   * @param arr - array of values to return unique values of.
   */
  export const unique = makeStepFunctionIntegration<
    "partition",
    <T>(arr: T[]) => T[]
  >("partition", {
    asl(call, context) {
      return { jsonPath: "$" };
    },
  });

  /**
   * Use the `base64Encode` intrinsic function to encode data based on MIME Base64 encoding scheme.
   * You can use this function to pass data to other AWS services without using an AWS Lambda function.
   *
   * @param data - String to encode as base64. Up to 10000 characters.
   */
  export const base64Encode = makeStepFunctionIntegration<
    "partition",
    (data: string) => string
  >("partition", {
    asl(call, context) {
      return { jsonPath: "$" };
    },
  });

  /**
   * Use the base64Decode intrinsic function to decode data based on MIME Base64 decoding scheme.
   * You can use this function to pass data to other AWS services without using a Lambda function.
   *
   * This function takes a data string of up to 10,000 characters to encode as its only argument.
   *
   * @param base64 - Base64 string to decode.
   */
  export const base64Decode = makeStepFunctionIntegration<
    "partition",
    (base64: string) => string
  >("partition", {
    asl(call, context) {
      return { jsonPath: "$" };
    },
  });
}

/**
 * Data types allowed as a Step Function Cause.
 */
export type StepFunctionCause =
  | null
  | boolean
  | number
  | string
  | StepFunctionCause[]
  | {
      [prop: string]: StepFunctionCause;
    };

/**
 * An Error that can be thrown from within a {@link StepFunction} or {@link ExpressStepFunction}.
 *
 * It encodes a `Fail` state in ASL.
 * ```json
 * {
 *   "Type": "Fail",
 *   "Error": <error>,
 *   "Cause": JSON.stringify(<cause>)
 * }
 * ```
 *
 * For example:
 * ```ts
 * throw new StepFunctionError("MyError", { "key": "value"});
 * ```
 *
 * Produces the following Fail state:
 * ```json
 * {
 *   "Type": "Fail",
 *   "Error": "MyError",
 *   "Cause": "{\"key\":\"value\""}"
 * }
 * ```
 */
export class StepFunctionError extends Error {
  static readonly kind = "StepFunctionError";

  public static isConstructor(a: any): a is typeof StepFunctionError {
    return a === StepFunctionError || a?.kind === StepFunctionError.kind;
  }

  constructor(
    /**
     * The name of the Error to place in the Fail state.
     */
    readonly error: string,
    /*
     * A JSON object to be encoded as the `Cause`.
     *
     * Due to limitations in Step Functions, all values in the {@link cause} must be
     * a literal value - no references or calls are allowed.
     *
     * ```ts
     * // valid
     * new StepFunctionError("Error", { data: "prop" })
     * // invalid
     * new StepFunctionError("Error", { data: ref })
     * new StepFunctionError("Error", { data: call() })
     * ```
     */
    readonly cause: StepFunctionCause
  ) {
    super();
  }
}

function makeStepFunctionIntegration<K extends string, F extends AnyFunction>(
  methodName: K,
  integration: Omit<IntegrationInput<`$SFN.${K}`, F>, "kind">
) {
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
      (input: CallIn) => Promise<CallOut>,
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
  readonly __functionBrand: (input: CallIn) => Promise<CallOut>;

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
            return `"${argName}":${context.stringify(argVal)}`;
          } else {
            return `"${argName}":${context.exprToJson(argVal)}`;
          }
        })
        .join(",")}\n}`;
    },

    createIntegration: (options) => {
      const credentialsRole = options.credentialsRole;

      this.resource.grantRead(credentialsRole);
      if (
        this.resource.stateMachineType ===
        aws_stepfunctions.StateMachineType.EXPRESS
      ) {
        this.resource.grantStartSyncExecution(credentialsRole);
      } else {
        this.resource.grantStartExecution(credentialsRole);
      }

      return new aws_apigateway.AwsIntegration({
        service: "states",
        action:
          this.resource.stateMachineType ===
          aws_stepfunctions.StateMachineType.EXPRESS
            ? "StartSyncExecution"
            : "StartExecution",
        integrationHttpMethod: "POST",
        options: {
          ...options,
          credentialsRole,
          passthroughBehavior: aws_apigateway.PassthroughBehavior.NEVER,
        },
      });
    },
  };

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

    const inputs = {
      Input: input,
      Name: name,
      TraceHeader: traceHeader,
    };

    return context.evalContext(call, ({ evalExprToJsonPathOrLiteral }) => {
      // evaluate each of the input expressions,
      // returning an object assignment with the output value { input.$: $.inputLocation }
      // and a state object containing the output and/or a sub-state with additional required nodes to add to the
      // machine
      const evalInputs = Object.fromEntries(
        Object.entries(inputs)
          .filter(([, expr]) => !!expr)
          .flatMap(([key, expr]) =>
            Object.entries(
              ASLGraph.jsonAssignment(key, evalExprToJsonPathOrLiteral(expr!))
            )
          )
      );

      return context.stateWithHeapOutput({
        Type: "Task",
        Resource: `arn:aws:states:::aws-sdk:sfn:${
          this.resource.stateMachineType ===
          aws_stepfunctions.StateMachineType.EXPRESS
            ? "startSyncExecution"
            : "startExecution"
        }`,
        Parameters: {
          StateMachineArn: this.resource.stateMachineArn,
          ...evalInputs,
        },
        Next: ASLGraph.DeferNext,
      });
    });
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
  const arg = call.args[0]?.expr;

  if (!arg || !isObjectLiteralExpr(arg)) {
    throw Error(
      "Step function invocation must use a single, inline object parameter. Variable references are not supported currently."
    );
  } else if (
    arg.properties.some(
      (x) => isSpreadAssignExpr(x) || isComputedPropertyNameExpr(x.name)
    )
  ) {
    throw Error(
      "Step function invocation must use a single, inline object instantiated without computed or spread keys."
    );
  }

  const [name, traceHeader, input] = ["name", "traceHeader", "input"].map(
    (name) => {
      const prop = arg.getProperty(name);
      if (
        prop &&
        (isGetAccessorDecl(prop) ||
          isSetAccessorDecl(prop) ||
          isMethodDecl(prop))
      ) {
        throw new SynthError(
          ErrorCodes.Unsupported_Feature,
          `${prop.kindName} is not suppported by Step Functions`
        );
      }
      return prop?.expr;
    }
  );

  // we know the keys cannot be computed, so it is safe to use getProperty
  return {
    name,
    traceHeader,
    input,
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
 *     Table: table,
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
    (input: StepFunctionRequest<Payload>) => Promise<SyncExecutionResult<Out>>
  >;

  constructor(machine: aws_stepfunctions.StateMachine) {
    super(machine);

    const stateMachineArn = this.resource.stateMachineArn;

    this.native = {
      bind: (context) => {
        this.resource.grantStartSyncExecution(context.resource);
      },
      preWarm(preWarmContext) {
        preWarmContext.getOrInit(PrewarmClients.StepFunctions);
      },
      call: async (args, prewarmContext) => {
        const stepFunctionsClient = prewarmContext.getOrInit<StepFunctions>(
          PrewarmClients.StepFunctions
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
 *     Table: table,
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
    func: StepFunctionClosure<Payload, Out>
  );
  constructor(
    scope: Construct,
    id: string,
    func: StepFunctionClosure<Payload, Out>
  );
  constructor(
    scope: Construct,
    id: string,
    ...args:
      | [props: StepFunctionProps, func: StepFunctionClosure<Payload, Out>]
      | [func: StepFunctionClosure<Payload, Out>]
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
  (input: StepFunctionRequest<Payload>): Promise<SyncExecutionResult<Out>>;
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
 *     Table: table,
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
    ) => Promise<AWS.StepFunctions.StartExecutionOutput>,
    EventBusTargetIntegration<
      Payload,
      StepFunctionEventBusTargetProps | undefined
    >
  > {
  describeExecution: IntegrationCall<
    "StepFunction.describeExecution",
    (executionArn: string) => Promise<AWS.StepFunctions.DescribeExecutionOutput>
  >;

  (
    input: StepFunctionRequest<Payload>
  ): Promise<AWS.StepFunctions.StartExecutionOutput>;
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
    ) => Promise<AWS.StepFunctions.StartExecutionOutput>
  >;

  constructor(resource: aws_stepfunctions.StateMachine) {
    super(resource);

    const stateMachineArn = this.resource.stateMachineArn;

    this.native = {
      bind: (context) => {
        this.resource.grantStartExecution(context.resource);
      },
      preWarm(preWarmContext) {
        preWarmContext.getOrInit(PrewarmClients.StepFunctions);
      },
      call: async (args, prewarmContext) => {
        const stepFunctionsClient = prewarmContext.getOrInit<StepFunctions>(
          PrewarmClients.StepFunctions
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
    (executionArn: string) => Promise<AWS.StepFunctions.DescribeExecutionOutput>
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
        call.args[0]?.expr,
        "Describe Execution requires a single string argument."
      );

      return context.evalExprToJsonPathOrLiteral(executionArnExpr, (output) => {
        return context.stateWithHeapOutput({
          Type: "Task",
          Resource: "arn:aws:states:::aws-sdk:sfn:describeExecution",
          Parameters: ASLGraph.jsonAssignment("ExecutionArn", output),
          Next: ASLGraph.DeferNext,
        });
      });
    },
    native: {
      bind: (context) => this.resource.grantRead(context.resource),
      preWarm(prewarmContext) {
        prewarmContext.getOrInit(PrewarmClients.StepFunctions);
      },
      call: async (args, prewarmContext) => {
        const stepFunctionClient = prewarmContext.getOrInit<StepFunctions>(
          PrewarmClients.StepFunctions
        );

        const [arn] = args;

        return stepFunctionClient
          .describeExecution({
            executionArn: arn,
          })
          .promise();
      },
    },
  });
}

interface BaseStandardStepFunction<
  Payload extends Record<string, any> | undefined,
  Out
> {
  (
    input: StepFunctionRequest<Payload>
  ): Promise<AWS.StepFunctions.StartExecutionOutput>;
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
 *     Table: table,
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
    func: StepFunctionClosure<Payload, Out>
  );

  constructor(
    scope: Construct,
    id: string,
    func: StepFunctionClosure<Payload, Out>
  );

  constructor(
    scope: Construct,
    id: string,
    ...args:
      | [props: StepFunctionProps, func: StepFunctionClosure<Payload, Out>]
      | [func: StepFunctionClosure<Payload, Out>]
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
    | [props: StepFunctionProps, func: StepFunctionClosure<Payload, Out>]
    | [func: StepFunctionClosure<Payload, Out>]
) {
  const props =
    isFunctionLike(args[0]) || isErr(args[0]) || typeof args[0] === "function"
      ? {}
      : args[0];
  const func = validateFunctionLike(
    args.length > 1 ? args[1] : args[0],
    "StepFunction"
  );

  return [props, func] as const;
}

function synthesizeStateMachine(
  scope: Construct,
  id: string,
  decl: FunctionLike,
  props: StepFunctionProps & {
    stateMachineType: aws_stepfunctions.StateMachineType;
  }
): [StateMachine<States>, aws_stepfunctions.StateMachine] {
  const machine = new aws_stepfunctions.StateMachine(scope, id, {
    ...props,
    definition: new aws_stepfunctions.Pass(scope, "dummy"),
  });

  try {
    const definition = new ASL(scope, machine.role, decl).definition;

    const resource = machine.node.findChild(
      "Resource"
    ) as aws_stepfunctions.CfnStateMachine;

    resource.definitionString = Stack.of(resource).toJsonString(definition);

    return [definition, machine];
  } catch (e) {
    throw e;
  } finally {
    // remove the dummy pass node because we don't need it.
    scope.node.tryRemoveChild("dummy");
  }
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
  const executionArn = call.args[0];
  if (executionArn === undefined) {
    throw new Error("missing argument 'executionArn'");
  }
  return executionArn;
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
