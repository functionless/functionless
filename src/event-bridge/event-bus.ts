import { aws_events, aws_events_targets, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ASL } from "../asl";
import {
  CallExpr,
  Expr,
  Identifier,
  isArrayLiteralExpr,
  isComputedPropertyNameExpr,
  isIdentifier,
  isObjectLiteralExpr,
  isSpreadAssignExpr,
  ObjectLiteralExpr,
  PropAssignExpr,
  StringLiteralExpr,
} from "../expression";
import { Function, NativePreWarmContext, PrewarmClients } from "../function";
import {
  Integration,
  IntegrationCall,
  IntegrationImpl,
  isIntegration,
  makeIntegration,
} from "../integration";
import { AnyFunction } from "../util";
import {
  RulePredicateFunction,
  Rule,
  PredicateRuleBase,
  ImportedRule,
  ScheduledEvent,
  IRule,
} from "./rule";
import type { Event } from "./types";

export const isEventBus = <EvntBus extends IEventBus<any>>(v: any): v is EvntBus => {
  return (
    "functionlessKind" in v &&
    v.functionlessKind === EventBusBase.FunctionlessType
  );
};

/**
 * Returns the {@link Event} type on the {@link EventBus}.
 */
export type EventBusEvent<B extends IEventBus<any>> = [B] extends [IEventBus<infer E>] ? E : never;

export interface IEventBusFilterable<in Evnt extends Event, out OutEvnt extends Event = Evnt> {
  /**
   * EventBus Rules can filter events using Functionless predicate functions.
   *
   * Equals
   *
   * ```ts
   * when(this, 'rule', (event) => event.source === "lambda")
   * ```
   *
   * Starts With (Prefix)
   *
   * ```ts
   * when(this, 'rule', (event) => event.id.startsWith("2022"))
   * ```
   *
   * Not
   *
   * ```ts
   * when(this, 'rule', (event) => event.source !== "dynamo")
   * ```
   *
   * Numeric Ranges
   *
   * ```ts
   * when(this, 'rule', (event) => event.detail.num >= 10 || event.detail.num > 100 && event.detail.num < 1000)
   * ```
   *
   * Presence
   *
   * ```ts
   * when(this, 'rule', (event) => !event.detail.optional)
   * ```
   *
   * Multiple Fields
   *
   * ```ts
   * when(this, 'rule', (event) => event.source === "lambda" && event['detail-type'] === "SUCCESS")
   * ```
   *
   * Array Includes
   *
   * ```ts
   * when(this, 'rule', (event) => event.detail.list.includes("someValue"))
   * ```
   *
   * Omitting the scope will use the bus as the scope.
   *
   * ```ts
   * when('rule', ...)
   * ```
   *
   * Unsupported by Event Bridge
   * * OR Logic between multiple fields
   * * AND logic between most logic on a single field (except for numeric ranges.)
   * * Multiple `!field.startsWith(...)` on a single field
   * * Any operation on an Array other than `includes` and presence (`event.detail.list === undefined`).
   * * Any string operation other than `===/==`, `!==/!=`, `startsWith`, and presence (`!==/=== undefined`).
   * * Math (`event.detail.num + 1 < 10`)
   * * Comparisons between fields (`event.detail.previous !== event.id`)
   *
   * Unsupported by Functionless:
   * * Variables from outside of the function scope
   *
   * @typeParam InEvnt - The type the {@link Rule} matches. Covariant of output {@link OutEvnt}.
   * @typeParam NewEvnt - The type the predicate narrows to, a sub-type of {@link InEvnt}.
   */
  when<InEvnt extends OutEvnt, NewEvnt extends InEvnt>(
    id: string,
    predicate: RulePredicateFunction<InEvnt, NewEvnt>
  ): Rule<InEvnt, NewEvnt>;
  when<InEvnt extends OutEvnt, NewEvnt extends InEvnt>(
    scope: Construct,
    id: string,
    predicate: RulePredicateFunction<InEvnt, NewEvnt>
  ): Rule<InEvnt, NewEvnt>;
}

