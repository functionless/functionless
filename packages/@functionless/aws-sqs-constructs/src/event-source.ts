import { aws_sqs, aws_lambda } from "aws-cdk-lib";
import { Construct, IConstruct } from "constructs";
import { Function, FunctionProps } from "@functionless/aws-lambda-constructs";
import type { Iterable } from "./iterable";
import type { Queue } from "./queue";

/**
 * An {@link IEventSource} is a Resource that emits Events that a Lambda Function
 * can be subscribed to. When subscribed, the Lambda Function will be invoked
 * whenever new Events arrive in the Event Source.
 *
 * For example, an SQS `Queue` is an `IEventSource` containing Messages.
 *
 * ```ts
 * // create a DynamoDB Table
 * const myTable = new Table<Message, "id">(this, "table", { .. });
 *
 * const queue = new Queue(this, "queue");
 *
 * // create a Function to process each of the messages in the queues
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
 *
 * // for testing purpose, create an ExpressStepFunction to send messages to the queue
 * new ExpressStepFunction(this, "func", async () => {
 *   await queue.sendMessage({
 *     id: "message id",
 *     data: "message data"
 *   })
 * });
 * ```
 *
 * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html
 * @see {@link EventSource}
 * @see {@link Queue}
 */
export interface IEventSource<
  RawEvent = any,
  ParsedEvent = any,
  Response = any,
  EventSourceConfig = any
