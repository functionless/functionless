import { aws_events } from "aws-cdk-lib";
import { FunctionDecl } from "../declaration";
import { synthesizeEventBridgeTargets } from "./target-input";
import { IFunction } from "../function";
import { LambdaTargetProps, pipe, StateMachineTargetProps } from "./target";
import { EventBusRuleInput } from "./types";
import { IEventBusRule } from "./rule";
import { StepFunction, ExpressStepFunction } from "../step-function";

/**
 * A function interface used by the {@link EventBusRule}'s map function.
 *
 * event is the event matched by the rule. This argument is optional.
 * $utils is a collection of built-in utilities wrapping EventBridge TargetInputs like contextual constants available to the transformer.
 */
export type EventTransformFunction<E extends EventBusRuleInput, O = any> = (
  event: E,
  $utils: EventTransformUtils
) => O;

/**
 * https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-transform-target-input.html#eb-transform-input-predefined
 */
export interface EventTransformUtils {
  context: {
    ruleArn: string;
    ruleName: string;
    ingestionTime: string;
    eventJson: string;
  };
}

/**
 * Represents an event that has been transformed using Target Input Transformers.
 * https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-transform-target-input.html
 *
 * @see EventBusRule.map for more details on transforming event details.
 */
export class EventBusTransform<T extends EventBusRuleInput, P> {
  readonly targetInput: aws_events.RuleTargetInput;

  /**
   * This static property identifies this class as an EventBusTransform to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "EventBusTransform";

  constructor(
    func: EventTransformFunction<T, P>,
    readonly rule: IEventBusRule<T>
  ) {
    const decl = func as unknown as FunctionDecl;
    this.targetInput = synthesizeEventBridgeTargets(decl);
  }

  /**
   * Defines a target of the {@link EventBusTransform}'s rule using this TargetInput.
   *
   * EventBus is not a valid pipe target for transformed events.
   *
   * @see EventBusRule.pipe for more details on pipe.
   */
  pipe(props: LambdaTargetProps<P>): void;
  pipe(func: IFunction<P, any>): void;
  pipe(props: StateMachineTargetProps<P>): void;
  pipe(props: StepFunction<P, any>): void;
  pipe(props: ExpressStepFunction<P, any>): void;
  pipe(
    resource:
      | IFunction<P, any>
      | LambdaTargetProps<P>
      | StateMachineTargetProps<P>
      | StepFunction<P, any>
      | ExpressStepFunction<P, any>
  ): void {
    pipe(this.rule, resource as any, this.targetInput);
  }
}
