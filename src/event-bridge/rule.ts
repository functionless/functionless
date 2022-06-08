import { aws_events } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  IEventBus,
  IEventBusFilterable,
  DynamicProps,
  pipe,
  IntegrationWithEventBus,
} from "./event-bus";
import {
  andDocuments,
  synthesizeEventPattern,
  synthesizePatternDocument,
} from "./event-pattern";
import { PatternDocument } from "./event-pattern/pattern";
import { EventTransformFunction, EventTransform } from "./transform";
import type { Event } from "./types";

/**
 * A function interface used by the {@link EventBus}'s when function to generate a rule.
 *
 * event is every event sent to the bus to be filtered. This argument is optional.
 */
export type RulePredicateFunction<Evnt, OutEvnt extends Evnt = Evnt> =
  | ((event: Evnt) => event is OutEvnt)
  | ((event: Evnt) => boolean);

export interface IRule<Evnt extends Event> {
  readonly rule: aws_events.Rule;

  /**
   * This static property identifies this class as a Rule to the TypeScript plugin.
   */
  readonly functionlessKind: typeof RuleBase.FunctionlessType;

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
  map<OutEvnt>(
    transform: EventTransformFunction<Evnt, OutEvnt>
  ): EventTransform<Evnt, OutEvnt>;

  /**
   * Defines a target of the {@link EventTransform}'s rule using this TargetInput.
   *
   * The event is sent to the target verbatim unless .map is used first.
   *
   * Event buses do not support TargetInput transforms.
   * https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-bus-to-bus.html
   *
   * Send to lambda
   *
   * ```ts
   * const myFunction = new Function<Payload, void>(this, 'awsTarget', ...);
   * bus.when(...).pipe(myFunction)
   * ```
   *
   * Send to event bus with DLQ and Retries
   *
   * ```ts
   * const myFunction = new Function<Payload, void>(this, 'awsTarget', ...);
   * const myQueue = new aws_sqs.Queue(this, 'queue');
   * bus.when(...).pipe(myFunction, { deadLetterQueue: myQueue, retryAttempts: 10 });
   * ```
   *
   * Send to event bus
   *
   * ```ts
   * const targetBus = aws_events.EventBus(this, 'awsBus');
   * bus.when(...).pipe(new EventBus(targetBus))
   * ```
   */
  pipe<Props extends object | undefined>(
    integration: IntegrationWithEventBus<Evnt, Props>,
    ...props: Parameters<DynamicProps<Props>>
  ): void;
  pipe(callback: () => aws_events.IRuleTarget): void;
}

abstract class RuleBase<Evnt extends Event> implements IRule<Evnt> {
  /**
   * This static properties identifies this class as a Rule to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "Rule";
  readonly functionlessKind = "Rule";

  _rule: aws_events.Rule | undefined = undefined;

  // only generate the rule when needed
  public get rule() {
    if (!this._rule) {
      this._rule = this.ruleGenerator();
    }
    return this._rule;
  }

  constructor(readonly ruleGenerator: () => aws_events.Rule) {}

  /**
   * @inheritdoc
   */
  public map<OutEvent>(
    transform: EventTransformFunction<Evnt, OutEvent>
  ): EventTransform<Evnt, OutEvent> {
    return new EventTransform<Evnt, OutEvent>(transform, this);
  }

  /**
   * @inheritdoc
   */
  public pipe<Props extends object | undefined>(
    integration: IntegrationWithEventBus<Evnt, Props>,
    ...props: Parameters<DynamicProps<Props>>
  ): void;
  public pipe(callback: () => aws_events.IRuleTarget): void;
  public pipe<Props extends object | undefined>(
    integration:
      | IntegrationWithEventBus<Evnt, Props>
      | (() => aws_events.IRuleTarget),
    ...props: Parameters<DynamicProps<Props>>
  ): void {
    pipe(this, integration, props[0] as Props, undefined);
  }
}

/**
 * Special base rule that supports some internal behaviors like joining (AND) compiled rules.
 */
export class PredicateRuleBase<Evnt extends Event, OutEvnt extends Evnt = Evnt>
  extends RuleBase<OutEvnt>
  implements IEventBusFilterable<OutEvnt>
{
  readonly document: PatternDocument;
  constructor(
    scope: Construct,
    id: string,
    private bus: IEventBus<Evnt, OutEvnt>,
    /**
     * Functionless Pattern Document representation of Event Bridge rules.
     */
    document: PatternDocument,
    /**
     * Documents to join (AND) with the document.
     * Allows chaining of when statement.
     */
    ...aggregateDocuments: PatternDocument[]
  ) {
    const _document = aggregateDocuments.reduce(andDocuments, document);
    const pattern = synthesizeEventPattern(_document);

    const rule = () =>
      new aws_events.Rule(scope, id, {
        // CDK's event pattern format does not support the pattern matchers like prefix.
        eventPattern: pattern as aws_events.EventPattern,
        eventBus: bus.bus,
      });

    super(rule);

    this.document = _document;
  }

  /**
   * @inheritdoc
   */
  public when<NewEvnt extends OutEvnt>(
    id: string,
    predicate: RulePredicateFunction<OutEvnt, NewEvnt>
  ): PredicateRuleBase<OutEvnt, NewEvnt>;
  public when<NewEvnt extends OutEvnt>(
    scope: Construct,
    id: string,
    predicate: RulePredicateFunction<OutEvnt, NewEvnt>
  ): PredicateRuleBase<OutEvnt, NewEvnt>;
  public when<NewEvnt extends OutEvnt>(
    scope: Construct | string,
    id?: string | RulePredicateFunction<OutEvnt, NewEvnt>,
    predicate?: RulePredicateFunction<OutEvnt, NewEvnt>
  ): PredicateRuleBase<OutEvnt, NewEvnt> {
    if (predicate) {
      const document = synthesizePatternDocument(predicate as any);

      return new PredicateRuleBase<OutEvnt, NewEvnt>(
        scope as Construct,
        id as string,
        this.bus as IEventBus<Evnt, NewEvnt>,
        this.document,
        document
      );
    } else {
      const document = synthesizePatternDocument(id as any);

      return new PredicateRuleBase<OutEvnt, NewEvnt>(
        this.bus.bus,
        scope as string,
        this.bus as IEventBus<Evnt, NewEvnt>,
        this.document,
        document
      );
    }
  }
}

/**
 * Represents a set of events filtered by the when predicate using event bus's EventPatterns.
 * https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html
 *
 * @see EventBus.when for more details on filtering events.
 */
export class Rule<
  T extends Event,
  O extends T = T
> extends PredicateRuleBase<O> {
  constructor(
    scope: Construct,
    id: string,
    bus: IEventBus<O>,
    predicate: RulePredicateFunction<T, O>
  ) {
    const document = synthesizePatternDocument(predicate as any);

    super(scope, id, bus as IEventBus<O>, document);
  }

  /**
   * Import an {@link aws_events.Rule} wrapped with Functionless abilities.
   */
  public static fromRule<T extends Event>(rule: aws_events.Rule): IRule<T> {
    return new ImportedRule<T>(rule);
  }
}

/**
 * The event structure output for all scheduled events.
 * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-run-lambda-schedule.html#eb-schedule-create-rule
 */
export interface ScheduledEvent
  extends Event<{}, "Scheduled Event", "aws.events"> {}

export class ImportedRule<T extends Event> extends RuleBase<T> {
  constructor(rule: aws_events.Rule) {
    super(() => rule);
  }
}
