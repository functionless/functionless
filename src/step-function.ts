import { Construct } from "constructs";
import {
  Arn,
  ArnFormat,
  aws_cloudwatch,
  aws_iam,
  aws_stepfunctions,
  Resource,
  Stack,
  Token,
} from "aws-cdk-lib";

import { FunctionDecl, isFunctionDecl } from "./declaration";
import {
  ASL,
  isASL,
  isMapOrForEach,
  MapTask,
  ParallelTask,
  StateMachine,
  States,
  Wait,
} from "./asl";
import { isVTL } from "./vtl";
import { makeCallable } from "./callable";
import { CallExpr, isFunctionExpr } from "./expression";
import { AnyFunction, ensureItemOf } from "./util";
import { CallContext } from "./context";

export type AnyStepFunction =
  | ExpressStepFunction<AnyFunction>
  | StepFunction<AnyFunction>;

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
  // @ts-ignore
  export function waitFor(seconds: number): void;

  export function waitFor(call: CallExpr, context: CallContext): Wait {
    if (context.kind !== ASL.ContextName) {
      throw new Error(
        `$SFN.wait is only available in the ${ASL.ContextName} context`
      );
    }
    const seconds = call.args[0].expr;
    if (seconds === undefined) {
      throw new Error(`the 'seconds' argument is required`);
    }

    if (seconds.kind === "NumberLiteralExpr") {
      return {
        Type: "Wait",
        Seconds: seconds.value,
      };
    } else {
      return {
        Type: "Wait",
        SecondsPath: ASL.toJsonPath(seconds),
      };
    }
  }

  /**
   * Wait until a {@link timestamp}.
   *
   * ```ts
   * new ExpressStepFunction(this, "F", (timestamp: string) => $SFN.waitUntil(timestamp))
   * ```
   *
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html
   */
  // @ts-ignore
  export function waitUntil(timestamp: string): void;

  export function waitUntil(call: CallExpr, context: CallContext): Wait {
    if (context.kind !== ASL.ContextName) {
      throw new Error(
        `$SFN.wait is only available in the ${ASL.ContextName} context`
      );
    }
    const timestamp = call.args[0]?.expr;
    if (timestamp === undefined) {
      throw new Error(`the 'timestamp' argument is required`);
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
  }

  /**
   * Process each item in an {@link array} in parallel and run with the default maxConcurrency.
   *
   * Example:
   * ```ts
   * new ExpressStepFunction(this, "F", (items: string[]) => {
   *   $SFN.forEach(items, item => task(item))
   * });
   * ```
   *
   * @param array the list of items to process
   * @param props configure the maxConcurrency
   * @param callbackfn function to process each item
   */
  // @ts-ignore
  export function forEach<T>(
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
  // @ts-ignore
  export function forEach<T>(
    array: T[],
    props: {
      maxConcurrency: number;
    },
    callbackfn: (item: T, index: number, array: T[]) => void
  ): void;

  export function forEach(call: CallExpr, context: CallContext): MapTask {
    return mapOrForEach("forEach", call, context);
  }

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
  // @ts-ignore
  export function map<T, U>(
    array: T[],
    callbackfn: (item: T, index: number, array: T[]) => U
  ): U[];

  /**
   * Map over each item in an {@link array} in parallel and run with a maxConcurrency of {@link props}.maxConcurrency
   *
   * Example:
   * ```ts
   * new ExpressStepFunction(this, "F",  (items: string[]) => {
   *   return $SFN.map(items, { maxConcurrency: 2 }, item => task(item))
   * });
   * ```
   *
   * @param array the list of items to map over
   * @param props configure the maxConcurrency
   * @param callbackfn function to process each item
   * @returns an array containing the result of each mapped item
   */
  export function map<T, U>(
    array: T[],
    props: {
      maxConcurrency: number;
    },
    callbackfn: (item: T, index: number, array: T[]) => U
  ): U[];

  export function map(call: CallExpr, context: CallContext): MapTask {
    return mapOrForEach("map", call, context);
  }

  function mapOrForEach(
    kind: "map" | "forEach",
    call: CallExpr,
    context: CallContext
  ): MapTask {
    if (context.kind !== ASL.ContextName) {
      throw new Error(`$SFN.${kind} is only supported by ${ASL.ContextName}`);
    }

    if (isMapOrForEach(call)) {
      const callbackfn = call.getArgument("callbackfn")?.expr;
      if (callbackfn === undefined || callbackfn.kind !== "FunctionExpr") {
        throw new Error(`missing callbackfn in $SFN.map`);
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
              throw new Error(`maxConcurrency must be > 0`);
            }
          } else {
            throw new Error(
              `property 'maxConcurrency' must be a NumberLiteralExpr`
            );
          }
        } else {
          throw new Error(`argument 'props' must be an ObjectLiteralExpr`);
        }
      }
      const array = call.getArgument("array")?.expr;
      if (array === undefined) {
        throw new Error(`missing argument 'array'`);
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
    throw new Error(`invalid arguments to $SFN.map`);
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
  // @ts-ignore
  export function parallel<Paths extends readonly (() => any)[]>(
    ...paths: Paths
  ): {
    [i in keyof Paths]: i extends `${number}`
      ? ReturnType<Extract<Paths[i], () => any>>
      : Paths[i];
  };

  export function parallel(call: CallExpr, context: CallContext): ParallelTask {
    if (context.kind !== ASL.ContextName) {
      throw new Error(`$SFN.${kind} is only supported by ${ASL.ContextName}`);
    }
    const paths = call.getArgument("paths")?.expr;
    if (paths === undefined) {
      throw new Error("missing required argument 'paths'");
    }
    if (paths.kind !== "ArrayLiteralExpr") {
      throw new Error(`invalid arguments to $SFN.parallel`);
    }
    ensureItemOf(
      paths.items,
      isFunctionExpr,
      `each parallel path must be an inline FunctionExpr`
    );

    return {
      Type: "Parallel",
      Branches: paths.items.map((func) => ({
        StartAt: context.getStateName(func.body.step()!),
        States: context.execute(func.body),
      })),
    };
  }
}

abstract class BaseStepFunction<F extends AnyFunction>
  extends Resource
  implements aws_stepfunctions.IStateMachine
{
  readonly kind = "StepFunction";

  readonly decl: FunctionDecl<F>;
  readonly resource: aws_stepfunctions.CfnStateMachine;

  // @ts-ignore
  readonly __functionBrand: F;

  readonly stateMachineName: string;
  readonly stateMachineArn: string;
  readonly role: aws_iam.IRole;
  readonly definition: StateMachine<States>;

  /**
   * The principal this state machine is running as
   */
  readonly grantPrincipal;

  constructor(scope: Construct, id: string, props: StepFunctionProps, func: F);

  constructor(scope: Construct, id: string, func: F);

  constructor(
    scope: Construct,
    id: string,
    ...args:
      | [props: StepFunctionProps, func: FunctionDecl<F>]
      | [func: FunctionDecl<F>]
  ) {
    const props = isFunctionDecl(args[0]) ? undefined : args[0];
    if (props?.stateMachineName !== undefined) {
      validateStateMachineName(props.stateMachineName);
    }
    super(scope, id, {
      ...props,
      physicalName: props?.stateMachineName,
    });
    this.decl = isFunctionDecl(args[0]) ? args[0] : args[1]!;

    this.role =
      props?.role ??
      new aws_iam.Role(this, "Role", {
        assumedBy: new aws_iam.ServicePrincipal("states.amazonaws.com"),
      });

    this.grantPrincipal = this.role.grantPrincipal;

    this.definition = new ASL(this, this.role, this.decl).definition;

    this.resource = new aws_stepfunctions.CfnStateMachine(this, "Resource", {
      roleArn: this.role.roleArn,
      definitionString: JSON.stringify(this.definition),
      stateMachineType: this.getStepFunctionType(),
      loggingConfiguration: props?.logs
        ? this.buildLoggingConfiguration(props?.logs)
        : undefined,
      tracingConfiguration: props?.tracingEnabled
        ? this.buildTracingConfiguration()
        : undefined,
    });
    // required or else adding logs can fail due invalid IAM policy
    this.resource.node.addDependency(this.role);

    this.stateMachineName = this.resource.attrName;
    this.stateMachineArn = this.resource.attrArn;

    return makeCallable(this, (call: CallExpr, context: CallContext) => {
      if (isASL(context)) {
        // TODO
      } else if (isVTL(context)) {
        const args = context.var(
          `{${call.args
            .map((arg) => `"${arg.name}": ${context.eval(arg.expr)}`)
            .join(",")}}`
        );
        return JSON.stringify(
          {
            version: "2018-05-29",
            method: "POST",
            resourcePath: "/",
            params: {
              headers: {
                "content-type": "application/x-amz-json-1.0",
                "x-amz-target":
                  this.getStepFunctionType() ===
                  aws_stepfunctions.StateMachineType.EXPRESS
                    ? "AWSStepFunctions.StartSyncExecution"
                    : "AWSStepFunctions.StartExecution",
              },
              body: {
                stateMachineArn: this.stateMachineArn,
                input: `$util.escapeJavaScript($util.toJson(${args}))`,
              },
            },
          },
          null,
          2
        );
      }
      return;
    });
  }

  public abstract getStepFunctionType(): aws_stepfunctions.StateMachineType;

  /**
   * Add the given statement to the role's policy
   */
  public addToRolePolicy(statement: aws_iam.PolicyStatement) {
    this.role.addToPrincipalPolicy(statement);
  }

  /**
   * Grant the given identity permissions to start an execution of this state
   * machine.
   */
  public grantStartExecution(identity: aws_iam.IGrantable): aws_iam.Grant {
    return aws_iam.Grant.addToPrincipal({
      grantee: identity,
      actions: ["states:StartExecution"],
      resourceArns: [this.stateMachineArn],
    });
  }

  /**
   * Grant the given identity permissions to start a synchronous execution of
   * this state machine.
   */
  public grantStartSyncExecution(identity: aws_iam.IGrantable): aws_iam.Grant {
    return aws_iam.Grant.addToPrincipal({
      grantee: identity,
      actions: ["states:StartSyncExecution"],
      resourceArns: [this.stateMachineArn],
    });
  }

  /**
   * Grant the given identity permissions to read results from state
   * machine.
   */
  public grantRead(identity: aws_iam.IGrantable): aws_iam.Grant {
    aws_iam.Grant.addToPrincipal({
      grantee: identity,
      actions: ["states:ListExecutions", "states:ListStateMachines"],
      resourceArns: [this.stateMachineArn],
    });
    aws_iam.Grant.addToPrincipal({
      grantee: identity,
      actions: [
        "states:DescribeExecution",
        "states:DescribeStateMachineForExecution",
        "states:GetExecutionHistory",
      ],
      resourceArns: [`${this.executionArn()}:*`],
    });
    return aws_iam.Grant.addToPrincipal({
      grantee: identity,
      actions: [
        "states:ListActivities",
        "states:DescribeStateMachine",
        "states:DescribeActivity",
      ],
      resourceArns: ["*"],
    });
  }

  /**
   * Grant the given identity task response permissions on a state machine
   */
  public grantTaskResponse(identity: aws_iam.IGrantable): aws_iam.Grant {
    return aws_iam.Grant.addToPrincipal({
      grantee: identity,
      actions: [
        "states:SendTaskSuccess",
        "states:SendTaskFailure",
        "states:SendTaskHeartbeat",
      ],
      resourceArns: [this.stateMachineArn],
    });
  }

  /**
   * Grant the given identity permissions on all executions of the state machine
   */
  public grantExecution(identity: aws_iam.IGrantable, ...actions: string[]) {
    return aws_iam.Grant.addToPrincipal({
      grantee: identity,
      actions,
      resourceArns: [`${this.executionArn()}:*`],
    });
  }

  /**
   * Grant the given identity custom permissions
   */
  public grant(
    identity: aws_iam.IGrantable,
    ...actions: string[]
  ): aws_iam.Grant {
    return aws_iam.Grant.addToPrincipal({
      grantee: identity,
      actions,
      resourceArns: [this.stateMachineArn],
    });
  }

  /**
   * Return the given named metric for this State Machine's executions
   *
   * @default - sum over 5 minutes
   */
  public metric(
    metricName: string,
    props?: aws_cloudwatch.MetricOptions
  ): aws_cloudwatch.Metric {
    return new aws_cloudwatch.Metric({
      namespace: "AWS/States",
      metricName,
      dimensionsMap: { StateMachineArn: this.stateMachineArn },
      statistic: "sum",
      ...props,
    }).attachTo(this);
  }

  /**
   * Metric for the number of executions that failed
   *
   * @default - sum over 5 minutes
   */
  public metricFailed(
    props?: aws_cloudwatch.MetricOptions
  ): aws_cloudwatch.Metric {
    return this.cannedMetric(
      (dimensions) => ({
        namespace: "AWS/States",
        metricName: "ExecutionsFailed",
        dimensionsMap: dimensions,
        statistic: "Sum",
      }),
      props
    );
  }

  /**
   * Metric for the number of executions that were throttled
   *
   * @default - sum over 5 minutes
   */
  public metricThrottled(
    props?: aws_cloudwatch.MetricOptions
  ): aws_cloudwatch.Metric {
    // There's a typo in the "canned" version of this
    return this.metric("ExecutionThrottled", props);
  }

  /**
   * Metric for the number of executions that were aborted
   *
   * @default - sum over 5 minutes
   */
  public metricAborted(
    props?: aws_cloudwatch.MetricOptions
  ): aws_cloudwatch.Metric {
    return this.cannedMetric(
      (dimensions) => ({
        namespace: "AWS/States",
        metricName: "ExecutionsAborted",
        dimensionsMap: dimensions,
        statistic: "Sum",
      }),
      props
    );
  }

  /**
   * Metric for the number of executions that succeeded
   *
   * @default - sum over 5 minutes
   */
  public metricSucceeded(
    props?: aws_cloudwatch.MetricOptions
  ): aws_cloudwatch.Metric {
    return this.cannedMetric(
      (dimensions) => ({
        namespace: "AWS/States",
        metricName: "ExecutionsSucceeded",
        dimensionsMap: dimensions,
        statistic: "Sum",
      }),
      props
    );
  }

  /**
   * Metric for the number of executions that timed out
   *
   * @default - sum over 5 minutes
   */
  public metricTimedOut(
    props?: aws_cloudwatch.MetricOptions
  ): aws_cloudwatch.Metric {
    return this.cannedMetric(
      (dimensions) => ({
        namespace: "AWS/States",
        metricName: "ExecutionsTimedOut",
        dimensionsMap: dimensions,
        statistic: "Sum",
      }),
      props
    );
  }

  /**
   * Metric for the number of executions that were started
   *
   * @default - sum over 5 minutes
   */
  public metricStarted(
    props?: aws_cloudwatch.MetricOptions
  ): aws_cloudwatch.Metric {
    return this.metric("ExecutionsStarted", props);
  }

  /**
   * Metric for the interval, in milliseconds, between the time the execution starts and the time it closes
   *
   * @default - average over 5 minutes
   */
  public metricTime(
    props?: aws_cloudwatch.MetricOptions
  ): aws_cloudwatch.Metric {
    return this.cannedMetric(
      (dimensions) => ({
        namespace: "AWS/States",
        metricName: "ExecutionTime",
        dimensionsMap: dimensions,
        statistic: "Average",
      }),
      props
    );
  }

  /**
   * Returns the pattern for the execution ARN's of the state machine
   */
  private executionArn(): string {
    return Stack.of(this).formatArn({
      resource: "execution",
      service: "states",
      resourceName: Arn.split(
        this.stateMachineArn,
        ArnFormat.COLON_RESOURCE_NAME
      ).resourceName,
      arnFormat: ArnFormat.COLON_RESOURCE_NAME,
    });
  }

  private cannedMetric(
    fn: (dims: { StateMachineArn: string }) => aws_cloudwatch.MetricProps,
    props?: aws_cloudwatch.MetricOptions
  ): aws_cloudwatch.Metric {
    return new aws_cloudwatch.Metric({
      ...fn({ StateMachineArn: this.stateMachineArn }),
      ...props,
    }).attachTo(this);
  }

  private buildLoggingConfiguration(
    logOptions: aws_stepfunctions.LogOptions
  ): aws_stepfunctions.CfnStateMachine.LoggingConfigurationProperty {
    // https://docs.aws.amazon.com/step-functions/latest/dg/cw-logs.html#cloudwatch-iam-policy
    this.addToRolePolicy(
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups",
        ],
        resources: ["*"],
      })
    );

    return {
      destinations: [
        {
          cloudWatchLogsLogGroup: {
            logGroupArn: logOptions.destination.logGroupArn,
          },
        },
      ],
      includeExecutionData: logOptions.includeExecutionData,
      level: logOptions.level || "ERROR",
    };
  }

  private buildTracingConfiguration(): aws_stepfunctions.CfnStateMachine.TracingConfigurationProperty {
    this.addToRolePolicy(
      new aws_iam.PolicyStatement({
        // https://docs.aws.amazon.com/xray/latest/devguide/security_iam_id-based-policy-examples.html#xray-permissions-resources
        // https://docs.aws.amazon.com/step-functions/latest/dg/xray-iam.html
        actions: [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
        ],
        resources: ["*"],
      })
    );

    return {
      enabled: true,
    };
  }
}

