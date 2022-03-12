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
import { AnyFunction } from "./function";
import { ASL, isASL } from "./asl";
import { isVTL, VTL } from "./vtl";
import { makeCallable } from "./callable";
import { CallExpr } from "./expression";
import { LogOptions } from "aws-cdk-lib/aws-stepfunctions";

import { StatesMetrics } from "aws-cdk-lib/aws-stepfunctions/lib/stepfunctions-canned-metrics.generated";

export type AnyStepFunction =
  | ExpressStepFunction<AnyFunction>
  | StepFunction<AnyFunction>;

class BaseStepFunction<F extends AnyFunction>
  extends Resource
  implements aws_stepfunctions.IStateMachine
{
  readonly kind = "StepFunction";

  readonly decl: FunctionDecl<F>;
  readonly resource: aws_stepfunctions.CfnStateMachine;

  // @ts-ignore
  readonly __functionBrand: F;

  readonly stateMachineArn: string;
  readonly role: aws_iam.IRole;

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

    const asl = new ASL(this, this.role);

    this.resource = new aws_stepfunctions.CfnStateMachine(this, "Resource", {
      roleArn: this.role.roleArn,
      definition: asl.interpret(this.decl),
      loggingConfiguration: props?.logs
        ? this.buildLoggingConfiguration(props?.logs)
        : undefined,
      tracingConfiguration: props?.tracingEnabled
        ? this.buildTracingConfiguration()
        : undefined,
    });

    this.stateMachineArn = this.resource.attrArn;

    // @ts-ignore
    return makeCallable(this, (call: CallExpr, context: VTL | ASL) => {
      if (isASL(context)) {
      } else if (isVTL(context)) {
        const args = context.var(
          `{${Object.entries(call.args)
            .map(([name, expr]) => `"${name}": ${context.eval(expr)}`)
            .join(",")}}`
        );
        return context.var(
          JSON.stringify(
            {
              version: "2018-05-29",
              method: "POST",
              resourcePath: "/",
              params: {
                headers: {
                  "content-type": "application/x-amz-json-1.0",
                  "x-amz-target": "AWSStepFunctions.StartExecution",
                },
                body: {
                  stateMachineArn: this.stateMachineArn,
                  input: `$util.escapeJavaScript($util.toJson(${args}))`,
                },
              },
            },
            null,
            2
          )
        );
      }
      return;
    });
  }

  /**
   * The principal this state machine is running as
   */
  public get grantPrincipal() {
    return this.role.grantPrincipal;
  }

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
    return this.cannedMetric(StatesMetrics.executionsFailedSum, props);
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
    return this.cannedMetric(StatesMetrics.executionsAbortedSum, props);
  }

  /**
   * Metric for the number of executions that succeeded
   *
   * @default - sum over 5 minutes
   */
  public metricSucceeded(
    props?: aws_cloudwatch.MetricOptions
  ): aws_cloudwatch.Metric {
    return this.cannedMetric(StatesMetrics.executionsSucceededSum, props);
  }

  /**
   * Metric for the number of executions that timed out
   *
   * @default - sum over 5 minutes
   */
  public metricTimedOut(
    props?: aws_cloudwatch.MetricOptions
  ): aws_cloudwatch.Metric {
    return this.cannedMetric(StatesMetrics.executionsTimedOutSum, props);
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
    return this.cannedMetric(StatesMetrics.executionTimeAverage, props);
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
    logOptions: LogOptions
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

export class ExpressStepFunction<
  F extends AnyFunction
> extends BaseStepFunction<F> {
  /**
   * This static property identifies this class as an ExpressStepFunction to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "ExpressStepFunction";
}

export interface ExpressStepFunction<F extends AnyFunction> {
  (...args: Parameters<F>): ReturnType<F>;
  (name: string, traceHeader: string, ...args: Parameters<F>): ReturnType<F>;
  (name: string, ...args: Parameters<F>): ReturnType<F>;
}

export class StepFunction<F extends AnyFunction> extends BaseStepFunction<F> {
  /**
   * This static property identifies this class as an StepFunction to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "StepFunction";
}

export interface StepFunction<F extends AnyFunction> {
  (name: string, ...args: Parameters<F>): CheckStepFunctionStatus<
    ReturnType<F>
  >;
  (
    name: string,
    traceHeader: string,
    ...args: Parameters<F>
  ): CheckStepFunctionStatus<ReturnType<F>>;
  (...args: Parameters<F>): CheckStepFunctionStatus<ReturnType<F>>;
}

export type CheckStepFunctionStatus<T> = () => T;