> {
  /**
   * Creates a Lambda {@link Function} and subscribes it to this {@link EventSource}. It
   * will be invoked whenever events are received from the {@link EventSource} with a
   * request and response contract identical to the contract defined by each corresponding
   * AWS service.
   *
   * The {@link handler} function takes two arguments, {@link ParsedEvent} and {@link RawEvent}.
   *
   * {@link RawEvent} is the exact object received in the Invocation and {@link ParsedEvent} is
   * derived from it. Each {@link EventSource} implementation, for example the SQS {@link Queue},
   * perform pre-processing to parse JSON Strings into JS Objects.
   *
   * ```ts
   * queue.onEvent(async (event) => {
   *   event.Records.forEach(record => {
   *     console.log(record.message);
   *   });
   * })
   * ```
   *
   * @param handler the handler function to invoke when an {@link RawEvent} is received.
   * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html
   */
  onEvent(
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  /**
   * Creates a Lambda {@link Function} and subscribes it to this {@link EventSource}. It
   * will be invoked whenever events are received from the {@link EventSource} with a
   * request and response contract identical to the contract defined by each corresponding
   * AWS service.
   *
   * The {@link handler} function takes two arguments, {@link ParsedEvent} and {@link RawEvent}.
   *
   * {@link RawEvent} is the exact object received in the Invocation and {@link ParsedEvent} is
   * derived from it. Each {@link EventSource} implementation, for example the SQS {@link Queue},
   * perform pre-processing to parse JSON Strings into JS Objects.
   *
   * ```ts
   * queue.onEvent({
   *   // set the memory on the Lambda Function
   *   memorySize: 512,
   *   // configure the EventSource to batch messages into groups of 10 prior to invoking
   *   batchSize: 10
   * }, async (event) => {
   *   event.Records.forEach(record => {
   *     console.log(record.message);
   *   });
   * })
   * ```
   *
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param handler the handler function to invoke when an {@link RawEvent} is received.
   * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html
   */
  onEvent(
    props: FunctionProps<ParsedEvent, Response> & EventSourceConfig,
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  /**
   * Creates a Lambda {@link Function} and subscribes it to this {@link EventSource}. It
   * will be invoked whenever events are received from the {@link EventSource} with a
   * request and response contract identical to the contract defined by each corresponding
   * AWS service.
   *
   * The {@link handler} function takes two arguments, {@link ParsedEvent} and {@link RawEvent}.
   *
   * {@link RawEvent} is the exact object received in the Invocation and {@link ParsedEvent} is
   * derived from it. Each {@link EventSource} implementation, for example the SQS {@link Queue},
   * perform pre-processing to parse JSON Strings into JS Objects.
   *
   * ```ts
   * queue.onEvent(
   *   "ProcessMessages",
   *   {
   *     // set the memory on the Lambda Function
   *     memorySize: 512,
   *     // configure the EventSource to batch messages into groups of 10 prior to invoking
   *     batchSize: 10
   *   },
   *   async (event) => {
   *     event.Records.forEach(record => {
   *       console.log(record.message);
   *     });
   *   }
   * );
   * ```
   *
   * @param id ID of the created Lambda {@link Function} Construct added as a child of the underlying resource, e.g. a SQS {@link Queue}.
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param handler the handler function to invoke when an {@link RawEvent} is received.
   * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html
   */
  onEvent(
    id: string,
    props: FunctionProps<ParsedEvent, Response> & EventSourceConfig,
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  /**
   * Creates a Lambda {@link Function} and subscribes it to this {@link EventSource}. It
   * will be invoked whenever events are received from the {@link EventSource} with a
   * request and response contract identical to the contract defined by each corresponding
   * AWS service.
   *
   * The {@link handler} function takes two arguments, {@link ParsedEvent} and {@link RawEvent}.
   *
   * {@link RawEvent} is the exact object received in the Invocation and {@link ParsedEvent} is
   * derived from it. Each {@link EventSource} implementation, for example the SQS {@link Queue},
   * perform pre-processing to parse JSON Strings into JS Objects.
   *
   * ```ts
   * queue.onEvent(
   *   scope,
   *   "ProcessMessages",
   *   {
   *     // set the memory on the Lambda Function
   *     memorySize: 512,
   *     // configure the EventSource to batch messages into groups of 10 prior to invoking
   *     batchSize: 10
   *   },
   *   async (event) => {
   *     event.Records.forEach(record => {
   *       console.log(record.message);
   *     });
   *   }
   * );
   * ```
   *
   * @param scope Construct to use as the parent of the created Lambda {@link Function}.
   * @param id ID of the created Lambda {@link Function} Construct added as a child of the underlying resource, e.g. a SQS {@link Queue}.
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param handler the handler function to invoke when an {@link RawEvent} is received.
   * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html
   */
  onEvent(
    scope: Construct,
    id: string,
    props: FunctionProps<ParsedEvent, Response> & EventSourceConfig,
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;
}

export interface EventBatch<Record = any> {
  Records: Record[];
}

/**
 * An {@link EventSource} is a Resource that emits Events that a Lambda Function
 * can be subscribed to. When subscribed, the Lambda Function will be invoked
 * whenever new Events arrive in the Event Source.
 *
 * For example, an SQS Queue is an EventSource containing Messages.
 *
 * ```ts
 * // create a DynamoDB Table
 * const myTable = new Table<Message, "id">(this, "table", { .. });
 *
 * const queue = new Queue(this, "queue");
 *
 * // create a Function to process each of the messages in the queues
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
 *
 * // for testing purpose, create an ExpressStepFunction to send messages to the queue
 * new ExpressStepFunction(this, "func", async () => {
 *   await queue.sendMessage({
 *     id: "message id",
 *     data: "message data"
 *   })
 * });
 * ```
 *
 * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html
 */
export abstract class EventSource<
  Resource extends IConstruct = IConstruct,
  ResourceProps = any,
  RawEvent extends EventBatch = EventBatch,
  ParsedEvent extends EventBatch = EventBatch,
  Response = any,
  EventSourceConfig = any
> implements IEventSource<RawEvent, ParsedEvent, Response, EventSourceConfig>
{
  /**
   * The Resource that is the source of Events for this EventSource.
   *
   * For example, a SQS Queue, SNS Topic or Kinesis Stream.
   */
  readonly resource: Resource;

  /**
   * @hidden
   */
  readonly props: ResourceProps;

  constructor(scope: Construct, id: string, props: ResourceProps);
  constructor(resource: Resource, props: ResourceProps);
  constructor(
    ...args:
      | [secret: aws_sqs.IQueue, props: ResourceProps]
      | [scope: Construct, id: string, props: ResourceProps]
  ) {
    if (typeof args[1] !== "string") {
      this.resource = args[0] as Resource;
      this.props = args[1];
    } else {
      this.props = args[2] as ResourceProps;
      this.resource = this.createResource(args[0], args[1], this.props);
    }
  }

  /**
   * Creates a Lambda {@link Function} and subscribes it to this {@link EventSource}. It
   * will be invoked whenever events are received from the {@link EventSource} with a
   * request and response contract identical to the contract defined by each corresponding
   * AWS service.
   *
   * The {@link handler} function takes two arguments, {@link ParsedEvent} and {@link RawEvent}.
   *
   * {@link RawEvent} is the exact object received in the Invocation and {@link ParsedEvent} is
   * derived from it. Each {@link EventSource} implementation, for example the SQS {@link Queue},
   * perform pre-processing to parse JSON Strings into JS Objects.
   *
   * ```ts
   * queue.onEvent(async (event) => {
   *   event.Records.forEach(record => {
   *     console.log(record.message);
   *   });
   * })
   * ```
   *
   * @param handler the handler function to invoke when an {@link RawEvent} is received.
   * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html
   */
  public onEvent(
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  /**
   * Creates a Lambda {@link Function} and subscribes it to this {@link EventSource}. It
   * will be invoked whenever events are received from the {@link EventSource} with a
   * request and response contract identical to the contract defined by each corresponding
   * AWS service.
   *
   * The {@link handler} function takes two arguments, {@link ParsedEvent} and {@link RawEvent}.
   *
   * {@link RawEvent} is the exact object received in the Invocation and {@link ParsedEvent} is
   * derived from it. Each {@link EventSource} implementation, for example the SQS {@link Queue},
   * perform pre-processing to parse JSON Strings into JS Objects.
   *
   * ```ts
   * queue.onEvent({
   *   // set the memory on the Lambda Function
   *   memorySize: 512,
   *   // configure the EventSource to batch messages into groups of 10 prior to invoking
   *   batchSize: 10
   * }, async (event) => {
   *   event.Records.forEach(record => {
   *     console.log(record.message);
   *   });
   * })
   * ```
   *
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param handler the handler function to invoke when an {@link RawEvent} is received.
   * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html
   */
  public onEvent(
    props: FunctionProps<ParsedEvent, Response> & EventSourceConfig,
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  /**
   * Creates a Lambda {@link Function} and subscribes it to this {@link EventSource}. It
   * will be invoked whenever events are received from the {@link EventSource} with a
   * request and response contract identical to the contract defined by each corresponding
   * AWS service.
   *
   * The {@link handler} function takes two arguments, {@link ParsedEvent} and {@link RawEvent}.
   *
   * {@link RawEvent} is the exact object received in the Invocation and {@link ParsedEvent} is
   * derived from it. Each {@link EventSource} implementation, for example the SQS {@link Queue},
   * perform pre-processing to parse JSON Strings into JS Objects.
   *
   * ```ts
   * queue.onEvent(
   *   "ProcessMessages",
   *   {
   *     // set the memory on the Lambda Function
   *     memorySize: 512,
   *     // configure the EventSource to batch messages into groups of 10 prior to invoking
   *     batchSize: 10
   *   },
   *   async (event) => {
   *     event.Records.forEach(record => {
   *       console.log(record.message);
   *     });
   *   }
   * );
   * ```
   *
   * @param id ID of the created Lambda {@link Function} Construct added as a child of the underlying resource, e.g. a SQS {@link Queue}.
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param handler the handler function to invoke when an {@link RawEvent} is received.
   * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html
   */
  public onEvent(
    id: string,
    props: FunctionProps<ParsedEvent, Response> & EventSourceConfig,
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  /**
   * Creates a Lambda {@link Function} and subscribes it to this {@link EventSource}. It
   * will be invoked whenever events are received from the {@link EventSource} with a
   * request and response contract identical to the contract defined by each corresponding
   * AWS service.
   *
   * The {@link handler} function takes two arguments, {@link ParsedEvent} and {@link RawEvent}.
   *
   * {@link RawEvent} is the exact object received in the Invocation and {@link ParsedEvent} is
   * derived from it. Each {@link EventSource} implementation, for example the SQS {@link Queue},
   * perform pre-processing to parse JSON Strings into JS Objects.
   *
   * ```ts
   * queue.onEvent(
   *   "ProcessMessages",
   *   {
   *     // set the memory on the Lambda Function
   *     memorySize: 512,
   *     // configure the EventSource to batch messages into groups of 10 prior to invoking
   *     batchSize: 10
   *   },
   *   async (event) => {
   *     event.Records.forEach(record => {
   *       console.log(record.message);
   *     });
   *   }
   * );
   * ```
   *
   * @param scope Construct to use as the parent of the created Lambda {@link Function}.
   * @param id ID of the created Lambda {@link Function} Construct added as a child of the underlying resource, e.g. a SQS {@link Queue}.
   * @param props configuration properties for the Lambda {@link Function} and corresponding Event Source.
   * @param handler the handler function to invoke when an {@link RawEvent} is received.
   * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html
   */
  public onEvent(
    scope: Construct,
    id: string,
    props: FunctionProps<ParsedEvent, Response> & EventSourceConfig,
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  public onEvent(...args: any[]) {
    const [scope, id, props, handler] =
      this.parseArgs<
        (event: ParsedEvent, payload: RawEvent) => Promise<Response>
      >(args);

    const parse = this.createParser();

    const func = new Function(scope, id, props, (event: any) => {
      const parsedEvent = parse(event);
      return handler(parsedEvent, event);
    });

    func.resource.addEventSource(this.createEventSource(props));

    return func;
  }

  /**
   * Creates a closure that parses a {@link RawEvent} into a {@link ParsedEvent}.
   *
   * @note we return a closure because we need to serialize it into the closure which currently
   * does not support capturing `this`.
   */
  protected abstract createParser(): (event: RawEvent) => ParsedEvent;

  /**
   * Creates a closure that extracts the payload out of an event.
   *
   * @note we return a closure because we need to serialize it into the closure which currently
   * does not support capturing `this`.
   */
  public abstract createGetPayload(): (
    event: ParsedEvent["Records"][number]
  ) => any;

  /**
   * Creates a closure that formats a list of failed records into a {@link Response} expected
   * by the {@link EventSource} contract.
   *
   * @note we return a closure because we need to serialize it into the closure which currently
   * does not support capturing `this`.
   */
  public abstract createResponseHandler(): (
    failed: RawEvent["Records"]
  ) => Response;

  /**
   * Create the underlying {@link Resource} required by this {@link EventSource}.
   */
  protected abstract createResource(
    scope: Construct,
    id: string,
    props: ResourceProps
  ): Resource;

  /**
   * Create the {@link aws_lambda.IEventSource} configuration to attach to created Lambda {@link Function}s.
   *
   * @param config the {@link EventSourceConfig} properties.
   */
  protected abstract createEventSource(
    config: EventSourceConfig
  ): aws_lambda.IEventSource;

  /**
   * A simple utility method for parsing an array of args for methods with the following patterns:
   *
   * ```ts
   * forEach(() => {});
   * forEach({ props }, () => {});
   * forEach("id", { props }, () => {});
   * forEach(scope, "id", { props }, () => {});
   * ```
   *
   * This is seen in many of the methods in {@link EventSource} and {@link Iterable}.
   *
   * @param args an array of args
   * @returns the [scope, id, props, handler] tuple with defaults filled in as necessary
   * @hidden
   */
  public parseArgs<F>(
    args: any[]
  ): [
    scope: Construct,
    id: string,
    props: FunctionProps<any, Response> & EventSourceConfig,
    handler: F
  ] {
    if (typeof args[1] === "string") {
      return args as any;
    } else if (typeof args[0] === "string") {
      return [this.resource, ...args] as any;
    } else if (typeof args[0] === "object") {
      return [this.resource, "onEvent", ...args] as any;
    } else {
      return [this.resource, "onEvent", {}, ...args] as any;
    }
  }
}