function validateStateMachineName(stateMachineName: string) {
  if (!Token.isUnresolved(stateMachineName)) {
    if (stateMachineName.length < 1 || stateMachineName.length > 80) {
      throw new Error(
        `State Machine name must be between 1 and 80 characters. Received: ${stateMachineName}`
      );
    }

    if (!stateMachineName.match(/^[a-z0-9\+\!\@\.\(\)\-\=\_\']+$/i)) {
      throw new Error(
        `State Machine name must match "^[a-z0-9+!@.()-=_']+$/i". Received: ${stateMachineName}`
      );
    }
  }
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
 * const table = new f.Function<string, number>(new aws_lambda.Function(..))
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
  F extends AnyFunction
> extends BaseStepFunction<F> {
  /**
   * This static property identifies this class as an ExpressStepFunction to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "ExpressStepFunction";

  public getStepFunctionType(): aws_stepfunctions.StateMachineType.EXPRESS {
    return aws_stepfunctions.StateMachineType.EXPRESS;
  }
}

interface BaseSyncExecutionResult {
  billingDetails: {
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

export interface ExpressStepFunction<F extends AnyFunction> {
  (...args: Parameters<F>): SyncExecutionResult<ReturnType<F>>;
  (
    name: string,
    traceHeader: string,
    ...args: Parameters<F>
  ): SyncExecutionResult<ReturnType<F>>;
  (name: string, ...args: Parameters<F>): SyncExecutionResult<ReturnType<F>>;
}

export class StepFunction<F extends AnyFunction> extends BaseStepFunction<F> {
  /**
   * This static property identifies this class as an StepFunction to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "StepFunction";

  public getStepFunctionType(): aws_stepfunctions.StateMachineType.STANDARD {
    return aws_stepfunctions.StateMachineType.STANDARD;
  }
}

export interface StepFunction<F extends AnyFunction> {
  (
    name: string,
    ...args: Parameters<F>
  ): AWS.StepFunctions.StartExecutionOutput;
  (
    name: string,
    traceHeader: string,
    ...args: Parameters<F>
  ): AWS.StepFunctions.StartExecutionOutput;
  (...args: Parameters<F>): AWS.StepFunctions.StartExecutionOutput;
}
