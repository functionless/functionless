import {
  aws_sqs,
  aws_lambda_event_sources,
  aws_lambda,
  aws_events_targets,
} from "aws-cdk-lib";
import lambda from "aws-lambda";
import { Construct } from "constructs";
import { ASLGraph } from "./asl";
import { ErrorCodes, SynthError } from "./error-code";
import { EventBusTargetIntegration } from "./event-bridge";
import { makeEventBusIntegration } from "./event-bridge/event-bus";
import { EventSource, IEventSource } from "./event-source";
import { SQSClient } from "./function-prewarm";
import { Integration, makeIntegration } from "./integration";
import { Iterable } from "./iterable";
import { Serializer, JsonSerializer, DataType } from "./serializer";

export interface Message<M> extends AWS.SQS.Message {
  /**
   * The parsed form of the {@link M} received from the {@link Queue}.
   */
  Message?: M;
}

/**
 * A parsed form of the {@link lambda.SQSEvent} where each of the {@link lambda.SQSRecord}s
 * have been parsed into a {@link SQSRecord}.
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

export interface SendMessageRequest<M>
  extends Omit<AWS.SQS.SendMessageRequest, "MessageBody" | "QueueUrl"> {
  /**
   * The {@link M} to be sent to the {@link Queue}.
   */
  MessageBody: M;
}

export interface SendMessageBatchRequest<M>
  extends Omit<AWS.SQS.SendMessageBatchRequest, "QueueUrl" | "Entries"> {
  Entries: SendMessageBatchRequestEntry<M>[];
}

export interface SendMessageBatchRequestEntry<M>
  extends Omit<AWS.SQS.SendMessageBatchRequestEntry, "MessageBody"> {
  MessageBody: M;
}

export interface ReceiveMessageRequest
  extends Omit<AWS.SQS.ReceiveMessageRequest, "QueueUrl"> {}

export interface ReceiveMessageResult<M>
  extends Omit<AWS.SQS.ReceiveMessageResult, "Messages"> {
  /**
   * The {@link M} to be sent to the {@link Queue}.
   */
  Messages?: Message<M>[];
}

interface BaseQueue<Message> {
  /**
   * Delivers a message to the specified queue.
   *
   * ```ts
   * // model the type of data in the Queue
   * interface Message {
   *   key: string;
   * }
   *
   * const queue = new Queue<Message>(scope, id);
   *
   * await queue.sendMessage({
   *   Message: {
   *     key: "value"
   *   },
   * });
   * ```
   *
   * When working with FIFO queues, the {@link SendMessageRequest.MessageDeduplicationId} and
   * {@link SendMessageRequest.MessageGroupId} properties become useful.
   * - `MessageDeduplicationId` - ensures that any duplicate messages sent with the same ID in a
   * 5 minute time window are ignored, ensuring that exactly one of those messages were delivered. If
   * your FIFO Queue is configured with {@link aws_sqs.DeduplicationScope.MESSAGE_GROUP} then duplicate
   * IDs are only considered duplicates when they also have the same `MessageGroupId`, otherwise
   * de-duplication is applied globally. Global de-duplication limits the throughput of your entire Queue
   * to 300-3000 messages per second, so use it only when you absolutely need.
   * - `MessageGroupId` - Messages with the same MessageGroupId are guaranteed to be processed by consumers
   * in FIFO order. The first message sent is the first message received. Subsequent messages cannot be
   * processed until prior messages are deleted from the Queue.
   *
   * ```ts
   * await queue.sendMessage({
   *   Message: message,
   *
   *   // prevent delivering this message more than once in a 5 minute time window
   *   MessageDeduplicationId: message.requestId,
   *
   *   // ensure messages with the same userId are processed in order
   *   // only care about de-duplication in the scope of a single `userId`.
   *   MessageGroupId: message.userId
   * });
   * ```
   */
  sendMessage(
    input: SendMessageRequest<Message>
  ): Promise<AWS.SQS.SendMessageResult>;

