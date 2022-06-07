import * as appsync from "@aws-cdk/aws-appsync-alpha";
import {
  Arn,
  ArnFormat,
  aws_cloudwatch,
  aws_events_targets,
  aws_iam,
  aws_stepfunctions,
  Resource,
  Stack,
  Token,
} from "aws-cdk-lib";
// eslint-disable-next-line import/no-extraneous-dependencies
import { StepFunctions } from "aws-sdk";
import { Construct } from "constructs";
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
  isFunctionDeclOrErr,
} from "./declaration";
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
import { NativeIntegration, PrewarmClients } from "./function";
import { Integration, IntegrationInput, makeIntegration } from "./integration";
import { AnyFunction, ensureItemOf } from "./util";
import { VTL } from "./vtl";

export type AnyStepFunction =
  | ExpressStepFunction<any, any>
  | StepFunction<any, any>;

export type StepFunctionClosure<
  P extends Record<string, any> | undefined,
  O
> = (arg: P) => Promise<O> | O;

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
      callbackfn: (item: T, index: number, array: T[]) => Promise<void>
    ): Promise<void>;
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
      callbackfn: (item: T, index: number, array: T[]) => Promise<void> | void
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

interface StepFunctionStatusChangedEvent
  extends Event<
    StepFunctionDetail,
    "Step Functions Execution Status Change",
    "aws.states"
  > {}

interface StepFunctionEventBusTargetProps
  extends Omit<aws_events_targets.SfnStateMachineProps, "input"> {}

