import { aws_events } from "aws-cdk-lib";
import { Construct } from "constructs";
import { EventBus } from "./event-bus";
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
} from "./target";

/**
 * A function interface used by the {@link EventBus}'s when function to generate a rule.
 *
 * event is every event sent to the bus to be filtered. This argument is optional.
 */
export type EventPredicateFunction<
  E extends EventBusRuleInput = EventBusRuleInput<any>
> = (event: E) => boolean;

/**
 * Represents a set of events filtered by the when predicate using event bus's EventPatterns.
 * https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html
 *
 * @see EventBus.when for more details on filtering events.
 */
export class EventBusRule<T extends EventBusRuleInput> extends Construct {
  public readonly rule: aws_events.Rule;

  public static readonly FunctionlessType = "EventBusRule";

  constructor(
    scope: Construct,
    id: string,
    bus: aws_events.IEventBus,
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
   * Local varaibles
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
   * * Arithmatic
   * * Boolean logic `event.source === "lambda"`)
   * * Formatting the whole event `event: ${event}`
   * * More...
   *
   * Unsupported by Functionless:
   * * Variables from outside of the function scope
   */
  map<P>(transform: EventTransformFunction<T, P>): EventBusTransform<T, P> {
    return new EventBusTransform<T, P>(transform, this);
  }

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
  pipe(resource: EventBusTargetResource<T, T>): void {
    pipe(this.rule, resource);
  }
}
