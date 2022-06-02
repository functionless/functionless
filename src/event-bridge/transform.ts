import { aws_events } from "aws-cdk-lib";
import { EventBusTargetIntegration, Integration } from "..";
import { FunctionDecl } from "../declaration";
import { DynamicProps, IEventBus, pipe } from "./event-bus";
import { IRule } from "./rule";
import { synthesizeEventBridgeTargets } from "./target-input";
import { Event } from "./types";

/**
 * A function interface used by the {@link Rule}'s map function.
 *
 * event is the event matched by the rule. This argument is optional.
 * $utils is a collection of built-in utilities wrapping EventBridge TargetInputs like contextual constants available to the transformer.
 */
export type EventTransformFunction<E extends Event, O = any> = (
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
 * @see Rule.map for more details on transforming event details.
 */
export class EventTransform<T extends Event, P> {
  readonly targetInput: aws_events.RuleTargetInput;

  /**
   * This static property identifies this class as an EventTransform to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "EventTransform";

  constructor(func: EventTransformFunction<T, P>, readonly rule: IRule<T>) {
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
  pipe<
    I extends Integration<any, string, EventBusTargetIntegration<P, Props>> & {
      eventBus: EventBusTargetIntegration<P, Props>;
    },
    Props extends object | undefined
  >(
    integration: NonEventBusIntegration<I>,
    ...props: Parameters<DynamicProps<Props>>
  ): void;
  pipe(
    callback: (
      targetInput: aws_events.RuleTargetInput
    ) => aws_events.IRuleTarget
  ): void;
  pipe<
    I extends Integration<any, string, EventBusTargetIntegration<P, Props>> & {
      eventBus: EventBusTargetIntegration<P, Props>;
    },
    Props extends object | undefined
  >(
    integration:
      | NonEventBusIntegration<I>
      | ((targetInput: aws_events.RuleTargetInput) => aws_events.IRuleTarget),
    ...props: Parameters<DynamicProps<Props>>
  ): void {
    pipe(this.rule, integration, props[0] as Props, this.targetInput);
  }
}

/**
 * EventBus to EventBus input transform is not allowed.
 */
export type NonEventBusIntegration<I extends Integration<any, any, any>> =
  I extends IEventBus<any> ? never : I;
