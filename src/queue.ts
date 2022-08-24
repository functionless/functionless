import { aws_sqs, aws_lambda_event_sources, aws_lambda } from "aws-cdk-lib";
import lambda from "aws-lambda";
import { Construct } from "constructs";
import { EventSource } from "./event-source";
import { SQSClient } from "./function-prewarm";
import { makeIntegration } from "./integration";
import { Iterable } from "./iterable";
import { Serializer } from "./serializer";

/**
 * A parsed form of the {@link lambda.SQSEvent} where each of the {@link lambda.SQSRecord}s
 * have been parsed into a {@link SQSRecord<T>}.
 */
export interface SQSEvent<Message> {
  Records: SQSRecord<Message>[];
}

/**
 * A parsed {@link lambda.SQSEvent} containing the parsed form ({@link Message}) of the {@link message}
 * stored as an object on the {@link message} property.
 */
export interface SQSRecord<Message> extends lambda.SQSRecord {
  /**
   * The Message parsed from the {@link body}.
   */
  message: Message;
}

export interface SendMessageRequest<Message>
  extends Omit<AWS.SQS.SendMessageRequest, "MessageBody"> {
  /**
   * The {@link Message} to be sent to the {@link Queue}.
   */
  Message: Message;
}

abstract class BaseQueue<Message> extends EventSource<
  aws_sqs.IQueue,
  QueueProps<Message>,
  lambda.SQSEvent,
  SQSEvent<Message>,
  lambda.SQSBatchResponse,
  aws_lambda_event_sources.SqsEventSourceProps
> {
  /**
   * The ARN of this queue
   * @attribute
   */
  public get queueArn() {
    return this.resource.queueArn;
  }

  /**
   * The Name of this queue
   * @attribute
   */
  public get queueName() {
    return this.resource.queueName;
  }

  /**
   * The URL of this queue
   * @attribute
   */
  public get queueUrl() {
    return this.resource.queueUrl;
  }

  constructor(scope: Construct, id: string, props: QueueProps<Message>);
  constructor(resource: aws_sqs.IQueue, props: QueueProps<Message>);
  constructor(
    ...args:
      | [secret: aws_sqs.IQueue, props: QueueProps<Message>]
      | [scope: Construct, id: string, props: QueueProps<Message>]
  ) {
    // @ts-ignore
    super(...args);

    const queueUrl = this.queueUrl;
    const serializer = this.props.serializer?.create();

    this.sendMessage = makeIntegration<
      "AWS.SQS.SendMessage",
      (input: SendMessageRequest<Message>) => Promise<AWS.SQS.SendMessageResult>
    >({
      kind: "AWS.SQS.SendMessage",
      // asl: (call, context) => {},
      native: {
        bind: (func) => this.resource.grantSendMessages(func.resource),
        preWarm: (context) => context.getOrInit(SQSClient),
        call: async ([input], context) => {
          const sqs = context.getOrInit(SQSClient);

          const messageBody = serializer
            ? serializer.write(input.Message)
            : typeof input.Message === "string"
            ? input.Message
            : (() => {
                throw new Error(
                  `Message must be a string if there is no 'serializer' configured`
                );
              })();

          const response = await sqs
            .sendMessage({
              ...input,
              MessageBody:
                typeof messageBody === "string"
                  ? messageBody
                  : messageBody.toString("utf8"),
              QueueUrl: queueUrl,
            })
            .promise();

          return response;
        },
      },
    });
  }

  /**
   * Returns an {@link Iterable} instance that can be used to process messages
   * in this {@link Queue}.
   *
   * ## Example Usage
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
   * @returns
   */
  public messages(): Iterable<
    Message,
    lambda.SQSEvent,
    SQSEvent<Message>,
    SQSRecord<Message>,
    lambda.SQSBatchResponse,
    aws_lambda_event_sources.SqsEventSourceProps
  > {
    return new Iterable<
      Message,
      lambda.SQSEvent,
      SQSEvent<Message>,
      SQSRecord<Message>,
      lambda.SQSBatchResponse,
      aws_lambda_event_sources.SqsEventSourceProps
    >(this, (event) => event);
  }

  public readonly sendMessage;

  protected createResource(
    scope: Construct,
    id: string,
    config: aws_sqs.QueueProps
  ): aws_sqs.IQueue {
    return new aws_sqs.Queue(scope, id, config);
  }

  protected createEventSource(
    config: aws_lambda_event_sources.SqsEventSourceProps
  ): aws_lambda.IEventSource {
    return new aws_lambda_event_sources.SqsEventSource(this.resource, config);
  }

  protected createParser(): (event: lambda.SQSEvent) => SQSEvent<Message> {
    const serializer = this.props.serializer?.create();
    return (event) => ({
      Records: event.Records.map((record) => ({
        ...record,
        message: serializer
          ? serializer.read(record.body)
          : // this is unsafe - how can we ensure that, when no serializer is provided, then the message is always the raw string?
            (record.body as unknown as Message),
      })),
    });
  }

  public createResponseHandler(): (
    failed: lambda.SQSRecord[]
  ) => lambda.SQSBatchResponse {
    return (failed) => ({
      batchItemFailures: failed.map((failed) => ({
        itemIdentifier: failed.messageId,
      })),
    });
  }

  public createGetPayload(): (event: SQSRecord<Message>) => any {
    return (event) => event.message;
  }
}

export interface QueueProps<T> extends aws_sqs.QueueProps {
  /**
   * Specifies the {@link Serializer} instance to use for serializing messages
   * sent to the Queue and deserializing messages received from the Queue.
   */
  serializer?: Serializer<T>;
}

export interface IQueue<T = any> extends BaseQueue<T> {}

/**
 * A SQS Queue. Each of the messages stored in the Queue are of type {@link T}.
 *
 * ## Example Usage
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
 */
export class Queue<T = any> extends BaseQueue<T> implements IQueue<T> {
  constructor(scope: Construct, id: string, props?: QueueProps<T>) {
    super(scope, id, props ?? {});
  }
}
