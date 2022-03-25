import { aws_events, aws_events_targets } from "aws-cdk-lib";
import { Construct } from "constructs";
import { FunctionDecl } from "../declaration";
import { synthesizeEventPattern } from "./eventpattern";
import { Function, isFunction } from "../function";
import { synthesizeEventBridgeTargets } from "./targets";

export interface EventBusRuleInput<
  T = any,
  DetailType extends string = string,
  Source extends string = string
> {
  source: Source;
  detailType: DetailType;
  detail: T;
}

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

export type EventTransformFunction<E extends EventBusRuleInput, O = any> = (
  event: E,
  $utils: EventTransformUtils
) => O;

export type EventPredicateFunction<
  E extends EventBusRuleInput = EventBusRuleInput<any>
> = (event: E) => boolean;

export type LambdaTargetProps<P> = {
  func: Function<P, any>;
} & Omit<aws_events_targets.LambdaFunctionProps, "event">;

export type EventBusTargetProps<P extends EventBusRuleInput> = {
  bus: EventBus<P>;
} & aws_events_targets.EventBusProps;

export type EvnetBusTargetResource<T extends EventBusRuleInput, P> =
  | Function<P, any>
  | LambdaTargetProps<P>
  | EventBus<T>
  | EventBusTargetProps<T>;

export class EventBusTransform<T extends EventBusRuleInput, P> {
  readonly targetInput: aws_events.RuleTargetInput;

  constructor(
    func: EventTransformFunction<T, P>,
    readonly rule: EventBusRule<T>
  ) {
    const decl = func as unknown as FunctionDecl;
    this.targetInput = synthesizeEventBridgeTargets(decl);
  }

  pipe<P>(props: LambdaTargetProps<P>): void;
  pipe<P>(func: Function<P, any>): void;
  pipe<P>(resource: Function<P, any> | LambdaTargetProps<P>): void {
    pipe(this.rule.rule, resource, this.targetInput);
  }
}

export class EventBusRule<T extends EventBusRuleInput> extends Construct {
  public readonly rule: aws_events.Rule;

  public static readonly FunctionlessType = "EventBusRule";

  constructor(
    scope: Construct,
    id: string,
    bus: aws_events.EventBus,
    predicate: EventPredicateFunction<T>
  ) {
    super(scope, id);

    const decl = predicate as unknown as FunctionDecl;
    const pattern = synthesizeEventPattern(decl);

    this.rule = new aws_events.Rule(this, "rule", {
      eventPattern: pattern as aws_events.EventPattern,
      eventBus: bus,
    });
  }

  map<P>(transform: EventTransformFunction<T, P>): EventBusTransform<T, P> {
    return new EventBusTransform<T, P>(transform, this);
  }

  pipe(props: LambdaTargetProps<T>): void;
  pipe(func: Function<T, any>): void;
  pipe(bus: EventBus<T>): void;
  pipe(props: EventBusTargetProps<T>): void;
  pipe(resource: EvnetBusTargetResource<T, T>): void {
    pipe(this.rule, resource);
  }
}

export class EventBus<E extends EventBusRuleInput> {
  /**
   * This static property identifies this class as an EventBus to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "EventBus";

  constructor(readonly bus: aws_events.EventBus) {}

  when(scope: Construct, id: string, predicate: EventPredicateFunction<E>) {
    return new EventBusRule<E>(scope, id, this.bus, predicate);
  }
}

const pipe = <T extends EventBusRuleInput, P>(
  rule: aws_events.Rule,
  resource: EvnetBusTargetResource<T, P>,
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
