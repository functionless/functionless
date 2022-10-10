import type { aws_events } from "aws-cdk-lib";

export function isEventBusIntegration(
  a: any
): a is EventBusIntegration<any, any> {
  return (
    a &&
    typeof a === "object" &&
    a.eventBus &&
    isEventBusTargetIntegration(a.eventBus)
  );
}

export interface EventBusIntegration<
  // the payload type we expect to be transformed into before making this call.
  in Payload,
  in Props extends object | undefined = undefined
> {
  eventBus: EventBusTargetIntegration<Payload, Props>;
}

export function isEventBusTargetIntegration(
  a: any
): a is EventBusIntegration<any, any> {
  return typeof a === "object" && typeof a.target === "function";
}
/**
 * Defines an integration that can be used in the `pipe` function of an {@link EventBus} (Rule or Transform).
 *
 * ```ts
 * const myEbIntegration = { // an Integration
 *    kind: 'myEbIntegration',
 *    eventBus: {
 *       target: (props, targetInput) => {
 *           // return a RuleTarget
 *       }
 *    }
 * }
 *
 * new EventBus().when("rule", () => true).pipe(myEbIntegration);
 * ```
 *
 * @typeParam - Payload - the type which the {@link Integration} expects as an input from {@link EventBus}.
 * @typeParam - Props - the optional properties the {@link Integration} accepts. Leave undefined to require no properties.
 */
export interface EventBusTargetIntegration<
  // the payload type we expect to be transformed into before making this call.
  in Payload,
  in Props extends object | undefined = undefined
> {
  /**
   * {@link EventBusTargetIntegration} does not make direct use of `P`. Typescript will ignore P when
   * doing type checking. By making the interface look like there is a property which is of type P,
   * typescript will consider P when type checking.
   *
   * This is useful for cases like {@link IRule.pipe} and {@link IEventTransform.pipe} which need to validate that
   * an integration implements the right EventBus integration.
   *
   * We use a function interface in order to satisfy the covariant relationship that we expect the super-P in as opposed to
   * returning sub-P.
   */
  __payloadBrand: (p: Payload) => void | Promise<void>;

  /**
   * Method called when an integration is passed to EventBus's `.pipe` function.
   *
   * @returns a  IRuleTarget that makes use of the props and optional target input.
   * @internal
   */
  target: (
    props: Props,
    targetInput?: aws_events.RuleTargetInput
  ) => aws_events.IRuleTarget;
}