/**
 * @typeParam Evnt - the union type of events that this EventBus can accept.
 *                   `Evnt` is the covariant version of `OutEvnt` in that
 *                   the bus will accept any of `Evnt` while the EventBus can
 *                   emit any of `OutEvnt`.
 * @typeParam OutEvnt - the union type of events that this EventBus will emit through rules.
 *                      `OutEvnt` is the contravariant version of `Evnt` in that
 *                      the bus will emit any of `OutEvnt` while the EventBus can
 *                      can accept any of `Evnt`. This type parameter should be left
 *                      empty to be inferred. ex: `EventBus<Event<Detail1> | Event<Detail2>>`.
 */
export interface IEventBus<in Evnt extends Event = Event, OutEvnt extends Evnt = Evnt>
  extends IEventBusFilterable<Evnt>,
    Integration<
      "EventBus",
      (
        event: PutEventInput<Evnt>,
        ...events: PutEventInput<Evnt>[]
      ) => void,
      EventBusTargetIntegration<
        PutEventInput<Evnt>,
        aws_events_targets.EventBusProps | undefined
      >
    > {
  readonly bus: aws_events.IEventBus;
  readonly eventBusArn: string;
  readonly eventBusName: string;

  // @ts-ignore - value does not exist, is only available at compile time
  readonly __functionBrand: (
    event: PutEventInput<Evnt>,
    ...events: PutEventInput<Evnt>[]
  ) => void;

  /**
   * This static property identifies this class as an EventBus to the TypeScript plugin.
   */
  readonly functionlessKind: typeof EventBusBase.FunctionlessType;

  /**
   * Put one or more events on an Event Bus.
   */
  putEvents(
    event: PutEventInput<Evnt>,
    ...events: PutEventInput<Evnt>[]
  ): void;

  /**
   * Creates a rule that matches all events on the bus.
   *
   * When no scope or id are given, the bus is used as the scope and the id will be `all`.
   * The rule created will be a singleton.
   *
   * When scope and id are given, a new rule will be created each time.
   *
   * Like all functionless, a rule is only created when the rule is used with `.pipe` or the rule is retrieved using `.rule`.
   *
   * ```ts
   * const bus = new EventBus(scope, 'bus');
   * const func = new Function(scope, 'func', async (payload: {id: string}) => console.log(payload.id));
   *
   * bus
   *  .all()
   *  .map(event => ({id: event.id}))
   *  .pipe(func);
   * ```
   */
  all(): PredicateRuleBase<Evnt, OutEvnt>;
  all(scope: Construct, id: string): PredicateRuleBase<Evnt, OutEvnt>;
}

/**
 * @typeParam Evnt - the union type of events that this EventBus can accept.
 *                   `Evnt` is the covariant version of `OutEvnt` in that
 *                   the bus will accept any of `Evnt` while the EventBus can
 *                   emit any of `OutEvnt`.
 * @typeParam OutEvnt - the union type of events that this EventBus will emit through rules.
 *                      `OutEvnt` is the contravariant version of `Evnt` in that
 *                      the bus will emit any of `OutEvnt` while the EventBus can
 *                      can accept any of `Evnt`. This type parameter should be left
 *                      empty to be inferred. ex: `EventBus<Event<Detail1> | Event<Detail2>>`.
 */
