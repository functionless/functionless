import { aws_events } from "aws-cdk-lib";
import { Rule } from "aws-cdk-lib/aws-events";
import { Construct } from "constructs";
import { FunctionDecl } from "../declaration";
import { synthesizeEventPattern } from "./eventpattern";
import { synthesizeEventBridgeTargets } from "./targets";
import { Function } from "../function";
import { Table } from "../table";
import { AnyFunction } from "..";

export interface EventBusRuleInput<
  T = any,
  DetailType extends string = string,
  Source extends string = string
> {
  source: Source;
  detailType: DetailType;
  detail: T;
}

export type EventTransformFunction<
  E extends EventBusRuleInput = EventBusRuleInput<any>,
  O = never
> = (event: E) => O;

export type EventPredicateFunction<
  E extends EventBusRuleInput = EventBusRuleInput<any>
> = (event: E) => boolean;

export class EventBusRuleInput<T extends EventBusRuleInput> {
  constructor(func: EventTransformFunction<T>) {
    const decl = func as unknown as FunctionDecl;
  }

  as<O>(func: EventTransformFunction<T, O>): EventBusRuleInput<O> {}

  set(target: (x: T) => any): void {}
}

export class EventBusRule<T extends EventBusRuleInput> extends Construct {
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

  as<O>(target: EventTransformFunction<T>): EventBusRuleInput<O> {}

  set(target: (x: T) => any): void {}
}

export class EventBus<E extends EventBusRuleInput> {
  /**
   * This static property identifies this class as an EventBus to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "EventBus";

  constructor(private readonly bus: aws_events.EventBus) {}

  when(scope: Construct, id: string, predicate: EventPredicateFunction<E>) {
    return new EventBusRule<E>(scope, id, this.bus, predicate);
  }
}
