import {
  CallExpr,
  Expr,
  Identifier,
  isArrayLiteralExpr,
  isComputedPropertyNameExpr,
  isIdentifier,
  isObjectLiteralExpr,
  isPrivateIdentifier,
  isPropAssignExpr,
  isSpreadAssignExpr,
  PropAssignExpr,
  StringLiteralExpr,
} from "@functionless/ast";
import {
  aws_apigateway,
  aws_events,
  aws_events_targets,
  Stack,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { ASL, ASLGraph } from "@functionless/asl-graph";
import { ErrorCodes, SynthError } from "@functionless/error-code";

import {
  RulePredicateFunction,
  Rule,
  PredicateRuleBase,
  ImportedRule,
  ScheduledEvent,
  IRule,
} from "./rule";
import {
  Event,
  EventBridgeClient,
  EventBusTargetIntegration,
  isEventBusIntegration,
} from "@functionless/aws-events";
import {
  NativeIntegration,
  NativeRuntimeEnvironment,
} from "@functionless/aws-lambda";
import { ApiGatewayVtlIntegration } from "packages/@functionless/aws-apigateway/lib";

export const isEventBus = <EvntBus extends IEventBus<any>>(
  v: any
): v is EvntBus => {
  return (
    "functionlessKind" in v &&
    v.functionlessKind === EventBusBase.FunctionlessType
  );
};

/**
 * Returns the {@link Event} type on the {@link EventBus}.
 */
export type EventBusEvent<B extends IEventBus<any>> = [B] extends [
  IEventBus<infer E>
]
  ? E
  : never;

export interface IEventBusFilterable<in Evnt extends Event> {
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
  when<InEvnt extends Evnt, NewEvnt extends InEvnt>(
    id: string,
    predicate: RulePredicateFunction<InEvnt, NewEvnt>
  ): Rule<InEvnt, NewEvnt>;
  when<InEvnt extends Evnt, NewEvnt extends InEvnt>(
    scope: Construct,
    id: string,
    predicate: RulePredicateFunction<InEvnt, NewEvnt>
  ): Rule<InEvnt, NewEvnt>;
}

const ENTRY_PROPERTY_MAP: Record<keyof Event, string> = {
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

/**
 * @typeParam Evnt - the union type of events that this EventBus can accept.
 *                   `Evnt` is the contravariant version of `OutEvnt` in that
 *                   the bus will accept any of `Evnt` while the EventBus can
 *                   emit any of `OutEvnt`.
 */
export interface IEventBus<in Evnt extends Event = Event>
  extends IEventBusFilterable<Evnt> {
  readonly resource: aws_events.IEventBus;
  readonly eventBusArn: string;
  readonly eventBusName: string;

  // @ts-ignore - value does not exist, is only available at compile time
  readonly __functionBrand: (
    event: PutEventInput<Evnt>,
    ...events: PutEventInput<Evnt>[]
  ) => Promise<void>;

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
  ): Promise<void>;

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
  all<OutEnvt extends Evnt>(): PredicateRuleBase<Evnt, OutEnvt>;
  all<OutEnvt extends Evnt>(
    scope: Construct,
    id: string
  ): PredicateRuleBase<Evnt, OutEnvt>;
}

/**
 * @typeParam Evnt - the union type of events that this EventBus can accept.
 *                   `Evnt` is the contravariant version of `OutEvnt` in that
 *                   the bus will accept any of `Evnt` while the EventBus can
 *                   emit any of `OutEvnt`.
 * @typeParam OutEvnt - the union type of events that this EventBus will emit through rules.
 *                      `OutEvnt` is the covariant version of `Evnt` in that
 *                      the bus will emit any of `OutEvnt` while the EventBus can
 *                      can accept any of `Evnt`. This type parameter should be left
 *                      empty to be inferred. ex: `EventBus<Event<Detail1> | Event<Detail2>>`.
 */
abstract class EventBusBase<in Evnt extends Event, OutEvnt extends Evnt = Evnt>
  implements IEventBus<Evnt>
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

  private allRule: PredicateRuleBase<Evnt, OutEvnt> | undefined;

  public readonly putEvents: IEventBus<Evnt>["putEvents"];

  // @ts-ignore - value does not exist, is only available at compile time
  readonly __functionBrand: (
    event: PutEventInput<Evnt>,
    ...events: PutEventInput<Evnt>[]
  ) => Promise<void>;

  constructor(readonly resource: aws_events.IEventBus) {
    this.eventBusName = resource.eventBusName;
    this.eventBusArn = resource.eventBusArn;

    // Closure event bus base
    const eventBusName = this.eventBusName;

    this.putEvents = <any>{
      kind: "EventBus.putEvents",
      asl: (call: CallExpr, context: ASL) => {
        this.resource.grantPutEventsTo(context.role);

        // Validate that the events are object literals.
        // Then normalize nested arrays of events into a single list of events.
        // TODO Relax these restrictions: https://github.com/functionless/functionless/issues/101
        const eventObjs = call.args.flatMap(({ expr: arg }) => {
          if (isArrayLiteralExpr(arg)) {
            if (!arg.items.every(isObjectLiteralExpr)) {
              throw new SynthError(
                ErrorCodes.StepFunctions_calls_to_EventBus_PutEvents_must_use_object_literals
              );
            }
            return arg.items;
          } else if (isObjectLiteralExpr(arg)) {
            return [arg];
          }
          throw new SynthError(
            ErrorCodes.StepFunctions_calls_to_EventBus_PutEvents_must_use_object_literals
          );
        });

        // The interface should prevent this.
        if (eventObjs.length === 0) {
          throw Error("Must provide at least one event.");
        }

        return context.evalContext(call, ({ evalExprToJsonPathOrLiteral }) => {
          const events = eventObjs.map((event) => {
            const props = event.properties.filter(
              (
                e
              ): e is PropAssignExpr & {
                name: StringLiteralExpr | Identifier;
              } =>
                !(isSpreadAssignExpr(e) || isComputedPropertyNameExpr(e.name))
            );
            if (props.length < event.properties.length) {
              throw new SynthError(
                ErrorCodes.StepFunctions_calls_to_EventBus_PutEvents_must_use_object_literals
              );
            }
            const evaluatedProps = props.map(({ name, expr }) => {
              const val = evalExprToJsonPathOrLiteral(expr);
              return {
                name: isIdentifier(name) ? name.name : name.value,
                value: val,
              };
            });

            return {
              event: evaluatedProps
                .filter(
                  (
                    x
                  ): x is {
                    name: keyof typeof ENTRY_PROPERTY_MAP;
                    value: ASLGraph.LiteralValue | ASLGraph.JsonPath;
                  } => x.name in ENTRY_PROPERTY_MAP
                )
                /**
                 * Build the parameter payload for an event entry.
                 * All members must be in Pascal case.
                 */
                .reduce(
                  (acc: Record<string, any>, { name, value }) => ({
                    ...acc,
                    ...ASLGraph.jsonAssignment(ENTRY_PROPERTY_MAP[name], value),
                  }),
                  { EventBusName: this.resource.eventBusArn }
                ),
            };
          });

          return context.stateWithHeapOutput({
            Resource: "arn:aws:states:::events:putEvents",
            Type: "Task",
            Parameters: {
              Entries: events.map(({ event }) => event),
            },
            Next: ASLGraph.DeferNext,
          });
        });
      },
      apiGWVtl: <ApiGatewayVtlIntegration>{
        renderRequest: (call, context): string => {
          const args = call.args
            .map((arg) => arg.expr)
            .filter((arg): arg is Expr => !!arg)
            .flatMap((arg) => (isArrayLiteralExpr(arg) ? arg.items : arg));

          context.set(
            "$context.requestOverride.header.X-Amz-Target",
            '"AWSEvents.PutEvents"'
          );
          context.set(
            "$context.requestOverride.header.Content-Type",
            '"application/x-amz-json-1.1"'
          );

          const argObjects = args.map((arg) => {
            if (!isObjectLiteralExpr(arg)) {
              throw new SynthError(
                ErrorCodes.Expected_an_object_literal,
                "API Gateway Integration with EventBus.putEvents expects object literals with no computed properties"
              );
            }

            const objectProps = arg.properties.map((prop) => {
              if (
                !isPropAssignExpr(prop) ||
                isComputedPropertyNameExpr(prop.name)
              ) {
                throw new SynthError(
                  ErrorCodes.Expected_an_object_literal,
                  "API Gateway Integration with EventBus.putEvents expects object literals with no computed properties"
                );
              }
              const propName =
                isIdentifier(prop.name) || isPrivateIdentifier(prop.name)
                  ? prop.name.name
                  : prop.name.value;
              const fieldName = ENTRY_PROPERTY_MAP[propName as keyof Event];

              if (!fieldName) {
                throw new SynthError(
                  ErrorCodes.Invalid_Input,
                  `Unexpected field name in EventBus.putEvents object ${propName}`
                );
              }

              const content =
                fieldName === "Resources"
                  ? isArrayLiteralExpr(prop.expr)
                    ? `[${prop.expr.items
                        .map((item) => context.stringify(item))
                        .join(",")}]`
                    : context.stringify(prop.expr)
                  : context.stringify(prop.expr);

              return `"${fieldName}":${content}`;
            });

            return `{
  ${objectProps.join(",\n")},
  "EventBusName":"${this.resource.eventBusName}"
}`;
          });

          /**
           * {
           *    "Entries": [
           *        {
           *             "Source": "",
           *             "Detail-Type": "",
           *             "Detail": ...
           *        }
           *    ]
           * }
           */
          return `{\n"Entries":[${argObjects.join(",\n")}\n]}`;
        },
        createIntegration: (options) => {
          const credentialsRole = options.credentialsRole;

          this.resource.grantPutEventsTo(credentialsRole);

          return new aws_apigateway.AwsIntegration({
            service: "events",
            action: "PutEvents",
            integrationHttpMethod: "POST",
            options: {
              ...options,
              credentialsRole,
              passthroughBehavior: aws_apigateway.PassthroughBehavior.NEVER,
            },
          });
        },
      },
      native: <NativeIntegration<IEventBus<Evnt>["putEvents"]>>{
        bind: (context) => {
          this.resource.grantPutEventsTo(context);
        },
        preWarm: (prewarmContext: NativeRuntimeEnvironment) => {
          prewarmContext.getOrInit(EventBridgeClient);
        },
        call: async (args, preWarmContext) => {
          const eventBridge = preWarmContext.getOrInit(EventBridgeClient);
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
    };
  }

  public readonly eventBus = makeEventBusIntegration<
    PutEventInput<Evnt>,
    aws_events_targets.EventBusProps | undefined
  >({
    target: (props: any, targetInput: any) => {
      if (targetInput) {
        throw new Error("Event bus rule target does not support target input.");
      }

      return new aws_events_targets.EventBus(this.resource, props);
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
        this.resource,
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
          this.resource,
          "all",
          this as IEventBus<Evnt>,
          // an empty doc will be converted to `{ source: [{ prefix: "" }]}`
          { doc: {} }
        );
      }
      return this.allRule;
    }
    return new PredicateRuleBase<Evnt, OutEvnt>(
      scope,
      id,
      this as IEventBus<Evnt>,
      {
        doc: {},
      }
    );
  }
}

export type PutEventInput<Evnt extends Event> = Partial<Evnt> &
  Pick<Evnt, "detail" | "source" | "detail-type"> & {
    "trace-header"?: string;
  };

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
 *                   `Evnt` is the contravariant version of `OutEvnt` in that
 *                   the bus will accept any of `Evnt` while the EventBus can
 *                   emit any of `OutEvnt`.
 * @typeParam OutEvnt - the union type of events that this EventBus will emit through rules.
 *                      `OutEvnt` is the covariant version of `Evnt` in that
 *                      the bus will emit any of `OutEvnt` while the EventBus can
 *                      can accept any of `Evnt`. This type parameter should be left
 *                      empty to be inferred. ex: `EventBus<Event<Detail1> | Event<Detail2>>`.
 */
export class EventBus<
  in Evnt extends Event,
  out OutEvnt extends Evnt = Evnt
> extends EventBusBase<Evnt, OutEvnt> {
  constructor(scope: Construct, id: string, props?: aws_events.EventBusProps) {
    super(new aws_events.EventBus(scope, id, props));
  }

  /**
   * Import an {@link aws_events.IEventBus} wrapped with Functionless abilities.
   *
   * @typeParam Evnt - the union of types which are expected on the default {@link EventBus}.
   */
  public static fromBus<Evnt extends Event>(
    bus: aws_events.IEventBus
  ): IEventBus<Evnt> {
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
  public static default<Evnt extends Event>(
    stack: Stack
  ): DefaultEventBus<Evnt>;
  public static default<Evnt extends Event>(
    scope: Construct
  ): DefaultEventBus<Evnt>;
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
 *                   `Evnt` is the contravariant version of `OutEvnt` in that
 *                   the bus will accept any of `Evnt` while the EventBus can
 *                   emit any of `OutEvnt`.
 * @typeParam OutEvnt - the union type of events that this EventBus will emit through rules.
 *                      `OutEvnt` is the covariant version of `Evnt` in that
 *                      the bus will emit any of `OutEvnt` while the EventBus can
 *                      can accept any of `Evnt`. This type parameter should be left
 *                      empty to be inferred. ex: `EventBus<Event<Detail1> | Event<Detail2>>`.
 */
export class DefaultEventBus<
  in Evnt extends Event,
  out OutEvnt extends Evnt = Evnt
> extends EventBusBase<Evnt, OutEvnt> {
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
 *                   `Evnt` is the contravariant version of `OutEvnt` in that
 *                   the bus will accept any of `Evnt` while the EventBus can
 *                   emit any of `OutEvnt`.
 * @typeParam OutEvnt - the union type of events that this EventBus will emit through rules.
 *                      `OutEvnt` is the covariant version of `Evnt` in that
 *                      the bus will emit any of `OutEvnt` while the EventBus can
 *                      can accept any of `Evnt`. This type parameter should be left
 *                      empty to be inferred. ex: `EventBus<Event<Detail1> | Event<Detail2>>`.
 */
class ImportedEventBus<
  in Evnt extends Event,
  out OutEvnt extends Evnt = Evnt
> extends EventBusBase<Evnt, OutEvnt> {
  constructor(bus: aws_events.IEventBus) {
    super(bus);
  }
}

export type IntegrationWithEventBus<
  Payload,
  Props extends object | undefined = undefined
> = {
  eventBus: EventBusTargetIntegration<Payload, Props>;
};

/**
 * @typeParam - Payload - the type which the {@link Integration} expects as an input from {@link EventBus}.
 * @typeParam - Props - the optional properties the {@link Integration} accepts. Leave undefined to require no properties.
 */
export function makeEventBusIntegration<
  Payload,
  Props extends object | undefined = undefined
>(
  integration: Omit<EventBusTargetIntegration<Payload, Props>, "__payloadBrand">
) {
  return integration as EventBusTargetIntegration<Payload, Props>;
}

export type DynamicProps<Props> = Props extends never
  ? never
  : [Props] extends [undefined]
  ? (props?: Props | undefined) => void
  : (props: Props) => void;

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
  rule: IRule<Evnt>,
  integration:
    | IntegrationWithEventBus<Payload, Props>
    | ((targetInput: Target) => aws_events.IRuleTarget),
  props: Props,
  targetInput: Target
) {
  if (isEventBusIntegration(integration)) {
    const target = integration.eventBus.target(props, targetInput);
    return rule.resource.addTarget(target);
  } else {
    return rule.resource.addTarget((integration as any)(targetInput));
  }
}
