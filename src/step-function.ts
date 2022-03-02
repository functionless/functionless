import { Construct } from "constructs";
import { aws_stepfunctions } from "aws-cdk-lib";

import { FunctionDecl } from "./declaration";
import { AnyFunction } from "./function";
import { ASL } from "./asl";
import { CallExpr } from ".";
import { VTL } from "./vtl";

class BaseStepFunction<F extends AnyFunction> {
  readonly decl: FunctionDecl<F>;
  constructor(
    // @ts-ignore
    fn: F,
    readonly stateMachineType?: aws_stepfunctions.StateMachineType
  ) {
    this.decl = fn as unknown as FunctionDecl<F>;
  }

  public createStateMachine(
    scope: Construct,
    id: string,
    props?: Omit<
      aws_stepfunctions.StateMachineProps,
      "definition" | "stateMachineType"
    >
  ): aws_stepfunctions.StateMachine {
    return new aws_stepfunctions.StateMachine(scope, id, {
      ...props,
      definition: this.createDefinition(scope),
      stateMachineType: this.stateMachineType,
    });
  }

  public createDefinition(scope: Construct): aws_stepfunctions.IChainable {
    return new ASL(scope).evalStmt(this.decl.body);
  }
}

export class ExpressStepFunction<
  F extends AnyFunction
> extends BaseStepFunction<F> {
  constructor(fn: F) {
    super(fn, aws_stepfunctions.StateMachineType.EXPRESS);

    const obj = Object.assign(stepFunction, this) as any;
    obj.createStateMachine = this.createStateMachine.bind(this);
    obj.createDefinition = this.createDefinition.bind(this);
    return obj;

    // @ts-ignore
    function stepFunction(call: CallExpr, context: VTL | ASL) {
      if (context.kind === "ASL") {
      } else {
      }
      return;
    }
  }
}

export interface ExpressStepFunction<F extends AnyFunction> {
  (name: string, ...args: Parameters<F>): ReturnType<F>;
  (name: string, traceHeader: string, ...args: Parameters<F>): ReturnType<F>;
  (...args: Parameters<F>): ReturnType<F>;
}

export class StepFunction<
  F extends AnyFunction
> extends BaseStepFunction<F> {}
