import { aws_sqs, aws_lambda_event_sources, aws_lambda } from "aws-cdk-lib";
import lambda from "aws-lambda";
import { Construct } from "constructs";
import { EventSource } from "./event-source";
import { Iterable } from "./iterable";
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

  public messages(): Iterable<
    T,
    lambda.SQSEvent,
    SQSEvent<T>,
    SQSRecord<T>,
    lambda.SQSBatchResponse,
    aws_lambda_event_sources.SqsEventSourceProps
  > {
    return new Iterable<
      T,
      lambda.SQSEvent,
      SQSEvent<T>,
      SQSRecord<T>,
      lambda.SQSBatchResponse,
      aws_lambda_event_sources.SqsEventSourceProps
    >(this, (event) => event);
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

  public createResponseHandler(): (
    failed: lambda.SQSRecord[]
  ) => lambda.SQSBatchResponse {
    return (failed) => ({
      batchItemFailures: failed.map((failed) => ({
        itemIdentifier: failed.messageId,
      })),
    });
  }

  public createGetPayload(): (event: SQSRecord<T>) => any {
    return (event) => event.message;
  }
}

export interface QueueProps<T> extends aws_sqs.QueueProps {
  serializer?: Serializer<T>;
}

export interface IQueue<T = any> extends BaseQueue<T> {}

export class Queue<T = any> extends BaseQueue<T> implements IQueue<T> {
  constructor(scope: Construct, id: string, props?: QueueProps<T>) {
    super(scope, id, props ?? {});
  }
}
