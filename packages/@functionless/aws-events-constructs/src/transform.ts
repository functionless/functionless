import { FunctionDecl } from "@functionless/ast";
import { aws_events } from "aws-cdk-lib";
import {
  DynamicProps,
  IEventBus,
  IntegrationWithEventBus,
  pipe,
} from "./event-bus";
import { IRule } from "./rule";
import { synthesizeEventBridgeTargets } from "./target-input";
import { Event } from "@functionless/aws-events";

/**
 * A function interface used by the {@link Rule}'s map function.
 *
 * event is the event matched by the rule. This argument is optional.
 * $utils is a collection of built-in utilities wrapping EventBridge TargetInputs like contextual constants available to the transformer.
 *
 * @typeParam - Evnt - The event type from the {@link Rule}.
 * @typeParam - OutEvnt - The narrowed event type after the transform is applied.
 */
export type EventTransformFunction<in Evnt extends Event, out OutEvnt = any> = (
  event: Evnt,
  $utils: EventTransformUtils
) => OutEvnt;

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
 * @see Rule.map for more details on transforming event details.
 *
 * @typeParam - Evnt - The event type from the {@link Rule}.
 * @typeParam - Out - The narrowed event type after the transform is applied.
 * @typeParam - OutEvnt - Covariant form of {@link Evnt}. Should be inferred.
 */
export class EventTransform<
  in Evnt extends Event,
  out Out,
  out OutEvnt extends Evnt = Evnt
> {
  readonly targetInput: aws_events.RuleTargetInput;

  /**
   * This static property identifies this class as an EventTransform to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "EventTransform";

  constructor(
    func: EventTransformFunction<Evnt, Out>,
    readonly rule: IRule<OutEvnt>
  ) {
    const decl = func as unknown as FunctionDecl;
    this.targetInput = synthesizeEventBridgeTargets(decl);
  }

  /**
   * Defines a target of the {@link EventTransform}'s rule using this TargetInput.
   *
   * EventBus is not a valid pipe target for transformed events.
   *
   * @see Rule.pipe for more details on pipe.
   */
  public pipe<
    I extends IntegrationWithEventBus<Out, Props>,
    Props extends object | undefined
  >(
    integration: NonEventBusIntegration<I>,
    ...props: Parameters<DynamicProps<Props>>
  ): void;
  public pipe(
    callback: (
      targetInput: aws_events.RuleTargetInput
    ) => aws_events.IRuleTarget
  ): void;
  public pipe<
    I extends IntegrationWithEventBus<Out, Props>,
    Props extends object | undefined
  >(
    integration:
      | NonEventBusIntegration<I>
      | ((targetInput: aws_events.RuleTargetInput) => aws_events.IRuleTarget),
    ...props: Parameters<DynamicProps<Props>>
  ): void {
    pipe(this.rule, integration, props[0] as any, this.targetInput);
  }
}

/**
 * EventBus to EventBus input transform is not allowed.
 */
export type NonEventBusIntegration<I> = I extends IEventBus<any> ? never : I;