abstract class EventBusBase<in Evnt extends Event, OutEvnt extends Evnt = Evnt> implements IEventBus<Evnt, OutEvnt> {
  /**
   * This static properties identifies this class as an EventBus to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "EventBus";
  readonly functionlessKind = "EventBus";
  readonly kind = "EventBus";
  readonly eventBusName: string;
  readonly eventBusArn: string;

  protected static singletonDefaultNode = "__DefaultBus";

  private allRule: PredicateRuleBase<Evnt, OutEvnt> | undefined;

  public readonly putEvents: IntegrationCall<
    "EventBus.putEvents",
    IEventBus<Evnt>["putEvents"]
  >;

  // @ts-ignore - value does not exist, is only available at compile time
  readonly __functionBrand: (
    event: PutEventInput<Evnt>,
    ...events: PutEventInput<Evnt>[]
  ) => void;

  constructor(readonly bus: aws_events.IEventBus) {
    this.eventBusName = bus.eventBusName;
    this.eventBusArn = bus.eventBusArn;

    // Closure event bus base
    const eventBusName = this.eventBusName;

    this.putEvents = makeIntegration<
      "EventBus.putEvents",
      IEventBus<Evnt>["putEvents"]
    >({
      kind: "EventBus.putEvents",
      asl: (call: CallExpr, context: ASL) => {
        this.bus.grantPutEventsTo(context.role);

        // Validate that the events are object literals.
        // Then normalize nested arrays of events into a single list of events.
        // TODO Relax these restrictions: https://github.com/functionless/functionless/issues/101
        const eventObjs = call.args.reduce(
          (events: ObjectLiteralExpr[], arg) => {
            if (isArrayLiteralExpr(arg.expr)) {
              if (!arg.expr.items.every(isObjectLiteralExpr)) {
                throw Error(
                  "Event Bus put events must use inline object parameters. Variable references are not supported currently."
                );
              }
              return [...events, ...arg.expr.items];
            } else if (isObjectLiteralExpr(arg.expr)) {
              return [...events, arg.expr];
            }
            throw Error(
              "Event Bus put events must use inline object parameters. Variable references are not supported currently."
            );
          },
          []
        );

        // The interface should prevent this.
        if (eventObjs.length === 0) {
          throw Error("Must provide at least one event.");
        }

        const propertyMap: Record<keyof Event, string> = {
          "detail-type": "DetailType",
          account: "Account",
          detail: "Detail",
          id: "Id",
          region: "Region",
          resources: "Resources",
          source: "Source",
          time: "Time",
          version: "Version",
        };

        const events = eventObjs.map((event) => {
          const props = event.properties.filter(
            (
              e
            ): e is PropAssignExpr & {
              name: StringLiteralExpr | Identifier;
            } => !(isSpreadAssignExpr(e) || isComputedPropertyNameExpr(e.name))
          );
          if (props.length < event.properties.length) {
            throw Error(
              "Event Bus put events must use inline objects instantiated without computed or spread keys."
            );
          }
          return (
            props
              .map(
                (prop) =>
                  [
                    isIdentifier(prop.name) ? prop.name.name : prop.name.value,
                    prop.expr,
                  ] as const
              )
              .filter(
                (x): x is [keyof typeof propertyMap, Expr] =>
                  x[0] in propertyMap && !!x[1]
              )
              /**
               * Build the parameter payload for an event entry.
               * All members must be in Pascal case.
               */
              .reduce(
                (acc: Record<string, string>, [name, expr]) => ({
                  ...acc,
                  [propertyMap[name]]: ASL.toJson(expr),
                }),
                { EventBusName: this.bus.eventBusArn }
              )
          );
        });

        return {
          Resource: "arn:aws:states:::events:putEvents",
          Type: "Task" as const,
          Parameters: {
            Entries: events,
          },
        };
      },
      native: {
        bind: (context: Function<any, any>) => {
          this.bus.grantPutEventsTo(context.resource);
        },
        preWarm: (prewarmContext: NativePreWarmContext) => {
          prewarmContext.getOrInit(PrewarmClients.EVENT_BRIDGE);
        },
        call: async (args, preWarmContext) => {
          const eventBridge = preWarmContext.getOrInit(
            PrewarmClients.EVENT_BRIDGE
          );
          await eventBridge
            .putEvents({
              Entries: args.map((event) => ({
                Detail: JSON.stringify(event.detail),
                EventBusName: eventBusName,
                DetailType: event["detail-type"],
                Resources: event.resources,
                Source: event.source,
                Time:
                  typeof event.time === "number"
                    ? new Date(event.time)
                    : undefined,
              })),
            })
            .promise();
        },
      },
    });
  }

  public readonly eventBus = makeEventBusIntegration<
    PutEventInput<Evnt>,
    aws_events_targets.EventBusProps | undefined
  >({
    target: (props, targetInput?) => {
      if (targetInput) {
        throw new Error("Event bus rule target does not support target input.");
      }

      return new aws_events_targets.EventBus(this.bus, props);
    },
  });

  /**
   * @inheritDoc
   *
   * @typeParam InEvnt - The type the {@link Rule} matches. Covariant of output {@link OutEvnt}.
   * @typeParam NewEvnt - The type the predicate narrows to, a sub-type of {@link InEvnt}.
   */
   public when<InEvnt extends OutEvnt, NewEvnt extends InEvnt>(
    id: string,
    predicate: RulePredicateFunction<InEvnt, NewEvnt>
  ): Rule<InEvnt, NewEvnt>;
  public when<InEvnt extends OutEvnt, NewEvnt extends InEvnt>(
    scope: Construct,
    id: string,
    predicate: RulePredicateFunction<InEvnt, NewEvnt>
  ): Rule<InEvnt, NewEvnt>;
  public when<InEvnt extends OutEvnt, NewEvnt extends InEvnt>(
    scope: Construct | string,
    id?: string | RulePredicateFunction<InEvnt, NewEvnt>,
    predicate?: RulePredicateFunction<InEvnt, NewEvnt>
  ): Rule<InEvnt, NewEvnt> {
    if (predicate) {
      return new Rule<InEvnt, NewEvnt>(
        scope as Construct,
        id as string,
        this as any,
        predicate
      );
    } else {
      return new Rule<InEvnt, NewEvnt>(
        this.bus,
        scope as string,
        this as any,
        id as RulePredicateFunction<InEvnt, NewEvnt>
      );
    }
  }

  public all(): PredicateRuleBase<Evnt, OutEvnt>;
  public all(scope: Construct, id: string): PredicateRuleBase<Evnt, OutEvnt>;
  public all(scope?: Construct, id?: string): PredicateRuleBase<Evnt, OutEvnt> {
    if (!scope || !id) {
      if (!this.allRule) {
        this.allRule = new PredicateRuleBase<Evnt, OutEvnt>(
          this.bus,
          "all",
          this as IEventBus<Evnt, OutEvnt>,
          // an empty doc will be converted to `{ source: [{ prefix: "" }]}`
          { doc: {} }
        );
      }
      return this.allRule;
    }
    return new PredicateRuleBase<Evnt, OutEvnt>(scope, id, this as IEventBus<Evnt, OutEvnt>, {
      doc: {},
    });
  }
}

