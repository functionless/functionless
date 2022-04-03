import { aws_events } from "aws-cdk-lib";
import { Construct } from "constructs";
import { EventBus, IEventBus } from "./event-bus";
import { FunctionDecl } from "../declaration";
import { synthesizeEventPattern } from "./event-pattern";
import { Function } from "../function";
import { EventBusRuleInput } from "./types";
import { EventTransformFunction, EventBusTransform } from "./transform";
import {
  EventBusTargetProps,
  EventBusTargetResource,
  LambdaTargetProps,
  pipe,
  StateMachineTargetProps,
} from "./target";
import { ExpressStepFunction, StepFunction } from "../step-function";

/**
 * A function interface used by the {@link EventBus}'s when function to generate a rule.
 *
 * event is every event sent to the bus to be filtered. This argument is optional.
 */
export type EventPredicateFunction<
  E extends EventBusRuleInput = EventBusRuleInput<any>
> = (event: E) => boolean;

export interface IEventBusRule<T extends EventBusRuleInput> {
  readonly rule: aws_events.Rule;

  /**
   * This static property identifies this class as an EventBusRule to the TypeScript plugin.
   */
  readonly functionlessKind: typeof EventBusRuleBase.FunctionlessType;

  /**
   * Transform the event before sending to a target using pipe using TargetInput transforms.
   * https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-transform-target-input.html
   *
   * Return the entire event (or directly call .pipe without map)
   *
   * ```ts
   * .map(event => event)
   * ```
   *
   * Return only the detail object
   *
   * ```ts
   * .map(event => event.detail)
   * ```
   *
   * Create a new object
   *
   * ```ts
   * .map(event => ({
   *    source: event.source,
   *    value: event.detail.value
   * }))
   * ```
   *
   * Format a string
   *
   * ```ts
   * .map(event => `this is the source ${event.source}`)
   * ```
   *
   * Format a string in an object
   *
   * ```ts
   * .map(event => ({ formattedSource: `this is the source ${event.source}` }))
   * ```
   *
   * Get the rule name
   *
   * ```ts
   * .map((event, $utils) => ({
   *    ruleName: $utils.context.ruleName,
   *    detail: event.detail
   *  }))
   * ```
   *
   *
   * Local variables
   *
   * ```ts
   * .map(event => {
   *    const formatted = `${event.id}_${event.detail.id}`;
   *    return ({
   *       formatted
   *    })
   * })
   * ```
   *
   * Unsupported by EventBridge:
   * * String slicing/sub string
   * * Arithmetic
   * * Boolean logic `event.source === "lambda"`)
   * * Formatting the whole event `event: ${event}`
   * * More...
   *
   * Unsupported by Functionless:
   * * Variables from outside of the function scope
   */
  map<P>(transform: EventTransformFunction<T, P>): EventBusTransform<T, P>;

  /**
   * Defines a target of the {@link EventBusTransform}'s rule using this TargetInput.
   *
   * The event is sent to the target verbatim unless .map is used first.
   *
   * Event buses do not support TargetInput transforms.
   * https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-bus-to-bus.html
   *
   * Send to lambda
   *
   * ```ts
   * const awsFunc = aws_lambda.Function(this, 'awsTarget', { ... });
   * const myFunction = new Function<Payload, void>(awsFunc);
   * bus.when(...).pipe(myFunction)
   * ```
   *
   * Send to event bus with DLQ and Retries
   *
   * ```ts
   * const awsFunc = aws_lambda.Function(this, 'awsTarget', { ... });
   * const myFunction = new Function<Payload, void>(awsFunc);
   * const myQueue = new aws_sqs.Queue(this, 'queue');
   * bus.when(...).pipe({ func: myFunction, deadLetterQueue: myQueue, retryAttempts: 10 );
   * ```
   *
   * Send to event bus
   *
   * ```ts
   * const targetBus = aws_events.EventBus(this, 'awsBus');
   * bus.when(...).pipe(new EventBus(targetBus))
   * ```
   */
  pipe(props: LambdaTargetProps<T>): void;
  pipe(func: Function<T, any>): void;
  pipe(bus: EventBus<T>): void;
  pipe(props: EventBusTargetProps<T>): void;
  pipe(props: StateMachineTargetProps<T>): void;
  pipe(props: StepFunction<T, any>): void;
  pipe(props: ExpressStepFunction<T, any>): void;
}

abstract class EventBusRuleBase<T extends EventBusRuleInput>
  implements IEventBusRule<T>
{
  /**
   * This static properties identifies this class as an EventBusRule to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "EventBusRule";
  readonly functionlessKind = "EventBusRule";

  constructor(readonly rule: aws_events.Rule) {}

  /**
   * @inheritdoc
   */
  map<P>(transform: EventTransformFunction<T, P>): EventBusTransform<T, P> {
    return new EventBusTransform<T, P>(transform, this);
  }

  /**
   * @inheritdoc
   */
  pipe(props: LambdaTargetProps<T>): void;
  pipe(func: Function<T, any>): void;
  pipe(bus: EventBus<T>): void;
  pipe(props: EventBusTargetProps<T>): void;
  pipe(props: StateMachineTargetProps<T>): void;
  pipe(props: StepFunction<T, any>): void;
  pipe(props: ExpressStepFunction<T, any>): void;
  pipe(resource: EventBusTargetResource<T, T>): void {
    pipe(this, resource as any);
  }
}

/**
 * Represents a set of events filtered by the when predicate using event bus's EventPatterns.
 * https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html
 *
 * @see EventBus.when for more details on filtering events.
 */
export class EventBusRule<
  T extends EventBusRuleInput
> extends EventBusRuleBase<T> {
  constructor(
    scope: Construct,
    id: string,
    bus: IEventBus<T>,
    predicate: EventPredicateFunction<T>
  ) {
    const decl = predicate as unknown as FunctionDecl;
    const pattern = synthesizeEventPattern(decl);

    const rule = new aws_events.Rule(scope, id, {
      eventPattern: pattern as aws_events.EventPattern,
      eventBus: bus.bus,
    });

    super(rule);
  }

  /**
   * Import an {@link aws_events.Rule} wrapped with Functionless abilities.
   */
  public static fromRule<T extends EventBusRuleInput>(
    rule: aws_events.Rule
  ): IEventBusRule<T> {
    return new ImportedEventBusRule(rule);
  }
}

class ImportedEventBusRule<
  T extends EventBusRuleInput
> extends EventBusRuleBase<T> {
  constructor(rule: aws_events.Rule) {
    super(rule);
  }
}
