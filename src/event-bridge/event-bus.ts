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
import { Integration } from "../integration";
import {
  Rule,
  EventPredicateFunction,
  ImportedRule,
  ScheduledEvent,
  EventBusPredicateRuleBase,
} from "./rule";
import { EventBusRuleInput } from "./types";

export const isEventBus = <E extends EventBusRuleInput>(
  v: any
): v is IEventBus<E> => {
  return (
    "functionlessKind" in v &&
    v.functionlessKind === EventBusBase.FunctionlessType
  );
};

export interface IEventBusFilterable<E extends EventBusRuleInput> {
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
    predicate: EventPredicateFunction<E, O>
  ): Rule<E, O>;
  when<O extends E>(
    scope: Construct,
    id: string,
    predicate: EventPredicateFunction<E, O>
  ): Rule<E, O>;
}

export interface IEventBus<E extends EventBusRuleInput = EventBusRuleInput>
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
  (event: Partial<E>, ...events: Partial<E>[]): void;

  /**
   * Creates a rule that matches all events on the bus.
   *
   * When no scope or id are given, the bus is used as the scope and the id will be `whenAny`.
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
   *  .whenAny()
   *  .map(event => ({id: event.id}))
   *  .pipe(func);
   * ```
   */
  whenAny(): EventBusPredicateRuleBase<E>;
  whenAny(scope: Construct, id: string): EventBusPredicateRuleBase<E>;
}
abstract class EventBusBase<E extends EventBusRuleInput>
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

  private whenAnyRule: EventBusPredicateRuleBase<E> | undefined;

  constructor(readonly bus: aws_events.IEventBus) {
    this.eventBusName = bus.eventBusName;
    this.eventBusArn = bus.eventBusArn;
  }

  asl(call: CallExpr, context: ASL) {
    this.bus.grantPutEventsTo(context.role);

    // Validate that the events are object literals.
    // Then normalize nested arrays of events into a single list of events.
    // TODO Relax these restrictions: https://github.com/sam-goodwin/functionless/issues/101
    const eventObjs = call.args.reduce((events: ObjectLiteralExpr[], arg) => {
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
    }, []);

    // The interface should prevent this.
    if (eventObjs.length === 0) {
      throw Error("Must provide at least one event.");
    }

    const propertyMap: Record<keyof EventBusRuleInput, string> = {
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
  }

  /**
   * @inheritdoc
   */
  when<O extends E>(
    id: string,
    predicate: EventPredicateFunction<E, O>
  ): Rule<E, O>;
  when<O extends E>(
    scope: Construct,
    id: string,
    predicate: EventPredicateFunction<E, O>
  ): Rule<E, O>;
  when<O extends E>(
    scope: Construct | string,
    id?: string | EventPredicateFunction<E, O>,
    predicate?: EventPredicateFunction<E, O>
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
        id as EventPredicateFunction<E, O>
      );
    }
  }

  /**
   * @inheritdoc
   */
  whenAny(): EventBusPredicateRuleBase<E>;
  whenAny(scope: Construct, id: string): EventBusPredicateRuleBase<E>;
  whenAny(scope?: Construct, id?: string): EventBusPredicateRuleBase<E> {
    if (!scope || !id) {
      if (!this.whenAnyRule) {
        this.whenAnyRule = new EventBusPredicateRuleBase<E>(
          this.bus,
          "whenAny",
          this as IEventBus<any>,
          // an empty doc will be converted to `{ source: [{ prefix: "" }]}`
          { doc: {} }
        );
      }
      return this.whenAnyRule;
    }
    return new EventBusPredicateRuleBase<E>(scope, id, this as IEventBus<any>, {
      doc: {},
    });
  }
}

interface EventBusBase<E extends EventBusRuleInput> {
  (event: Partial<E>, ...events: Partial<E>[]): void;
}

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
 * interface myEvent extends EventBusRuleInput<Payload> {}
 *
 * const myAwsFunction = new aws_lambda.Function(this, 'myFunction', { ... });
 * // A function that expects the payload.
 * const myLambdaFunction = new functionless.Function<Payload, void>(myAwsFunction);
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
export class EventBus<E extends EventBusRuleInput> extends EventBusBase<E> {
  constructor(scope: Construct, id: string, props?: aws_events.EventBusProps) {
    super(new aws_events.EventBus(scope, id, props));
  }

  /**
   * Import an {@link aws_events.IEventBus} wrapped with Functionless abilities.
   */
  static fromBus<E extends EventBusRuleInput>(
    bus: aws_events.IEventBus
  ): IEventBus<E> {
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
  static default<E extends EventBusRuleInput>(stack: Stack): DefaultEventBus<E>;
  static default<E extends EventBusRuleInput>(
    scope: Construct
  ): DefaultEventBus<E>;
  static default<E extends EventBusRuleInput>(
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
  static schedule(
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

export class DefaultEventBus<
  E extends EventBusRuleInput
> extends EventBusBase<E> {
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
  schedule(
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

class ImportedEventBus<E extends EventBusRuleInput> extends EventBusBase<E> {
  constructor(bus: aws_events.IEventBus) {
    super(bus);
  }
}