export type PutEventInput<Evnt extends Event> = Partial<Evnt> &
  Pick<Evnt, "detail" | "source" | "detail-type">;

/**
 * A Functionless wrapper for a AWS CDK {@link aws_events.EventBus}.
 *
 * Wrap your {@link aws_events.EventBus} instance with this class,
 * specify a type to represent the events passing through the EventBus,
 * and then use the .when, .map and .pipe functions to express
 * EventBus Event Patterns and Targets Inputs with native TypeScript syntax.
 *
 * Filtering events and sending them to Lambda.
 *
 * ```ts
 * interface Payload {
 *    value: string;
 * }
 *
 * // An event with the payload
 * interface myEvent extends Event<Payload> {}
 *
 * // A function that expects the payload.
 * const myLambdaFunction = new functionless.Function<Payload, void>(this, 'myFunction', ...);
 *
 * // instantiate an aws_events.EventBus Construct
 * const awsBus = new aws_events.EventBus(this, "mybus");
 *
 * // Wrap the aws_events.EventBus with the functionless.EventBus
 * new functionless.EventBus<myEvent>(awsBus)
 *    // when the payload is equal to some value
 *    .when(this, 'rule1', event => event.detail.value === "some value")
 *    // grab the payload
 *    .map(event => event.detail)
 *    // send to the function
 *    .pipe(myLambdaFunction);
 * ```
 *
 * Forwarding to another Event Bus based on some predicate:
 *
 * ```ts
 * // Using an imported event bus
 * const anotherEventBus = aws_event.EventBus.fromEventBusArn(...);
 *
 * new functionless.EventBus<myEvent>(awsBus)
 *    // when the payload is equal to some value
 *    .when(this, 'rule2', event => event.detail.value === "some value")
 *    // send verbatim to the other event bus
 *    .pipe(anotherEventBus);
 * ```
 *
 * @typeParam Evnt - the union type of events that this EventBus can accept.
 *                   `Evnt` is the covariant version of `OutEvnt` in that
 *                   the bus will accept any of `Evnt` while the EventBus can
 *                   emit any of `OutEvnt`.
 * @typeParam OutEvnt - the union type of events that this EventBus will emit through rules.
 *                      `OutEvnt` is the contravariant version of `Evnt` in that
 *                      the bus will emit any of `OutEvnt` while the EventBus can
 *                      can accept any of `Evnt`. This type parameter should be left
 *                      empty to be inferred. ex: `EventBus<Event<Detail1> | Event<Detail2>>`.
 */
