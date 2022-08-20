import { aws_sqs, aws_lambda_event_sources, aws_lambda } from "aws-cdk-lib";
import lambda from "aws-lambda";
import { Construct } from "constructs";
import { EventSource } from "./event-source";
import { Function, FunctionProps } from "./function";
import { Serializer } from "./serializer";

export interface SQSEvent<T> {
  Records: SQSRecord<T>[];
}

export interface SQSRecord<T> extends lambda.SQSRecord {
  message: T;
}

abstract class BaseQueue<T> extends EventSource<
  aws_sqs.IQueue,
  QueueProps<T>,
  lambda.SQSEvent,
  SQSEvent<T>,
  lambda.SQSBatchResponse,
  aws_lambda_event_sources.SqsEventSourceProps
> {
  public get queueArn() {
    return this.resource.queueArn;
  }

  public get queueName() {
    return this.resource.queueName;
  }

  public get queueUrl() {
    return this.resource.queueUrl;
  }

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

  protected createParser(): (event: lambda.SQSEvent) => SQSEvent<T> {
    const serializer = this.props.serializer?.create();
    return (event) => ({
      Records: event.Records.map((record) => ({
        ...record,
        message: serializer
          ? serializer.read(record.body)
          : // this is unsafe - how can we ensure that, when no serializer is provided, then the message is always the raw string?
            (record.body as unknown as T),
      })),
    });
  }

  public forEach(
    process: MessageProcessor<T>
  ): Function<lambda.SQSEvent, lambda.SQSBatchResponse>;

  public forEach(
    props: MessageProcessorProps,
    process: MessageProcessor<T>
  ): Function<lambda.SQSEvent, lambda.SQSBatchResponse>;

  public forEach(
    id: string,
    props: MessageProcessorProps,
    process: MessageProcessor<T>
  ): Function<lambda.SQSEvent, lambda.SQSBatchResponse>;

  public forEach(
    scope: Construct,
    id: string,
    props: MessageProcessorProps,
    process: MessageProcessor<T>
  ): Function<lambda.SQSEvent, lambda.SQSBatchResponse>;

  public forEach(...args: any[]) {
    const [scope, id, props, process] = this.parseEventSourceArgs<
      MessageProcessor<T>
    >(args, "forEach");
    return this.onEvent(scope, id, props, async (event, raw) => ({
      batchItemFailures: (
        await Promise.all(
          event.Records.map(async (record) => {
            console.log(record);
            try {
              await process(record.message, record, event, raw);
              return [];
            } catch (err) {
              console.log(err);
              return [
                <lambda.SQSBatchItemFailure>{
                  itemIdentifier: record.messageId,
                },
              ];
            }
          })
        )
      ).flat(),
    }));
  }

  public forEachBatch(
    process: (
      messages: T[],
      records: SQSRecord<T>[],
      event: SQSEvent<T>,
      raw: lambda.SQSEvent
    ) => Promise<void>
  ): Function<lambda.SQSEvent, lambda.SQSBatchResponse> {
    return this.onEvent(async (event, raw) => {
      try {
        await process(
          event.Records.map((record) => record.message),
          event.Records,
          event,
          raw
        );
        return {
          batchItemFailures: [],
        };
      } catch {
        return {
          batchItemFailures: event.Records.map((record) => ({
            itemIdentifier: record.messageId,
          })),
        };
      }
    });
  }
}

export type MessageProcessorProps =
  aws_lambda_event_sources.SqsEventSourceProps & FunctionProps;

export type MessageProcessor<T> = (
  message: T,
  record: SQSRecord<T>,
  event: SQSEvent<T>,
  raw: lambda.SQSEvent
) => Promise<void>;

export interface QueueProps<T> extends aws_sqs.QueueProps {
  serializer?: Serializer<T>;
}

export interface IQueue<T = any> extends BaseQueue<T> {}

export class Queue<T = any> extends BaseQueue<T> implements IQueue<T> {
  constructor(scope: Construct, id: string, props?: QueueProps<T>) {
    super(scope, id, props ?? {});
  }
}
