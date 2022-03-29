import { aws_events, aws_events_targets } from "aws-cdk-lib";
import { EventBus } from "./bus";
import { Function, isFunction } from "../function";
import { EventBusRuleInput } from "./types";

export type LambdaTargetProps<P> = {
  func: Function<P, any>;
} & Omit<aws_events_targets.LambdaFunctionProps, "event">;

export type EventBusTargetProps<P extends EventBusRuleInput> = {
  bus: EventBus<P>;
} & aws_events_targets.EventBusProps;

export type EventBusTargetResource<T extends EventBusRuleInput, P> =
  | Function<P, any>
  | LambdaTargetProps<P>
  | EventBus<T>
  | EventBusTargetProps<T>;

  /**
   * Add a target to the run based on the configuration given.
   */
export const pipe = <T extends EventBusRuleInput, P>(
  rule: aws_events.Rule,
  resource: EventBusTargetResource<T, P>,
  targetInput?: aws_events.RuleTargetInput
) => {
  if (isFunction(resource) || "func" in resource) {
    const _props = isFunction(resource) ? { func: resource } : resource;

    return rule.addTarget(
      new aws_events_targets.LambdaFunction(_props.func.resource, {
        deadLetterQueue: _props.deadLetterQueue,
        maxEventAge: _props.maxEventAge,
        retryAttempts: _props.retryAttempts,
        event: targetInput,
      })
    );
  } else if (resource instanceof EventBus || "bus" in resource) {
    if (targetInput) {
      throw new Error("Event bus rule target does not support target input.");
    }

    const _props = resource instanceof EventBus ? { bus: resource } : resource;

    return rule.addTarget(
      new aws_events_targets.EventBus(_props.bus.bus, {
        deadLetterQueue: _props.deadLetterQueue,
        role: _props.role,
      })
    );
  }
};