  /**
   * Delivers up to ten messages to the specified queue. This is a batch version of
   * {@link sendMessage}. The maximum allowed individual message size and the maximum
   * total payload size (the sum of the individual lengths of all of the batched messages)
   * are both 256 KB (262,144 bytes).
   *
   * ```ts
   * // model the type of data in the Queue
   * interface Message {
   *   key: string;
   * }
   *
   * // create a Queue
   * const queue = new Queue<Message>(scope, id);
   *
   * // send a batch of messages to the Queue
   * await queue.sendMessageBatch({
   *   Entries: [{
   *     Id: "1",
   *     // the message is a `Message` type - it will be automatically serialized as a JSON string
   *     Message: {
   *       key: "value"
   *     }
   *   }]
   * })
   * ```
   *
   * The result of sending each message is reported individually in the response.
   * Because the batch request can result in a combination of successful and unsuccessful
   * actions, you should check for batch errors even when the call returns an HTTP status
   * code of 200.
   *
   * ```ts
   * async function sendWithRetries(entries: SendMessageRequestEntry<Message>) {
   *   // try and send the batch of messages
   *   const response = await queue.sendMessageBatch({
   *     Entries: entries,
   *   });
   *
   *   if (response.Failed.length > 0) {
   *     // try and send the failed messages again
   *     await sendWithRetries(response.Failed.map((failed) =>
   *       entries.find((entry) => entry.Id === failed.Id)
   *     ));
   *   }
   * }
   * ```
   *
   * When working with FIFO queues, the {@link SendMessageRequest.MessageDeduplicationId} and
   * {@link SendMessageRequest.MessageGroupId} properties become useful.
   * - `MessageDeduplicationId` - ensures that any duplicate messages sent with the same ID in a
   * 5 minute time window are ignored, ensuring that exactly one of those messages were delivered. If
   * your FIFO Queue is configured with {@link aws_sqs.DeduplicationScope.MESSAGE_GROUP} then duplicate
   * IDs are only considered duplicates when they also have the same `MessageGroupId`, otherwise
   * de-duplication is applied globally. Global de-duplication limits the throughput of your entire Queue
   * to 300-3000 messages per second, so use it only when you absolutely need.
   * - `MessageGroupId` - Messages with the same MessageGroupId are guaranteed to be processed by consumers
   * in FIFO order. The first message sent is the first message received. Subsequent messages cannot be
   * processed until prior messages are deleted from the Queue.
   *
   * ```ts
   * await queue.sendMessageBatch({
   *   Entries: [{
   *     Message: message,
   *
   *     // prevent delivering this message more than once in a 5 minute time window
   *     MessageDeduplicationId: message.requestId,
   *
   *     // ensure messages with the same userId are processed in order
   *     // only care about de-duplication in the scope of a single `userId`.
   *     MessageGroupId: message.userId
   *   }]
   * });
   * ```
   *
   * If you don't specify the DelaySeconds parameter for an entry, Amazon SQS uses the default value
   * for the queue. Some actions take lists of parameters. These lists are specified using the
   * `param.n` notation - values of n are integers starting from 1.
   *
   * For example, a parameter list with two elements looks like this:
   * ```
   * &amp;AttributeName.1=first
   * &amp;AttributeName.2=second
   * ```
   */
  sendMessageBatch(
    input: SendMessageBatchRequest<Message>
  ): Promise<AWS.SQS.SendMessageBatchResult>;

  /**
   * Retrieves one or more messages (up to 10), from the specified queue.
   * Using the WaitTimeSeconds parameter enables long-poll support.
   * For more information, see Amazon SQS Long Polling in the Amazon SQS Developer Guide.
   *
   * Short poll is the default behavior where a weighted random set of machines is sampled
   * on a ReceiveMessage call. Thus, only the messages on the sampled machines are returned.
   *
   * If the number of messages in the queue is small (fewer than 1,000), you most likely get
   * fewer messages than you requested per ReceiveMessage call. If the number of messages in
   * the queue is extremely small, you might not receive any messages in a particular ReceiveMessage
   * response. If this happens, repeat the request
   *
   * For each message returned, the response includes the following:
   * - The message body.
   * - An MD5 digest of the message body. For information about MD5, see RFC1321.
   * - The MessageId you received when you sent the message to the queue.
   * - The receipt handle - the identifier you must provide when deleting the message.
   * - The message attributes.
   * - An MD5 digest of the message attributes.
   *
   * For more information, see [Queue and Message Identifiers](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-queue-message-identifiers.html)
   * in the Amazon SQS Developer Guide.
   *
   * You can provide the VisibilityTimeout parameter in your request. The parameter is applied to
   * the messages that Amazon SQS returns in the response. If you don't include the parameter, the
   * overall visibility timeout for the queue is used for the returned messages. For more information,
   * see [Visibility Timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html) in the Amazon SQS Developer Guide.
   *
   * ```ts
   * queue.receiveMessage({
   *   // we will have up to 60 seconds to process the received messages and delete them from the
   *   // queue until they will again be visible to other consumers.
   *   VisibilityTimeout: 60,
   * })
   * ```
   *
   * A message that isn't deleted or a message whose visibility isn't extended before the visibility
   * timeout expires counts as a failed receive. Depending on the configuration of the queue, the
   * message might be sent to the dead-letter queue.
   *
   * ```ts
   * const dlq = new Queue<Message>(scope, id);
   * const queue = new Queue<Message>(scope, id, {
   *   deadLetterQueue: dql
   * });
   *
   * dlq.messages().forEach(async (deadMessage) => {
   *   console.log("oopsy whoopsy", deadMessage);
   * });
   * ```
   *
   * In the future, new attributes might be added. If you write code that calls this action, we recommend
   * that you structure your code so that it can handle new attributes gracefully.
   */
  receiveMessage(
    input?: ReceiveMessageRequest
  ): Promise<ReceiveMessageResult<Message>>;

