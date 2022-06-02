import { aws_events, Stack } from "aws-cdk-lib";
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
import { Integration, IntegrationCall, makeIntegration } from "../integration";
import {
  Rule,
  RulePredicateFunction,
  ImportedRule,
  ScheduledEvent,
  PredicateRuleBase as PredicateRuleBase,
} from "./rule";
import { Event } from "./types";

export const isEventBus = <E extends Event>(v: any): v is IEventBus<E> => {
  return (
    "functionlessKind" in v &&
    v.functionlessKind === EventBusBase.FunctionlessType
  );
};

/**
 * Returns the {@link Event} type on the {@link EventBus}.
 */
export type EventBusEvent<B extends IEventBus<any>> = [B] extends [IEventBus<infer E>] ? E : never;

export interface IEventBusFilterable<E extends Event> {
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
   */
  when<O extends E>(
    id: string,
    predicate: RulePredicateFunction<E, O>
  ): Rule<E, O>;
  when<O extends E>(
    scope: Construct,
    id: string,
    predicate: RulePredicateFunction<E, O>
  ): Rule<E, O>;
}

export interface IEventBus<in E extends Event = Event>
  extends IEventBusFilterable<E> {
  readonly bus: aws_events.IEventBus;
  readonly eventBusArn: string;
  readonly eventBusName: string;

  /**
   * This static property identifies this class as an EventBus to the TypeScript plugin.
   */
  readonly functionlessKind: typeof EventBusBase.FunctionlessType;

  /**
   * Put one or more events on an Event Bus.
   */
  putEvents(
    event: EventBusPutEventInput<E>,
    ...events: EventBusPutEventInput<E>[]
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
  all(): PredicateRuleBase<E>;
  all(scope: Construct, id: string): PredicateRuleBase<E>;
}

abstract class EventBusBase<E extends Event>
  implements IEventBus<E>, Integration
{
  /**
   * This static properties identifies this class as an EventBus to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "EventBus";
  readonly functionlessKind = "EventBus";
  readonly kind = "EventBus";
  readonly eventBusName: string;
  readonly eventBusArn: string;

  protected static singletonDefaultNode = "__DefaultBus";

  private allRule: PredicateRuleBase<E> | undefined;

  public readonly putEvents: IntegrationCall<
    IEventBus<E>["putEvents"],
    "EventBus.putEvents"
  >;

  constructor(readonly bus: aws_events.IEventBus) {
    this.eventBusName = bus.eventBusName;
    this.eventBusArn = bus.eventBusArn;

    // Closure event bus base
    const eventBusName = this.eventBusName;

    this.putEvents = makeIntegration<
      IEventBus<E>["putEvents"],
      "EventBus.putEvents"
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

  public when<O extends E>(
    id: string,
    predicate: RulePredicateFunction<E, O>
  ): Rule<E, O>;
  public when<O extends E>(
    scope: Construct,
    id: string,
    predicate: RulePredicateFunction<E, O>
  ): Rule<E, O>;
  public when<O extends E>(
    scope: Construct | string,
    id?: string | RulePredicateFunction<E, O>,
    predicate?: RulePredicateFunction<E, O>
  ): Rule<E, O> {
    if (predicate) {
      return new Rule<E, O>(
        scope as Construct,
        id as string,
        this as any,
        predicate
      );
    } else {
      return new Rule<E, O>(
        this.bus,
        scope as string,
        this as any,
        id as RulePredicateFunction<E, O>
      );
    }
  }

  public all(): PredicateRuleBase<E>;
  public all(scope: Construct, id: string): PredicateRuleBase<E>;
  public all(scope?: Construct, id?: string): PredicateRuleBase<E> {
    if (!scope || !id) {
      if (!this.allRule) {
        this.allRule = new PredicateRuleBase<E>(
          this.bus,
          "all",
          this as IEventBus<any>,
          // an empty doc will be converted to `{ source: [{ prefix: "" }]}`
          { doc: {} }
        );
      }
      return this.allRule;
    }
    return new PredicateRuleBase<E>(scope, id, this as IEventBus<any>, {
      doc: {},
    });
  }
}

export type EventBusPutEventInput<E extends Event> = Partial<E> &
  Pick<E, "detail" | "source" | "detail-type">;

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
 */
export class EventBus<E extends Event> extends EventBusBase<E> {
  constructor(scope: Construct, id: string, props?: aws_events.EventBusProps) {
    super(new aws_events.EventBus(scope, id, props));
  }

  /**
   * Import an {@link aws_events.IEventBus} wrapped with Functionless abilities.
   */
  public static fromBus<E extends Event>(bus: aws_events.IEventBus): IEventBus<E> {
    return new ImportedEventBus<E>(bus);
  }

  /**
   * Retrieves the default event bus as a singleton on the given stack or the stack of the given construct.
   *
   * Equivalent to doing
   * ```ts
   * const awsBus = aws_events.EventBus.fromEventBusName(Stack.of(scope), id, "default");
   * new functionless.EventBus.fromBus(awsBus);
   * ```
   */
  public static default<E extends Event>(stack: Stack): DefaultEventBus<E>;
  public static default<E extends Event>(scope: Construct): DefaultEventBus<E>;
  public static default<E extends Event>(
    scope: Construct | Stack
  ): DefaultEventBus<E> {
    return new DefaultEventBus<E>(scope);
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

export class DefaultEventBus<E extends Event> extends EventBusBase<E> {
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

class ImportedEventBus<E extends Event> extends EventBusBase<E> {
  constructor(bus: aws_events.IEventBus) {
    super(bus);
  }
}