abstract class BaseStepFunction<
    P extends Record<string, any> | undefined,
    O,
    CallIn,
    CallOut
  >
  extends Resource
  implements
    aws_stepfunctions.IStateMachine,
    Integration<
      "StepFunction",
      (input: CallIn) => Promise<CallOut>,
      EventBusTargetIntegration<P, StepFunctionEventBusTargetProps | undefined>
    >
{
  readonly kind = "StepFunction";
  readonly functionlessKind = "StepFunction";

  readonly decl: FunctionDecl<(arg: P) => O>;
  readonly resource: aws_stepfunctions.CfnStateMachine;

  readonly appSyncVtl: AppSyncVtlIntegration;

  // @ts-ignore
  readonly __functionBrand: (input: CallIn) => Promise<CallOut>;

  readonly stateMachineName: string;
  readonly stateMachineArn: string;
  readonly role: aws_iam.IRole;
  readonly definition: StateMachine<States>;

  /**
   * The principal this state machine is running as
   */
  readonly grantPrincipal;

  constructor(
    scope: Construct,
    id: string,
    props: StepFunctionProps,
    func: StepFunctionClosure<P, O>
  );

  constructor(scope: Construct, id: string, func: StepFunctionClosure<P, O>);

  constructor(
    scope: Construct,
    id: string,
    ...args:
      | [props: StepFunctionProps, func: StepFunctionClosure<P, O>]
      | [func: StepFunctionClosure<P, O>]
  ) {
    const props =
      isFunctionDeclOrErr(args[0]) || typeof args[0] === "function"
        ? undefined
        : args[0];
    if (props?.stateMachineName !== undefined) {
      validateStateMachineName(props.stateMachineName);
    }
    super(scope, id, {
      ...props,
      physicalName: props?.stateMachineName,
    });
    this.decl = validateFunctionDecl(
      isFunctionDeclOrErr(args[0]) ? args[0] : args[1],
      "StepFunction"
    );

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
          context.str(this.stateMachineArn)
        );

        return `{
  "version": "2018-05-29",
  "method": "POST",
  "resourcePath": "/",
  "params": {
    "headers": {
      "content-type": "application/x-amz-json-1.0",
      "x-amz-target": "${
        this.getStepFunctionType() ===
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

  appSyncIntegration(
    integration: Pick<AppSyncVtlIntegration, "request">
  ): AppSyncVtlIntegration {
    return {
      ...integration,
      dataSourceId: () => this.resource.node.addr,
      dataSource: (api, dataSourceId) => {
        const ds = new appsync.HttpDataSource(api, dataSourceId, {
          api,
          endpoint: `https://${
            this.getStepFunctionType() ===
            aws_stepfunctions.StateMachineType.EXPRESS
              ? "sync-states"
              : "states"
          }.${this.resource.stack.region}.amazonaws.com/`,
          authorizationConfig: {
            signingRegion: api.stack.region,
            signingServiceName: "states",
          },
        });

        this.grantRead(ds.grantPrincipal);
        if (
          this.getStepFunctionType() ===
          aws_stepfunctions.StateMachineType.EXPRESS
        ) {
          this.grantStartSyncExecution(ds.grantPrincipal);
        } else {
          this.grantStartExecution(ds.grantPrincipal);
        }
        return ds;
      },
      result: (resultVariable) => {
        const returnValName = "$sfn__result";

        if (
          this.getStepFunctionType() ===
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

  asl(call: CallExpr, context: ASL) {
    this.grantStartExecution(context.role);
    if (
      this.getStepFunctionType() === aws_stepfunctions.StateMachineType.EXPRESS
    ) {
      this.grantStartSyncExecution(context.role);
    }

    const { name, input, traceHeader } = retrieveMachineArgs(call);

    return {
      Type: "Task" as const,
      Resource: `arn:aws:states:::aws-sdk:sfn:${
        this.getStepFunctionType() ===
        aws_stepfunctions.StateMachineType.EXPRESS
          ? "startSyncExecution"
          : "startExecution"
      }`,
      Parameters: {
        StateMachineArn: this.stateMachineArn,
        ...(input ? ASL.toJsonAssignment("Input", input) : {}),
        ...(name ? ASL.toJsonAssignment("Name", name) : {}),
        ...(traceHeader
          ? ASL.toJsonAssignment("TraceHeader", traceHeader)
          : {}),
      },
    };
  }

  public readonly eventBus = makeEventBusIntegration<
    P,
    StepFunctionEventBusTargetProps | undefined
  >({
    target: (props, targetInput) => {
      return new aws_events_targets.SfnStateMachine(this, {
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
            stateMachineArn: { value: this.stateMachineArn },
          },
        },
      },
    };
  }

  public onSucceeded(
    scope: Construct,
    id: string
  ): Rule<StepFunctionStatusChangedEvent> {
    const bus = EventBus.default<StepFunctionStatusChangedEvent>(this);

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
    const bus = EventBus.default<StepFunctionStatusChangedEvent>(this);

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
    const bus = EventBus.default<StepFunctionStatusChangedEvent>(this);

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
    const bus = EventBus.default<StepFunctionStatusChangedEvent>(this);

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
    const bus = EventBus.default<StepFunctionStatusChangedEvent>(this);

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
  onStatusChanged(
    scope: Construct,
    id: string
  ): Rule<StepFunctionStatusChangedEvent> {
    const bus = EventBus.default<StepFunctionStatusChangedEvent>(this);

    // We are not able to use the nice "when" function here because we don't compile
    return new PredicateRuleBase<StepFunctionStatusChangedEvent>(
      scope,
      id,
      bus,
      this.statusChangeEventDocument()
    );
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
   * Rule
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
  P extends Record<string, any> | undefined,
  O
> extends BaseStepFunction<
  P,
  O,
  StepFunctionRequest<P>,
  SyncExecutionResult<O>
> {
  /**
   * This static property identifies this class as an ExpressStepFunction to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "ExpressStepFunction";

  public getStepFunctionType(): aws_stepfunctions.StateMachineType.EXPRESS {
    return aws_stepfunctions.StateMachineType.EXPRESS;
  }

  readonly native: NativeIntegration<
    (input: StepFunctionRequest<P>) => Promise<SyncExecutionResult<O>>
  >;

  constructor(
    scope: Construct,
    id: string,
    props: StepFunctionProps,
    func: StepFunctionClosure<P, O>
  );

  constructor(scope: Construct, id: string, func: StepFunctionClosure<P, O>);

  constructor(
    scope: Construct,
    id: string,
    ...args:
      | [props: StepFunctionProps, func: StepFunctionClosure<P, O>]
      | [func: StepFunctionClosure<P, O>]
  ) {
    super(
      scope,
      id,
      args[0] as any,
      (args.length > 1 ? args[1] : undefined) as any
    );

    const stateMachineArn = this.stateMachineArn;

    this.native = {
      bind: (context) => {
        this.grantStartSyncExecution(context.resource);
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
            } as SyncExecutionSuccessResult<O>);
      },
    };
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
  P extends Record<string, any> | undefined,
  O
> {
  (input: StepFunctionRequest<P>): Promise<SyncExecutionResult<O>>;
}

export class StepFunction<
  P extends Record<string, any> | undefined,
  O
> extends BaseStepFunction<
  P,
  O,
  StepFunctionRequest<P>,
  AWS.StepFunctions.StartExecutionOutput
> {
  /**
   * This static property identifies this class as an StepFunction to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "StepFunction";

  readonly native: NativeIntegration<
    (
      input: StepFunctionRequest<P>
    ) => Promise<AWS.StepFunctions.StartExecutionOutput>
  >;

  constructor(
    scope: Construct,
    id: string,
    props: StepFunctionProps,
    func: StepFunctionClosure<P, O>
  );

  constructor(scope: Construct, id: string, func: StepFunctionClosure<P, O>);

  constructor(
    scope: Construct,
    id: string,
    ...args:
      | [props: StepFunctionProps, func: StepFunctionClosure<P, O>]
      | [func: StepFunctionClosure<P, O>]
  ) {
    super(
      scope,
      id,
      args[0] as any,
      (args.length > 1 ? args[1] : undefined) as any
    );

    const stateMachineArn = this.stateMachineArn;

    this.native = {
      bind: (context) => {
        this.grantStartExecution(context.resource);
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

  public getStepFunctionType(): aws_stepfunctions.StateMachineType.STANDARD {
    return aws_stepfunctions.StateMachineType.STANDARD;
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
      this.grantRead(context.role);

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
      bind: (context) => this.grantRead(context.resource),
      preWarm(prewarmContext) {
        prewarmContext.getOrInit(PrewarmClients.STEP_FUNCTIONS);
      },
      call: async (args, prewarmContext) => {
        const stepFunctionClient = prewarmContext.getOrInit<StepFunctions>(
          PrewarmClients.STEP_FUNCTIONS
        );

        const [arn] = args;

        return stepFunctionClient
          .describeExecution({
            executionArn: arn,
          })
          .promise();
      },
    },
    unhandledContext: (kind, contextKind) => {
      throw new Error(
        `${kind} is only available in the ${ASL.ContextName} and ${VTL.ContextName} context, but was used in ${contextKind}.`
      );
    },
  });
}

export interface StepFunction<P extends Record<string, any> | undefined, O> {
  (
    input: StepFunctionRequest<P>
  ): Promise<AWS.StepFunctions.StartExecutionOutput>;
}

function getArgs(call: CallExpr) {
  const executionArn = call.args[0]?.expr;
  if (executionArn === undefined) {
    throw new Error("missing argument 'executionArn'");
  }
  return executionArn;
}
