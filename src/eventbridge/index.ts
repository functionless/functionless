import { aws_events } from "aws-cdk-lib";
import { Rule } from "aws-cdk-lib/aws-events";
import { Construct } from "constructs";
import { FunctionDecl } from "../declaration";
import { synthesizeEventPattern } from "./eventpattern";

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
> = (event: E) => void;

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
}

export class EventBus<E extends EventBusEvent> extends Construct {
  /**
   * This static property identifies this class as an EventBus to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "EventBus";

  public readonly decl: FunctionDecl;

  constructor(
    scope: Construct,
    id: string,
    private readonly bus: aws_events.EventBus,
    readonly fn: EventHandlerFunction
  ) {
    super(scope, id);
    // The Functionless TSC compiler plugin will transform the `EventHandlerFunction` into a FunctionDecl.
    this.decl = fn as unknown as FunctionDecl;
  }

  when(id: string, predicate: EventPredicateFunction<E>) {
    return new EventBusRule<E>(this, id, this.bus, predicate);
  }
}
