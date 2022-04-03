import { aws_events, aws_events_targets } from "aws-cdk-lib";
import { EventBus } from "./event-bus";
import { Function, isFunction } from "../function";
import { EventBusRuleInput } from "./types";
import { IEventBusRule } from "./rule";
import {
  ExpressStepFunction,
  isStepFunction,
  StepFunction,
} from "../step-function";
import { assertNever } from "../assert";

export type LambdaTargetProps<P> = {
  func: Function<P, any>;
} & Omit<aws_events_targets.LambdaFunctionProps, "event">;

const isLambdaTargetProps = <P>(props: any): props is LambdaTargetProps<P> => {
  return "func" in props;
};

export type EventBusTargetProps<P extends EventBusRuleInput> = {
  bus: EventBus<P>;
} & aws_events_targets.EventBusProps;

const isEventBusTargetProps = <P extends EventBusRuleInput>(
  props: any
): props is EventBusTargetProps<P> => {
  return "bus" in props;
};

export type StateMachineTargetProps<P extends Record<string, any> | undefined> =
  {
    machine: ExpressStepFunction<P, any> | StepFunction<P, any>;
  } & Omit<aws_events_targets.SfnStateMachineProps, "input">;

const isStateMachineTargetProps = <P>(
  props: any
): props is StateMachineTargetProps<P> => {
  return "machine" in props;
};

export type EventBusTargetResource<T extends EventBusRuleInput, P> =
  | Function<P, any>
  | LambdaTargetProps<P>
  | EventBus<T>
  | EventBusTargetProps<T>
  | ExpressStepFunction<P, any>
  | StepFunction<P, any>
  | StateMachineTargetProps<P>;

/**
 * Add a target to the run based on the configuration given.
 */
export function pipe<T extends EventBusRuleInput, P>(
  rule: IEventBusRule<T>,
  resource: EventBusTargetResource<T, P>,
  targetInput?: aws_events.RuleTargetInput
) {
  if (isFunction<P, any>(resource) || isLambdaTargetProps<P>(resource)) {
    const _props: LambdaTargetProps<P> = isFunction<P, any>(resource)
      ? { func: resource }
      : resource;

    return rule.rule.addTarget(
      new aws_events_targets.LambdaFunction(_props.func.resource, {
        deadLetterQueue: _props.deadLetterQueue,
        maxEventAge: _props.maxEventAge,
        retryAttempts: _props.retryAttempts,
        event: targetInput,
      })
    );
  } else if (
    resource instanceof EventBus ||
    isEventBusTargetProps<T>(resource)
  ) {
    if (targetInput) {
      throw new Error("Event bus rule target does not support target input.");
    }

    const _props: EventBusTargetProps<T> =
      resource instanceof EventBus ? { bus: resource } : resource;

    return rule.rule.addTarget(
      new aws_events_targets.EventBus(_props.bus.bus, {
        deadLetterQueue: _props.deadLetterQueue,
        role: _props.role,
      })
    );
  } else if (
    isStepFunction<P>(resource) ||
    isStateMachineTargetProps<P>(resource)
  ) {
    const _props: StateMachineTargetProps<any> = isStepFunction<P>(resource)
      ? { machine: resource }
      : resource;

    return rule.rule.addTarget(
      new aws_events_targets.SfnStateMachine(_props.machine, {
        ..._props,
        input: targetInput,
      })
    );
  }

  assertNever(resource);
}
