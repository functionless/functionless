import { aws_events } from "aws-cdk-lib";
import { Rule } from "aws-cdk-lib/aws-events";
import { Construct } from "constructs";
import { FunctionDecl } from "../declaration";
import { synthesizeEventPattern } from "./eventpattern";
import { synthesizeEventBridgeTarget } from "./targets";

export interface EventBusEvent<
  T = any,
  DetailType extends string = string,
  Source extends string = string
> {
  source: Source;
  detailType: DetailType;
  detail: T;
}

type EventHandlerFunction<E extends EventBusEvent = EventBusEvent<any>> = (
  event: E
) => void;

export type EventPredicateFunction<
  E extends EventBusEvent = EventBusEvent<any>
> = (event: E) => boolean;

export class EventBusTarget<T extends EventBusEvent> {
  target: aws_events.IRuleTarget;

  constructor(func: EventHandlerFunction<T>) {
    const decl = func as unknown as FunctionDecl;
    this.target = synthesizeEventBridgeTarget(decl);
  }
}

export class EventBusRule<T extends EventBusEvent> extends Construct {
  public readonly rule: aws_events.Rule;

  constructor(
    scope: Construct,
    id: string,
    bus: aws_events.EventBus,
    predicate: EventPredicateFunction<T>
  ) {
    super(scope, id);

    const decl = predicate as unknown as FunctionDecl;
    const pattern = synthesizeEventPattern(decl);

    this.rule = new Rule(this, "rule", {
      eventPattern: pattern as aws_events.EventPattern,
      eventBus: bus,
    });
  }

  target<E extends T>(target: EventHandlerFunction<E>): EventBusRule<T>;
  target<E extends T>(target: EventBusTarget<E>): EventBusRule<T>;
  target<E extends T>(
    target: EventHandlerFunction<E> | EventBusTarget<E>
  ): EventBusRule<T> {
    const _target =
      target instanceof EventBusTarget ? target : new EventBusTarget<E>(target);
    this.rule.addTarget(_target.target);
    return this;
  }
}

export class EventBus<E extends EventBusEvent> {
  /**
   * This static property identifies this class as an EventBus to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "EventBus";

  constructor(private readonly bus: aws_events.EventBus) {}

  when(scope: Construct, id: string, predicate: EventPredicateFunction<E>) {
    return new EventBusRule<E>(scope, id, this.bus, predicate);
  }
}