export class EventBus<in Evnt extends Event, out OutEvnt extends Evnt = Evnt> extends EventBusBase<Evnt, OutEvnt> {
  constructor(scope: Construct, id: string, props?: aws_events.EventBusProps) {
    super(new aws_events.EventBus(scope, id, props));
  }

  /**
   * Import an {@link aws_events.IEventBus} wrapped with Functionless abilities.
   *
   * @typeParam Evnt - the union of types which are expected on the default {@link EventBus}.
   */
  public static fromBus<Evnt extends Event>(bus: aws_events.IEventBus): IEventBus<Evnt> {
    return new ImportedEventBus<Evnt>(bus);
  }

  /**
   * Retrieves the default event bus as a singleton on the given stack or the stack of the given construct.
   *
   * Equivalent to doing
   * ```ts
   * const awsBus = aws_events.EventBus.fromEventBusName(Stack.of(scope), id, "default");
   * new functionless.EventBus.fromBus(awsBus);
   * ```
   *
   * @typeParam Evnt - the union of types which are expected on the default {@link EventBus}.
   */
  public static default<Evnt extends Event>(stack: Stack): DefaultEventBus<Evnt>;
  public static default<Evnt extends Event>(scope: Construct): DefaultEventBus<Evnt>;
  public static default<Evnt extends Event>(
    scope: Construct | Stack
  ): DefaultEventBus<Evnt> {
    return new DefaultEventBus<Evnt>(scope);
  }

  /**
   * Creates a schedule based event bus rule on the default bus.
   *
   * Always sends the {@link ScheduledEvent} event.
   *
   * ```ts
   * // every hour
   * const everyHour = EventBus.schedule(scope, 'cron', aws_events.Schedule.rate(Duration.hours(1)));
   *
   * const func = new Function(scope, 'func', async (payload: {id: string}) => console.log(payload.id));
   *
   * everyHour
   *    .map(event => ({id: event.id}))
   *    .pipe(func);
   * ```
   */
  public static schedule(
    scope: Construct,
    id: string,
    schedule: aws_events.Schedule,
    props?: Omit<
      aws_events.RuleProps,
      "schedule" | "eventBus" | "eventPattern" | "targets"
    >
  ): ImportedRule<ScheduledEvent> {
    return EventBus.default(scope).schedule(scope, id, schedule, props);
  }
}

/**
 * @typeParam Evnt - the union type of events that this EventBus can accept.
 *                   `Evnt` is the covariant version of `OutEvnt` in that
 *                   the bus will accept any of `Evnt` while the EventBus can
 *                   emit any of `OutEvnt`.
 * @typeParam OutEvnt - the union type of events that this EventBus will emit through rules.
 *                      `OutEvnt` is the contravariant version of `Evnt` in that
 *                      the bus will emit any of `OutEvnt` while the EventBus can
 *                      can accept any of `Evnt`. This type parameter should be left
 *                      empty to be inferred. ex: `EventBus<Event<Detail1> | Event<Detail2>>`.
 */
