import { Construct } from "constructs";
import {
  aws_stepfunctions,
  RemovalPolicy,
  ResourceEnvironment,
  Stack,
} from "aws-cdk-lib";

import { FunctionDecl, isFunctionDecl } from "./declaration";
import { AnyFunction } from "./function";
import { ASL, isASL } from "./asl";
import { isVTL, VTL } from "./vtl";
import { MetricOptions, Metric } from "aws-cdk-lib/aws-cloudwatch";
import { IGrantable, Grant, IPrincipal } from "aws-cdk-lib/aws-iam";
import { makeCallable } from "./callable";
import { CallExpr } from "./expression";

export type AnyStepFunction =
  | ExpressStepFunction<AnyFunction>
  | StepFunction<AnyFunction>;

class BaseStepFunction<F extends AnyFunction>
  extends Construct
  implements aws_stepfunctions.IStateMachine
{
  readonly kind = "StepFunction";

  readonly decl: FunctionDecl<F>;
  readonly machine: aws_stepfunctions.StateMachine;

  // @ts-ignore
  readonly __functionBrand: F;

  readonly stack: Stack;
  readonly env: ResourceEnvironment;
  readonly grantPrincipal: IPrincipal;
  readonly stateMachineArn: string;

  readonly resource: this;

  constructor(scope: Construct, id: string, props: StepFunctionProps, func: F);

  constructor(scope: Construct, id: string, func: F);

  constructor(
    scope: Construct,
    id: string,
    ...args:
      | [props: StepFunctionProps, func: FunctionDecl<F>]
      | [func: FunctionDecl<F>]
  ) {
    super(scope, id);
    this.resource = this;
    this.decl = isFunctionDecl(args[0]) ? args[0] : args[1]!;
    const props = isFunctionDecl(args[0]) ? undefined : args[0];
    this.machine = new aws_stepfunctions.StateMachine(this, "Machine", {
      ...props,
      definition: new ASL(this).evalStmt(this.decl.body),
    });
    this.grantPrincipal = this.machine.grantPrincipal;
    this.stack = this.machine.stack;
    this.env = this.machine.env;
    this.stateMachineArn = this.machine.stateMachineArn;

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

  grantStartExecution(identity: IGrantable): Grant {
    return this.machine.grantStartExecution(identity);
  }
  grantStartSyncExecution(identity: IGrantable): Grant {
    return this.machine.grantStartSyncExecution(identity);
  }
  grantRead(identity: IGrantable): Grant {
    return this.machine.grantRead(identity);
  }
  grantTaskResponse(identity: IGrantable): Grant {
    return this.machine.grantTaskResponse(identity);
  }
  grantExecution(identity: IGrantable, ...actions: string[]): Grant {
    return this.machine.grantExecution(identity, ...actions);
  }
  grant(identity: IGrantable, ...actions: string[]): Grant {
    return this.machine.grant(identity, ...actions);
  }
  metric(metricName: string, props?: MetricOptions): Metric {
    return this.machine.metric(metricName, props);
  }
  metricFailed(props?: MetricOptions): Metric {
    return this.machine.metricFailed(props);
  }
  metricThrottled(props?: MetricOptions): Metric {
    return this.machine.metricThrottled(props);
  }
  metricAborted(props?: MetricOptions): Metric {
    return this.machine.metricAborted(props);
  }
  metricSucceeded(props?: MetricOptions): Metric {
    return this.machine.metricSucceeded(props);
  }
  metricTimedOut(props?: MetricOptions): Metric {
    return this.machine.metricTimedOut(props);
  }
  metricStarted(props?: MetricOptions): Metric {
    return this.machine.metricStarted(props);
  }
  metricTime(props?: MetricOptions): Metric {
    return this.machine.metricTime(props);
  }
  applyRemovalPolicy(policy: RemovalPolicy): void {
    return this.machine.applyRemovalPolicy(policy);
  }
}

export interface StepFunctionProps
  extends Omit<
    aws_stepfunctions.StateMachineProps,
    "definition" | "stateMachineName" | "stateMachineType"
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