  /**
   * Deletes the messages in this queue.
   * ```ts
   * await queue.purge();
   * ```
   *
   * When you use the PurgeQueue action, you can't retrieve any messages deleted from a
   * queue. The message deletion process takes up to 60 seconds. We recommend waiting
   * for 60 seconds regardless of your queue's size.
   *
   * Messages sent to the queue before you call PurgeQueue might be received but are deleted within the
   * next minute. Messages sent to the queue after you call PurgeQueue might be deleted while the queue
   * is being purged.
   */
  purge(): Promise<{}>;
}

abstract class BaseQueue<Message>
  extends EventSource<
    aws_sqs.IQueue,
    QueueProps<Message>,
    lambda.SQSEvent,
    SQSEvent<Message>,
    lambda.SQSBatchResponse | void,
    aws_lambda_event_sources.SqsEventSourceProps
  >
  implements
    Integration<
      "Queue",
      // queue is not directly invokable, only via event bridge pipe.
      () => any,
      EventBusTargetIntegration<
        Message,
        Omit<aws_events_targets.SqsQueueProps, "message"> | undefined
      >
    >
{
  /**
   * @hidden
   */
  public static readonly FunctionlessType = "Queue";

  /**
   * @hidden
   */
  readonly functionlessKind = "Queue";

  /**
   * @hidden
   */
  readonly kind = "Queue";

  /**
   * @hidden
   */
  // @ts-ignore - value does not exist, is only available at compile time
  readonly __functionBrand: () => Promise<void>;

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

  readonly serializer: Serializer<Message>;

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
    this.serializer = this.props.serializer ?? Serializer.json();
    const codec = this.serializer.create();
    const lambdaQueueUrlRetriever = this.props.lambda?.queueUrlRetriever;

    function serialize(message: Message): string {
      if (codec) {
        return codec.write(message);
      } else if (typeof message === "string") {
        return message;
      } else if (Buffer.isBuffer(message)) {
        return message.toString("utf8");
      } else {
        throw new Error(
          `Message must be a string if there is no 'serializer' configured, ${message}`
        );
      }
    }

    this.sendMessage = makeIntegration<
      "AWS.SQS.SendMessage",
      (input: SendMessageRequest<Message>) => Promise<AWS.SQS.SendMessageResult>
    >({
      kind: "AWS.SQS.SendMessage",
      native: {
        bind: (func) => this.resource.grantSendMessages(func.resource),
        preWarm: (context) => context.getOrInit(SQSClient),
        call: async ([input], context) => {
          const sqs = context.getOrInit(SQSClient);

          const messageBody = serialize(input.MessageBody);

          // @ts-ignore
          delete input.MessageBody;

          const updatedQueueUrl =
            lambdaQueueUrlRetriever?.(queueUrl) ?? queueUrl;

          const response = await sqs
            .sendMessage({
              ...input,
              MessageBody: messageBody,
              QueueUrl: updatedQueueUrl,
            })
            .promise();

          return response;
        },
      },
      asl: (call, context) => {
        const input = call.args[0]?.expr;

        if (input === undefined) {
          throw new SynthError(
            ErrorCodes.Invalid_Input,
            `the first argument 'input' is required by sendMessage`
          );
        }

        this.resource.grantSendMessages(context.role);

        return context.evalExprToJsonPathOrLiteral(
          input,
          (input, { addState }) => {
            if (ASLGraph.isJsonPath(input)) {
              addState({
                Type: "Pass",
                ResultPath: `${input.jsonPath}.QueueUrl`,
                Result: this.resource.queueUrl,
                Next: ASLGraph.DeferNext,
              });
              if (this.serializer.dataType === DataType.Json) {
                // request.MessageBody.value = JSON.stringify(request.MessageBody)
                addState({
                  Type: "Pass",
                  ResultPath: `${input.jsonPath}.MessageBody`,
                  Parameters: {
                    "value.$":
                      "States.JsonToString(${input.jsonPath}.MessageBody)",
                  },
                  Next: ASLGraph.DeferNext,
                });
                // it's unfortunate that we have to do this
                // request.MessageBody = request.MessageBody.value
                addState({
                  Type: "Pass",
                  InputPath: `${input.jsonPath}.MessageBody.value`,
                  OutputPath: `${input.jsonPath}.MessageBody`,
                  Next: ASLGraph.DeferNext,
                });
              }
              return context.stateWithHeapOutput({
                Type: "Task",
                Resource: "arn:aws:states:::aws-sdk:sqs:sendMessage",
                Parameters: {
                  "MessageBody.$": input.jsonPath,
                  QueueUrl: this.queueUrl,
                },
                Next: ASLGraph.DeferNext,
              });
            } else if (
              input.value !== null &&
              typeof input.value === "object"
            ) {
              if (this.serializer.dataType === DataType.Json) {
                // when the data type is Json, we need to serialize the MessageBody to JSON
                let messageBodyJsonPath: string;
                if ("MessageBody" in input.value) {
                  messageBodyJsonPath = context.newHeapVariable();
                  addState({
                    Type: "Pass",
                    Parameters: input.value.MessageBody,
                    ResultPath: messageBodyJsonPath,
                    Next: ASLGraph.DeferNext,
                  });
                } else if ("MessageBody.$" in input.value) {
                  messageBodyJsonPath = input.value["MessageBody.$"];
                } else {
                  throw new SynthError(
                    ErrorCodes.Invalid_Input,
                    `the property 'MessageBody' is required in SendMessageRequest`
                  );
                }
                return context.stateWithHeapOutput({
                  Type: "Task",
                  Resource: "arn:aws:states:::aws-sdk:sqs:sendMessage",
                  Parameters: {
                    ...input.value,
                    "MessageBody.$": `States.JsonToString(${messageBodyJsonPath})`,
                    QueueUrl: this.queueUrl,
                  },
                  Next: ASLGraph.DeferNext,
                });
              } else {
                return context.stateWithHeapOutput({
                  Type: "Task",
                  Resource: "arn:aws:states:::aws-sdk:sqs:sendMessage",
                  Parameters: {
                    ...input.value,
                    QueueUrl: this.queueUrl,
                  },
                  Next: ASLGraph.DeferNext,
                });
              }
            } else {
              throw new SynthError(
                ErrorCodes.Unexpected_Error,
                `unexpected data type '${this.serializer.dataType}' is not supported by SQS by Step Functions`
              );
            }
          }
        );
      },
    });

    this.sendMessageBatch = makeIntegration<
      "AWS.SQS.SendMessageBatch",
      (
        input: SendMessageBatchRequest<Message>
      ) => Promise<AWS.SQS.SendMessageBatchResult>
    >({
      kind: "AWS.SQS.SendMessageBatch",
      native: {
        bind: (func) => this.resource.grantSendMessages(func.resource),
        preWarm: (context) => context.getOrInit(SQSClient),
        call: async ([input], context) => {
          const sqs: AWS.SQS = context.getOrInit<AWS.SQS>(SQSClient);

          const updatedQueueUrl =
            lambdaQueueUrlRetriever?.(queueUrl) ?? queueUrl;

          const response = await sqs
            .sendMessageBatch({
              ...input,
              Entries: input.Entries.map(
                ({ MessageBody: Message, ...entry }) => ({
                  ...entry,
                  MessageBody: serialize(Message),
                })
              ),
              QueueUrl: updatedQueueUrl,
            })
            .promise();

          return response;
        },
      },
      asl: (call, context) => {
        const entries = call.args[0]?.expr;
        if (entries === undefined) {
          throw new SynthError(
            ErrorCodes.Invalid_Input,
            `the first argument 'input' is required by sendMessageBatch`
          );
        }

        this.resource.grantSendMessages(context.role);

        if (this.serializer.dataType === DataType.String) {
          // when the data type is a String, no extra processing is required
          // so we evaluate the entries to a JsonPath or Literal and pass it straight through
          return context.evalExprToJsonPathOrLiteral(entries, (entries) => {
            if (
              ASLGraph.isJsonPath(entries) ||
              (entries.value !== null && typeof entries.value === "object")
            ) {
              return context.stateWithHeapOutput({
                Type: "Task",
                Resource: "arn:aws:states:::aws-sdk:sqs:sendMessageBatch",
                Parameters: {
                  QueueUrl: this.queueUrl,
                  ...(ASLGraph.isJsonPath(entries)
                    ? {
                        "Entries.$": `${entries.jsonPath}.Entries`,
                      }
                    : (entries.value as object)),
                },
                Next: ASLGraph.DeferNext,
              });
            } else {
              throw new SynthError(
                ErrorCodes.Invalid_Input,
                `invalid 'Entries' property in SendMessageBatchRequest`
              );
            }
          });
        } else if (this.serializer.dataType === DataType.Json) {
          // when the data type is Json, map over each of the entries and serialize them to JSON
          return context.evalExprToJsonPath(
            entries,
            (entries, { addState }) => {
              const heapVar = context.newHeapVariable();
              addState({
                Type: "Map",
                ItemsPath: `${entries.jsonPath}.Entries`,
                Parameters: {
                  "entry.$": "$$.Map.Item.Value",
                },
                ResultPath: heapVar,
                Next: ASLGraph.DeferNext,
                Iterator: {
                  StartAt: "serialize Message",
                  States: {
                    "serialize Message": {
                      Type: "Pass",
                      Parameters: {
                        "value.$":
                          this.serializer.dataType === DataType.Json
                            ? `States.JsonToString($.entry.MessageBody)`
                            : "$.entry.MessageBody",
                      },
                      ResultPath: "$.entry.MessageBody",
                      Next: "unwrap Message",
                    },
                    "unwrap Message": {
                      Type: "Pass",
                      InputPath: "$.entry.MessageBody.value",
                      ResultPath: "$.entry.MessageBody",
                      OutputPath: "$.entry",
                      End: true,
                    },
                  },
                },
              });

              return context.stateWithHeapOutput({
                Type: "Task",
                Resource: "arn:aws:states:::aws-sdk:sqs:sendMessageBatch",
                Parameters: {
                  QueueUrl: this.queueUrl,
                  "Entries.$": heapVar,
                },
                Next: ASLGraph.DeferNext,
              });
            }
          );
        } else {
          throw new SynthError(
            ErrorCodes.Unexpected_Error,
            `unknown DataType '${this.serializer.dataType}' is not supported by SQS by Step Functions`
          );
        }
      },
    });

    this.receiveMessage = makeIntegration<
      "AWS.SQS.ReceiveMessage",
      (input: ReceiveMessageRequest) => Promise<ReceiveMessageResult<Message>>
    >({
      kind: "AWS.SQS.ReceiveMessage",
      // asl: (call, context) => {},
      native: {
        bind: (func) => this.resource.grantConsumeMessages(func.resource),
        preWarm: (context) => context.getOrInit(SQSClient),
        call: async ([input], context) => {
          const sqs: AWS.SQS = context.getOrInit(SQSClient);

          const updatedQueueUrl =
            lambdaQueueUrlRetriever?.(queueUrl) ?? queueUrl;

          const response = await sqs
            .receiveMessage({
              ...input,
              QueueUrl: updatedQueueUrl,
            })
            .promise();

          return {
            Messages: response.Messages?.map((message) => ({
              ...message,
              Message:
                codec && message.Body
                  ? codec.read(message.Body)
                  : (message.Body as unknown as Message),
            })),
          };
        },
      },
      asl: (call, context) => {
        const queueUrl = this.queueUrl;
        const serializer = this.serializer;
        const input = call.args[0]?.expr;

        this.resource.grantConsumeMessages(context.role);
        const messagesHeap = context.newHeapVariable();

        if (input === undefined) {
          return context.evalContext(call, ({ addState }) => {
            addState(receiveAndParse(undefined));
            return {
              jsonPath: messagesHeap,
            };
          });
        } else {
          return context.evalExprToJsonPathOrLiteral(
            input,
            (input, { addState }) => {
              if (
                ASLGraph.isJsonPath(input) ||
                input.value === null ||
                typeof input.value !== "object"
              ) {
                // Because of limitations in `Parameters` - need support for `Parameters.$`
                throw new SynthError(
                  ErrorCodes.Invalid_Input,
                  `the 'input' to receiveMessage must be an object literal`
                );
              }
              addState(receiveAndParse(input.value));
              return {
                jsonPath: messagesHeap,
              };
            }
          );
        }

        function receiveAndParse(
          request: object | undefined
        ): ASLGraph.SubState {
          if (
            serializer.dataType !== DataType.Json &&
            serializer.dataType !== DataType.String
          ) {
            throw new SynthError(
              ErrorCodes.Unexpected_Error,
              `unknown DataType '${serializer.dataType}' is not supported by SQS by Step Functions`
            );
          }

          return {
            startState: "receive",
            states: {
              receive: {
                Type: "Task",
                Resource: "arn:aws:states:::aws-sdk:sqs:receiveMessage",
                ResultPath: messagesHeap,
                Parameters: {
                  ...(request ? request : {}),
                  QueueUrl: queueUrl,
                },
                Next:
                  serializer.dataType === DataType.Json
                    ? "parseIfMessages"
                    : ASLGraph.DeferNext,
              },
              ...(serializer.dataType === DataType.Json
                ? {
                    parseIfMessages: {
                      Type: "Choice",
                      Choices: [
                        {
                          IsPresent: true,
                          Variable: `${messagesHeap}.Messages`,
                          Next: "parse",
                        },
                      ],
                      Default: ASLGraph.DeferNext,
                    },
                    parse: {
                      Type: "Map",
                      Next: ASLGraph.DeferNext,
                      ResultPath: `${messagesHeap}.Messages`,
                      ItemsPath: `${messagesHeap}.Messages`,
                      Parameters: {
                        "message.$": "$$.Map.Item.Value",
                      },
                      Iterator: {
                        StartAt: "JsonParse",
                        States: {
                          JsonParse: {
                            Type: "Pass",
                            Parameters: {
                              "parsed.$": `States.StringToJson($.message.Body)`,
                            },
                            ResultPath: "$.message.Message",
                            Next: "UnwrapMessage",
                          },
                          UnwrapMessage: {
                            Type: "Pass",
                            InputPath: "$.message.Message.parsed",
                            ResultPath: "$.message.Message",
                            OutputPath: "$.message",
                            End: true,
                          },
                        },
                      },
                    },
                  }
                : {}),
            },
          };
        }
      },
    });

    this.purge = makeIntegration<"AWS.SQS.PurgeQueue", () => Promise<{}>>({
      kind: "AWS.SQS.PurgeQueue",
      native: {
        bind: (func) => this.resource.grantPurge(func.resource),
        preWarm: (context) => context.getOrInit(SQSClient),
        call: async ([], context) => {
          const updatedQueueUrl =
            lambdaQueueUrlRetriever?.(queueUrl) ?? queueUrl;

          return context
            .getOrInit(SQSClient)
            .purgeQueue({
              QueueUrl: updatedQueueUrl,
            })
            .promise();
        },
      },
      asl: (_, context) => {
        this.resource.grantPurge(context.role);
        return context.stateWithVoidOutput({
          Type: "Task",
          Resource: "arn:aws:states:::aws-sdk:sqs:purgeQueue",
          Parameters: {
            QueueUrl: this.queueUrl,
          },
          Next: ASLGraph.DeferNext,
        });
      },
    });
  }

  /**
   * Returns an {@link Iterable} instance that can be used to process messages
   * in this {@link Queue}.
   *
   * #### Example Usage
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
   */
  public messages(): Iterable<
    Message,
    lambda.SQSEvent,
    SQSEvent<Message>,
    SQSRecord<Message>,
    lambda.SQSBatchResponse,
    aws_lambda_event_sources.SqsEventSourceProps
  > {
    const config: aws_lambda_event_sources.SqsEventSourceProps = {
      reportBatchItemFailures: true,
    };
    return new Iterable<
      Message,
      lambda.SQSEvent,
      SQSEvent<Message>,
      SQSRecord<Message>,
      lambda.SQSBatchResponse,
      Omit<
        aws_lambda_event_sources.SqsEventSourceProps,
        "reportBatchItemFailures"
      >
    >(
      this as IEventSource<
        lambda.SQSEvent,
        SQSEvent<Message>,
        lambda.SQSBatchResponse,
        Omit<
          aws_lambda_event_sources.SqsEventSourceProps,
          "reportBatchItemFailures"
        >
      >,
      (event) => event,
      config
    );
  }

  /**
   * @hidden
   */
  protected createResource(
    scope: Construct,
    id: string,
    config: QueueProps<Message>
  ): aws_sqs.IQueue {
    return new aws_sqs.Queue(scope, id, {
      ...config,
      deadLetterQueue: config.deadLetterQueue
        ? {
            maxReceiveCount: config.deadLetterQueue.maxReceiveCount,
            queue: config.deadLetterQueue.queue.resource,
          }
        : undefined,
    });
  }

  /**
   * @hidden
   */
  protected createEventSource(
    config: aws_lambda_event_sources.SqsEventSourceProps
  ): aws_lambda.IEventSource {
    return new aws_lambda_event_sources.SqsEventSource(this.resource, config);
  }

  /**
   * @hidden
   */
  protected createParser(): (event: lambda.SQSEvent) => SQSEvent<Message> {
    const code = this.serializer?.create();
    return (event) => ({
      Records: event.Records.map((record) => ({
        ...record,
        message: code
          ? code.read(record.body)
          : // this is unsafe - how can we ensure that, when no serializer is provided, then the message is always the raw string?
            (record.body as unknown as Message),
      })),
    });
  }

  /**
   * @hidden
   */
  public createResponseHandler(): (
    failed: lambda.SQSRecord[]
  ) => lambda.SQSBatchResponse {
    return (failed) => ({
      batchItemFailures: failed.map((failed) => ({
        itemIdentifier: failed.messageId,
      })),
    });
  }

  /**
   * @hidden
   */
  public createGetPayload(): (event: SQSRecord<Message>) => any {
    return (event) => event.message;
  }

  /**
   * Support `bus.when(...).pipe(queue)`
   *
   * @hidden
   */
  public readonly eventBus = makeEventBusIntegration<
    Message,
    Omit<aws_events_targets.SqsQueueProps, "message"> | undefined
  >({
    target: (props, targetInput?) => {
      return new aws_events_targets.SqsQueue(this.resource, {
        ...(props ?? {}),
        message: targetInput,
      });
    },
  });
}

