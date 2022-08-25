import type { Construct } from "constructs";
import type { EventBatch, EventSource, IEventSource } from "./event-source";
import type { Function, FunctionProps } from "./function";
// @ts-ignore - tsdoc
import type { Queue } from "./queue";

export type Processor<
  Item = any,
  Processed = any,
  Record = any,
  Event = any,
  Raw = any
> = (
  item: Item,
  record: Record,
  event: Event,
  raw: Raw
) => Processed | Promise<Processed>;

export type BatchProcessor<Element, Event, Raw> = (
  batch: Element[],
  event: Event,
  raw: Raw
) => Promise<void>;

/**
 * The {@link IIterable} interface provides utility functions for working with streams of data.
 *
 * @see {@link Queue}
 */
export interface IIterable<
  Item,
  RawEvent,
  ParsedEvent,
  ParsedRecord,
  Response,
  EventSourceConfig
> {
  /**
   * Map over each {@link Item} and apply a transformation function.
   *
   * ```ts
   * // transformations can be synchronous
   * it.map((item: string) => item.length)
   *   .forEach((item: number) => ..)
   *
   * // transformations can also be asynchronous
   * it.map(async (item: string) => client.getCount(item));
   *   .forEach((item: number) => ..)
   * ```
   *
   * @param callbackfn function to apply to each {@link Item}.
   */
  map<U>(
    callbackfn: Processor<Item, U, ParsedRecord, ParsedEvent, RawEvent>
  ): IIterable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  /**
   * Calls a defined callback function on each element of an array. Then, flattens
   * the result into a new array.
   *
   * ```ts
   * // transformations can be synchronous
   * it.flatMap((item: string) => [item.length])
   *   .forEach((item: number) => ..)
   *
   * // transformations can also be asynchronous
   * it.flatMap(async (item: string) => [client.getCount(item)]);
   *   .forEach((item: number) => ..)
   * ```
   *
   * @param callbackfn The flatMap method calls the callback function one time for each element in the array.
   */
  flatMap<U>(
    callbackfn: Processor<Item, U[], ParsedRecord, ParsedEvent, RawEvent>
  ): IIterable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  /**
   * Returns the elements that meet the condition specified in a callback function.
   *
   * ```ts
   * // filters can be synchronous
   * it.filter(item => item.length > 0)
   *
   * // filters can call asynchronous code, such as an API client
   * it.filter(async item => client.get())
   * ```
   *
   * @param predicate The filter method calls the predicate function one time for each element in {@link Iterable} and returns a new {@link Iterable} containing only those elements where the {@link predicate} returns `true`.
   */
  filter<U extends Item>(
    predicate: (
      item: Item,
      record: ParsedRecord,
      event: ParsedEvent,
      raw: RawEvent
    ) => item is U
  ): IIterable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  /**
   * Returns the elements that meet the condition specified in a callback function.
   *
   * ```ts
   * // filters can be synchronous
   * it.filter(item => item.length > 0)
   *
   * // filters can call asynchronous code, such as an API client
   * it.filter(async item => client.get())
   * ```
   *
   * @param predicate The filter method calls the predicate function one time for each element in {@link Iterable} and returns a new {@link Iterable} containing only those elements where the {@link predicate} returns `true`.
   */
  filter(
    predicate: Processor<Item, boolean, ParsedRecord, ParsedEvent, RawEvent>
  ): IIterable<
    Item,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  /**
   * Performs the specified action for each element in an {@link Iterable}, for example
   * if receiving 10 messages from SQS, the {@link callbackfn} function will be called
   * once for each message.
   *
   * Calling `forEach` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEach(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEach` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEach("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEach(this, "id", props, callback);
   * ```
   *
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  forEach(
    callbackfn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for each element in an {@link Iterable}, for example
   * if receiving 10 messages from SQS, the {@link callbackfn} function will be called
   * once for each message.
   *
   * Calling `forEach` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEach(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEach` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEach("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEach(this, "id", props, callback);
   * ```
   *
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  forEach(
    props: FunctionProps<any, any> & EventSourceConfig,
    callbackfn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for each element in an {@link Iterable}, for example
   * if receiving 10 messages from SQS, the {@link callbackfn} function will be called
   * once for each message.
   *
   * Calling `forEach` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEach(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEach` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEach("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEach(this, "id", props, callback);
   * ```
   *
   * @param id ID of the created Lambda {@link Function} Construct added as a child of the underlying Resource, e.g. {@link Queue}.
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  forEach(
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    callbackfn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for each element in an {@link Iterable}, for example
   * if receiving 10 messages from SQS, the {@link callbackfn} function will be called
   * once for each message.
   *
   * Calling `forEach` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEach(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   *
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEach` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEach("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEach(this, "id", props, callback);
   * ```
   * @param scope Construct to use as the parent of the created Lambda {@link Function}.
   * @param id ID of the created Lambda {@link Function} Construct added as a child of the {@link scope}
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  forEach(
    scope: Construct,
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    callbackfn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for all of the elements in an {@link Iterable}. Calling
   * `forEachBatch` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * The {@link callbackfn} will be called once with an array of all elements in the current
   * batch of events received from the Event Source, for example all of the messages polled
   * from a SQS {@link Queue}.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEachBatch(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEachBatch` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEachBatch("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEachBatch(this, "id", props, callback);
   * ```
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  forEachBatch(
    callbackfn: BatchProcessor<Item, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for all of the elements in an {@link Iterable}. Calling
   * `forEachBatch` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * The {@link callbackfn} will be called once with an array of all elements in the current
   * batch of events received from the Event Source, for example all of the messages polled
   * from a SQS {@link Queue}.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEachBatch(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEachBatch` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEachBatch("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEachBatch(this, "id", props, callback);
   * ```
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  forEachBatch(
    props: FunctionProps<any, any> & EventSourceConfig,
    callbackfn: BatchProcessor<Item, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for all of the elements in an {@link Iterable}. Calling
   * `forEachBatch` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * The {@link callbackfn} will be called once with an array of all elements in the current
   * batch of events received from the Event Source, for example all of the messages polled
   * from a SQS {@link Queue}.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEachBatch(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEachBatch` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEachBatch("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEachBatch(this, "id", props, callback);
   * ```
   * @param id ID of the created Lambda {@link Function} Construct added as a child of the underlying resource, e.g. a SQS {@link Queue}.
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  forEachBatch(
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    callbackfn: BatchProcessor<Item, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for all of the elements in an {@link Iterable}. Calling
   * `forEachBatch` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * The {@link callbackfn} will be called once with an array of all elements in the current
   * batch of events received from the Event Source, for example all of the messages polled
   * from a SQS {@link Queue}.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEachBatch(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEachBatch` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEachBatch("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEachBatch(this, "id", props, callback);
   * ```
   * @param scope Construct to use as the parent of the created Lambda {@link Function}.
   * @param id ID of the created Lambda {@link Function} Construct added as a child of the {@link scope}
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  forEachBatch(
    scope: Construct,
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    callbackfn: BatchProcessor<Item, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;
}

export function isIterable(a: any): a is Iterable {
  return a?.kind === "Iterable";
}

export class Iterable<
  Item = any,
  RawEvent extends EventBatch = any,
  ParsedEvent extends EventBatch = any,
  ParsedRecord = any,
  Response = any,
  EventSourceConfig = any
> implements
    Iterable<
      Item,
      RawEvent,
      ParsedEvent,
      ParsedRecord,
      Response,
      EventSourceConfig
    >
{
  readonly kind = "Iterable";

  constructor(
    private readonly prev:
      | IEventSource<RawEvent, ParsedEvent, Response, EventSourceConfig>
      | Iterable<
          any,
          RawEvent,
          ParsedEvent,
          ParsedRecord,
          Response,
          EventSourceConfig
        >,
    private readonly callbackfn: Processor<
      any,
      Item[],
      ParsedRecord,
      ParsedEvent,
      RawEvent
    >
  ) {}

  /**
   * Map over each {@link Item} and apply a transformation function.
   *
   * ```ts
   * // transformations can be synchronous
   * it.map((item: string) => item.length)
   *   .forEach((item: number) => ..)
   *
   * // transformations can also be asynchronous
   * it.map(async (item: string) => client.getCount(item));
   *   .forEach((item: number) => ..)
   * ```
   *
   * @param callbackfn function to apply to each {@link Item}.
   */
  public map<U>(
    callbackfn: Processor<Item, U, ParsedRecord, ParsedEvent, RawEvent>
  ): Iterable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  > {
    return this.flatMap(async (...args) => [await callbackfn(...args)]);
  }

  /**
   * Calls a defined callback function on each element of an array. Then, flattens
   * the result into a new array.
   *
   * ```ts
   * // transformations can be synchronous
   * it.flatMap((item: string) => [item.length])
   *   .forEach((item: number) => ..)
   *
   * // transformations can also be asynchronous
   * it.flatMap(async (item: string) => [client.getCount(item)]);
   *   .forEach((item: number) => ..)
   * ```
   *
   * @param callbackfn The flatMap method calls the callback function one time for each element in the array.
   */
  public flatMap<U>(
    callbackfn: Processor<Item, U[], ParsedRecord, ParsedEvent, RawEvent>
  ): Iterable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  > {
    return new Iterable(this, callbackfn);
  }

  /**
   * Returns the elements that meet the condition specified in a callback function.
   *
   * ```ts
   * // filters can be synchronous
   * it.filter(item => item.length > 0)
   *
   * // filters can call asynchronous code, such as an API client
   * it.filter(async item => client.get())
   * ```
   *
   * @param predicate The filter method calls the predicate function one time for each element in {@link Iterable} and returns a new {@link Iterable} containing only those elements where the {@link predicate} returns `true`.
   */
  public filter<U extends Item>(
    predicate: (
      item: Item,
      record: ParsedRecord,
      event: ParsedEvent,
      raw: RawEvent
    ) => item is U
  ): Iterable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  /**
   * Returns the elements that meet the condition specified in a callback function.
   *
   * ```ts
   * // filters can be synchronous
   * it.filter(item => item.length > 0)
   *
   * // filters can call asynchronous code, such as an API client
   * it.filter(async item => client.get())
   * ```
   *
   * @param predicate The filter method calls the predicate function one time for each element in {@link Iterable} and returns a new {@link Iterable} containing only those elements where the {@link predicate} returns `true`.
   */
  public filter(
    predicate: Processor<Item, boolean, ParsedRecord, ParsedEvent, RawEvent>
  ): Iterable<
    any,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  public filter(
    predicate: Processor<Item, boolean, ParsedRecord, ParsedEvent, RawEvent>
  ): Iterable<
    any,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  > {
    return this.flatMap(async (item, record, event, raw) => {
      let pred = predicate(item, record, event, raw);
      if (pred instanceof Promise) {
        pred = await pred;
      }
      return pred ? [item] : [];
    });
  }

  /**
   * Performs the specified action for each element in an {@link Iterable}, for example
   * if receiving 10 messages from SQS, the {@link callbackfn} function will be called
   * once for each message.
   *
   * Calling `forEach` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEach(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEach` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEach("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEach(this, "id", props, callback);
   * ```
   *
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  public forEach(
    callbackfn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for each element in an {@link Iterable}, for example
   * if receiving 10 messages from SQS, the {@link callbackfn} function will be called
   * once for each message.
   *
   * Calling `forEach` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEach(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEach` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEach("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEach(this, "id", props, callback);
   * ```
   *
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  public forEach(
    props: FunctionProps<any, any> & EventSourceConfig,
    callbackfn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for each element in an {@link Iterable}, for example
   * if receiving 10 messages from SQS, the {@link callbackfn} function will be called
   * once for each message.
   *
   * Calling `forEach` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEach(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEach` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEach("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEach(this, "id", props, callback);
   * ```
   *
   * @param id ID of the created Lambda {@link Function} Construct added as a child of the underlying Resource, e.g. {@link Queue}.
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  public forEach(
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    callbackfn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for each element in an {@link Iterable}, for example
   * if receiving 10 messages from SQS, the {@link callbackfn} function will be called
   * once for each message.
   *
   * Calling `forEach` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEach(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   *
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEach({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEach` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEach("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEach(this, "id", props, callback);
   * ```
   * @param scope Construct to use as the parent of the created Lambda {@link Function}.
   * @param id ID of the created Lambda {@link Function} Construct added as a child of the {@link scope}
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  public forEach(
    scope: Construct,
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    callbackfn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  public forEach(...args: any[]): Function<RawEvent, Response, RawEvent> {
    const source = this.getSource();
    const [scope, id, props, processFunc] = source.parseArgs<Processor>(args);

    const chain = this.getCallChain();

    const handleResponse = source.createResponseHandler();

    const getPayload = source.createGetPayload();

    return this.getSource().onEvent(scope, id, props, async (event, raw) => {
      return handleResponse(
        (
          await Promise.all(
            event.Records.map(async (record) => {
              const payload = getPayload(record);
              try {
                let items: any[] = [payload];
                for (const func of chain) {
                  items = (
                    await Promise.all(
                      items.map((item) =>
                        awaitIfPromise(func(item, record, event, raw))
                      )
                    )
                  ).flat(1);
                }

                await Promise.all(
                  items.map(async (item) =>
                    awaitIfPromise(processFunc(item, record, event, raw))
                  )
                );
                return undefined;
              } catch (err) {
                // TODO: is it safe to always log user-errors? Should this be enabled/disabled?
                console.error(err);
                return record;
              }
            })
          )
        ).filter(
          (record): record is Exclude<typeof record, undefined> =>
            record !== undefined
        )
      );
    });
  }

  /**
   * Performs the specified action for all of the elements in an {@link Iterable}. Calling
   * `forEachBatch` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * The {@link callbackfn} will be called once with an array of all elements in the current
   * batch of events received from the Event Source, for example all of the messages polled
   * from a SQS {@link Queue}.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEachBatch(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEachBatch` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEachBatch("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEachBatch(this, "id", props, callback);
   * ```
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  public forEachBatch(
    callbackfn: BatchProcessor<Item, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for all of the elements in an {@link Iterable}. Calling
   * `forEachBatch` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * The {@link callbackfn} will be called once with an array of all elements in the current
   * batch of events received from the Event Source, for example all of the messages polled
   * from a SQS {@link Queue}.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEachBatch(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEachBatch` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEachBatch("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEachBatch(this, "id", props, callback);
   * ```
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  public forEachBatch(
    props: FunctionProps<any, any> & EventSourceConfig,
    callbackfn: BatchProcessor<Item, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for all of the elements in an {@link Iterable}. Calling
   * `forEachBatch` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * The {@link callbackfn} will be called once with an array of all elements in the current
   * batch of events received from the Event Source, for example all of the messages polled
   * from a SQS {@link Queue}.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEachBatch(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEachBatch` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEachBatch("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEachBatch(this, "id", props, callback);
   * ```
   * @param id ID of the created Lambda {@link Function} Construct added as a child of the underlying resource, e.g. a SQS {@link Queue}.
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  public forEachBatch(
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    callbackfn: BatchProcessor<Item, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  /**
   * Performs the specified action for all of the elements in an {@link Iterable}. Calling
   * `forEachBatch` will create a new Lambda {@link Function} and attach the corresponding
   * Event Source, for example a SQS {@link Queue} Polling Event Source.
   *
   * The {@link callbackfn} will be called once with an array of all elements in the current
   * batch of events received from the Event Source, for example all of the messages polled
   * from a SQS {@link Queue}.
   *
   * ## Example Usage for a SQS {@link Queue}
   *
   * ```ts
   * const myTable = new Table<Message, "id">(scope, "table", { .. });
   * const queue = new Queue(scope, "queue");
   *
   * queue.messages().forEachBatch(async (message) => {
   *   // put each message from the Queue into a Table
   *   await $AWS.DynamoDB.PutItem({
   *     Table: myTable,
   *     Item: {
   *       id: { S: message.id },
   *       message: { S: JSON.stringify(message) }
   *     }
   *   })
   * });
   * ```
   *
   * ## Lambda Function Configuration
   * The {@link Function}'s `props`, for example `memorySize` or `timeout` can be configured with
   * the `props` argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   memorySize: 256,
   *   timeout: Duration.minutes(1)
   * }, handler);
   * ```
   *
   * ## Event Source Configuration
   *
   * The EventSource's `props`, for example `batchSize`, can also be configured with the `props`
   * argument:
   * ```ts
   * import { Duration } from "aws-cdk-lib";
   *
   * queue.messages().forEachBatch({
   *   batchSize: 10
   * }, handler);
   * ```
   *
   * ## Override `scope` and `id`
   *
   * The `scope` of the Function defaults to the Resource underlying this {@link Iterable} and
   * and the `id` defaults to `"onEvent"`. To override `scope` and `id`, you can use one of the
   * overloaded `forEachBatch` methods.
   * ```ts
   * // specify just the `id`
   * queue.messages().forEachBatch("id", props, callbackfn)
   *
   * // specify both the `scope` and `id`:
   * queue.messages().forEachBatch(this, "id", props, callback);
   * ```
   * @param scope Construct to use as the parent of the created Lambda {@link Function}.
   * @param id ID of the created Lambda {@link Function} Construct added as a child of the {@link scope}
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param callbackfn forEach calls the callbackfn function one time for each element in the array.
   */
  public forEachBatch(
    scope: Construct,
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    callbackfn: BatchProcessor<Item, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  public forEachBatch(...args: any[]): Function<RawEvent, Response, RawEvent> {
    const source = this.getSource();
    const [scope, id, props, processFunc] =
      source.parseArgs<(event: any) => any[] | Promise<any[]>>(args);

    const chain = this.getCallChain();

    const handleResponse = source.createResponseHandler();

    const getPayload = source.createGetPayload();

    return this.getSource().onEvent(scope, id, props, async (event, raw) => {
      try {
        const batch = (
          await Promise.all(
            event.Records.map(async (record) => {
              const payload = getPayload(record);

              let items: any[] = [payload];
              for (const func of chain) {
                items = (
                  await Promise.all(
                    items.map((item) =>
                      awaitIfPromise(func(item, record, event, raw))
                    )
                  )
                ).flat(1);
              }
              return items;
            })
          )
        ).flat(1);
        await awaitIfPromise(processFunc(batch));
        return handleResponse([]);
      } catch (err) {
        console.error(err);
        // an error occurred when processing the last batch, we cannot discern which message caused the
        // failure so we report all errors as failed
        return handleResponse(event.Records);
      }
    });
  }

  private getCallChain(): Processor[] {
    if (isIterable(this.prev)) {
      return [...this.prev.getCallChain(), this.callbackfn];
    } else {
      return [this.callbackfn];
    }
  }

  private getSource(): EventSource<
    any,
    any,
    RawEvent,
    ParsedEvent,
    Response,
    any
  > {
    if (isIterable(this.prev)) {
      return this.prev.getSource();
    } else {
      return this.prev as any;
    }
  }
}

function awaitIfPromise<T>(value: T | Promise<T>): Promise<T> {
  if (value instanceof Promise) {
    return value;
  } else {
    return Promise.resolve(value);
  }
}
