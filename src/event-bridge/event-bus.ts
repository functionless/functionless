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
import { Integration, IntegrationImpl } from "../integration";
import { EventBusRule, EventPredicateFunction, IEventBusRule } from "./rule";
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
    scope: Construct,
    id: string,
    predicate: EventPredicateFunction<E, O>
  ): EventBusRule<E, O>;
}

export interface IEventBus<E extends EventBusRuleInput = EventBusRuleInput>
  extends IEventBusFilterable<E>,
    Integration<
      (event: Partial<E>, ...events: Partial<E>[]) => void,
      "EventBus",
      aws_events_targets.EventBusProps | undefined
    > {
  readonly bus: aws_events.IEventBus;
  readonly eventBusArn: string;
  readonly eventBusName: string;

  // @ts-ignore - value does not exist, is only available at compile time
  readonly __functionBrand: (
    event: Partial<E>,
    ...events: Partial<E>[]
  ) => void;

  /**
   * This static property identifies this class as an EventBus to the TypeScript plugin.
   */
  readonly functionlessKind: typeof EventBusBase.FunctionlessType;

  /**
   * Put one or more events on an Event Bus.
   */
  (event: Partial<E>, ...events: Partial<E>[]): void;

  eventBus: EventBusTargetIntegration<
    E,
    aws_events_targets.EventBusProps | undefined
  >;
}
abstract class EventBusBase<E extends EventBusRuleInput>
  implements
    IEventBus<E>,
    Integration<
      (event: Partial<E>, ...events: Partial<E>[]) => void,
      "EventBus",
      aws_events_targets.EventBusProps | undefined
    >
{
  /**
   * This static properties identifies this class as an EventBus to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "EventBus";
  readonly functionlessKind = "EventBus";
  readonly kind = "EventBus";
  readonly eventBusName: string;
  readonly eventBusArn: string;

  constructor(readonly bus: aws_events.IEventBus) {
    this.eventBusName = bus.eventBusName;
    this.eventBusArn = bus.eventBusArn;
  }

  // @ts-ignore - value does not exist, is only available at compile time
  readonly __functionBrand: (
    event: Partial<E>,
    ...events: Partial<E>[]
  ) => void;

  asl(call: CallExpr, context: ASL) {
    this.bus.grantPutEventsTo(context.role);

    // Validate that the events are object literals.
    // Then normalize nested arrays of events into a single list of events.
    // TODO Relax these restrictions: https://github.com/functionless/functionless/issues/101
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
   * @internal
   */
  public readonly eventBus: EventBusTargetIntegration<
    E,
    aws_events_targets.EventBusProps | undefined
  > = {
    target: (props, targetInput?) => {
      if (targetInput) {
        throw new Error("Event bus rule target does not support target input.");
      }

      return new aws_events_targets.EventBus(this.bus, {
        deadLetterQueue: props?.deadLetterQueue,
        role: props?.role,
      });
    },
  };

  /**
   * @inheritdoc
   */
  when<O extends E>(
    scope: Construct,
    id: string,
    predicate: EventPredicateFunction<E, O>
  ): EventBusRule<E, O> {
    return new EventBusRule<E, O>(scope, id, this as any, predicate);
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

  static #singletonDefaultNode = "__DefaultBus";

  /**
   * Retrieves the default event bus as a singleton on the given stack or the stack of the given construct.
   *
   * Equivalent to doing
   * ```ts
   * const awsBus = aws_events.EventBus.fromEventBusName(Stack.of(scope), id, "default");
   * new functionless.EventBus.fromBus(awsBus);
   * ```
   */
  static default<E extends EventBusRuleInput>(stack: Stack): IEventBus<E>;
  static default<E extends EventBusRuleInput>(scope: Construct): IEventBus<E>;
  static default<E extends EventBusRuleInput>(
    scope: Construct | Stack
  ): IEventBus<E> {
    const stack = scope instanceof Stack ? scope : Stack.of(scope);
    const bus =
      (stack.node.tryFindChild(
        EventBus.#singletonDefaultNode
      ) as aws_events.IEventBus) ??
      aws_events.EventBus.fromEventBusName(
        stack,
        EventBus.#singletonDefaultNode,
        "default"
      );

    return EventBus.fromBus<E>(bus);
  }
}

class ImportedEventBus<E extends EventBusRuleInput> extends EventBusBase<E> {
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
 * new EventBus().when(() => true).pipe(myEbIntegration);
 * ```
 */
export interface EventBusTargetIntegration<
  // the payload type we expect to be transformed into before making this call.
  _P,
  Props extends object | undefined = undefined
> {
  target: (
    props: Props,
    targetInput?: aws_events.RuleTargetInput
  ) => aws_events.IRuleTarget;
}

export interface IntegrationWithEventBus<
  P,
  Props extends object | undefined = undefined
> {
  eventBus: EventBusTargetIntegration<P, Props>;
}

export type DynamicProps<Props extends object | undefined> =
  Props extends object ? (props: Props) => void : (props?: Props) => void;

/**
 * Add a target to the run based on the configuration given.
 */
export function pipe<
  T extends EventBusRuleInput,
  P,
  Props extends object | undefined = undefined
>(
  rule: IEventBusRule<T>,
  integration: IntegrationWithEventBus<P, Props>,
  props: Props,
  targetInput?: aws_events.RuleTargetInput
) {
  const target = new IntegrationImpl(integration as any).eventBus.target(
    props,
    targetInput
  );
  return rule.rule.addTarget(target);
}