export interface DeadLetterQueue<Message>
  extends Omit<aws_sqs.DeadLetterQueue, "queue"> {
  /**
   * The dead-letter queue to which Amazon SQS moves messages after the value of maxReceiveCount is exceeded.
   */
  queue: IQueue<Message>;
}

export interface QueueProps<Message>
  extends Omit<aws_sqs.QueueProps, "deadLetterQueue"> {
  /**
   * Specifies the {@link Serializer} instance to use for serializing messages
   * sent to the Queue and deserializing messages received from the Queue.
   *
   * @default {@link JsonSerializer}
   */
  serializer?: Serializer<Message>;
  /**
   * Options related to using the Queue in a {@link Function}.S
   */
  lambda?: {
    /**
     * An optional callback which allows customization of the queue url when using Queue APIs in lambda.
     *
     * For example, when using Functionless with `localstack`, the queue url in CDK is different
     * from the queue url in the lambda execution environment.
     *
     * ```ts
     * lambdaQueueUrlRetriever: (queueUrl) =>
     *    process.env.LOCALSTACK_HOSTNAME
     *       ? queueUrl.replace("localhost", process.env.LOCALSTACK_HOSTNAME)
     *       : queueUrl,
     * ```
     */
    queueUrlRetriever?: (queueUrl: string) => string;
  };

  /**
   * Send messages to this queue if they were unsuccessfully dequeued a number of times.
   *
   * @default no dead-letter queue
   */
  deadLetterQueue?: DeadLetterQueue<Message>;
}

export interface IQueue<T = any> extends BaseQueue<T> {}

/**
 * A SQS Queue. Each of the messages stored in the Queue are of type {@link T}.
 *
 * #### Example Usage
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
