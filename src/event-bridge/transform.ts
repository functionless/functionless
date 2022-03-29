import { aws_events } from "aws-cdk-lib";
import { FunctionDecl } from "../declaration";
import { synthesizeEventBridgeTargets } from "./target-input";
import { Function } from "../function";
import { LambdaTargetProps, pipe } from "./target";
import { EventBusRuleInput } from "./types";
import { EventBusRule } from "./rule";

/**
 * A function interface used by the {@link EventBusRule}'s map function.
 *
 * event is the event matched by the rule. This argument is optional.
 * $utils is a collection of built-in utilities wrapping EventBridge TargetInputs like contextual constants avaliable to the transformer.
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

  public static readonly FunctionlessType = "EventBusTransform";

  constructor(
    func: EventTransformFunction<T, P>,
    readonly rule: EventBusRule<T>
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
  pipe<P>(props: LambdaTargetProps<P>): void;
  pipe<P>(func: Function<P, any>): void;
  pipe<P>(resource: Function<P, any> | LambdaTargetProps<P>): void {
    pipe(this.rule.rule, resource, this.targetInput);
  }
}
