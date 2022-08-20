import { aws_sqs, aws_lambda_event_sources, aws_lambda } from "aws-cdk-lib";
import lambda from "aws-lambda";
import { Construct } from "constructs";
import { EventSource } from "./event-source";

export interface SQSEvent<T> {
  Records: SQSRecord<T>[];
}

export interface SQSRecord<T> extends Omit<lambda.SQSRecord, "body"> {
  body: T;
}

export interface QueueProps extends aws_sqs.QueueProps {}

export interface IQueue<T = string> extends BaseQueue<T> {}

abstract class BaseQueue<T> extends EventSource<
  aws_sqs.IQueue,
  aws_sqs.QueueProps,
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
}

export class TextQueue extends BaseQueue<string> implements IQueue<string> {
  protected createPreProcessor(): (event: lambda.SQSEvent) => SQSEvent<string> {
    return (event) => event;
  }
}

export class JsonQueue<T> extends BaseQueue<T> implements IQueue<T> {
  protected createPreProcessor(): (event: lambda.SQSEvent) => SQSEvent<T> {
    return (event) => ({
      Records: event.Records.map((record) => ({
        ...record,
        body: JSON.parse(record.body) as T,
      })),
    });
  }
}