export class DefaultEventBus<in Evnt extends Event, out OutEvnt extends Evnt = Evnt> extends EventBusBase<Evnt, OutEvnt> {
  constructor(scope: Construct) {
    const stack = scope instanceof Stack ? scope : Stack.of(scope);
    const bus =
      (stack.node.tryFindChild(
        EventBusBase.singletonDefaultNode
      ) as aws_events.IEventBus) ??
      aws_events.EventBus.fromEventBusName(
        stack,
        EventBusBase.singletonDefaultNode,
        "default"
      );

    super(bus);
  }

  /**
   * Creates a schedule based event bus rule on the default bus.
   *
   * Always sends the {@link ScheduledEvent} event.
   *
   * ```ts
   * const bus = EventBus.default(scope);
   * // every hour
   * const everyHour = bus.schedule(scope, 'cron', aws_events.Schedule.rate(Duration.hours(1)));
   *
   * const func = new Function(scope, 'func', async (payload: {id: string}) => console.log(payload.id));
   *
   * everyHour
   *    .map(event => ({id: event.id}))
   *    .pipe(func);
   * ```
   */
  public schedule(
    scope: Construct,
    id: string,
    schedule: aws_events.Schedule,
    props?: Omit<
      aws_events.RuleProps,
      "schedule" | "eventBus" | "eventPattern" | "targets"
    >
  ): ImportedRule<ScheduledEvent> {
    return new ImportedRule<ScheduledEvent>(
      new aws_events.Rule(scope, id, {
        ...props,
        schedule,
      })
    );
  }
}

/**
 * @typeParam Evnt - the union type of events that this EventBus can accept.
 *                   `Evnt` is the covariant version of `OutEvnt` in that
 *                   the bus will accept any of `Evnt` while the EventBus can
 *                   emit any of `OutEvnt`.
 * @typeParam OutEvnt - the union type of events that this EventBus will emit through rules.
 *                      `OutEvnt` is the contravariant version of `Evnt` in that
 *                      the bus will emit any of `OutEvnt` while the EventBus can
 *                      can accept any of `Evnt`. This type parameter should be left
 *                      empty to be inferred. ex: `EventBus<Event<Detail1> | Event<Detail2>>`.
 */
class ImportedEventBus<in Evnt extends Event, out OutEvnt extends Evnt = Evnt> extends EventBusBase<Evnt, OutEvnt> {
  constructor(bus: aws_events.IEventBus) {
    super(bus);
  }
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
  __payloadBrand: ((p: Payload) => void);

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

export type IntegrationWithEventBus<
  Payload,
  Props extends object | undefined = undefined
> = Integration<string, AnyFunction, EventBusTargetIntegration<Payload, Props>>;

/**
 * @typeParam - Payload - the type which the {@link Integration} expects as an input from {@link EventBus}.
 * @typeParam - Props - the optional properties the {@link Integration} accepts. Leave undefined to require no properties.
 */
export function makeEventBusIntegration<
  Payload,
  Props extends object | undefined = undefined
>(integration: Omit<EventBusTargetIntegration<Payload, Props>, "__payloadBrand">) {
  return integration as EventBusTargetIntegration<Payload, Props>;
}

export type DynamicProps<Props extends object | undefined> =
  Props extends object ? (props: Props) => void : (props?: Props) => void;

/**
 * Add a target to the run based on the configuration given.
 */
export function pipe<
  Evnt extends Event,
  Payload,
  Props extends object | undefined = undefined,
  Target extends aws_events.RuleTargetInput | undefined =
    | aws_events.RuleTargetInput
    | undefined
>(
  rule: IRule<any, Evnt>,
  integration:
    | IntegrationWithEventBus<Payload, Props>
    | ((targetInput: Target) => aws_events.IRuleTarget),
  props: Props,
  targetInput: Target
) {
  if (isIntegration<IntegrationWithEventBus<Payload, Props>>(integration)) {
    const target = new IntegrationImpl(integration).eventBus.target(
      props,
      targetInput
    );
    return rule.rule.addTarget(target);
  } else {
    return rule.rule.addTarget(integration(targetInput));
  }
}
