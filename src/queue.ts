import { aws_sqs, aws_lambda_event_sources } from "aws-cdk-lib";
import lambda from "aws-lambda";
import { Construct } from "constructs";
import { Function } from "./function";

class BaseQueue<T> {
  readonly resource: aws_sqs.IQueue;

  constructor(scope: Construct, id: string, props?: QueueProps);
  constructor(resource: aws_sqs.IQueue, props?: QueueProps);
  constructor(
    ...args:
      | [secret: aws_sqs.IQueue, props?: QueueProps]
      | [scope: Construct, id: string, props?: QueueProps]
  ) {
    let props: QueueProps | undefined;
    if (typeof args[1] !== "string") {
      this.resource = args[0] as aws_sqs.IQueue;
      props = args[1];
    } else {
      props = args[2] as QueueProps;
      this.resource = new aws_sqs.Queue(args[0], args[1], props);
    }
  }

  public get queueArn() {
    return this.resource.queueArn;
  }

  public get queueName() {
    return this.resource.queueName;
  }

  public get queueUrl() {
    return this.resource.queueUrl;
  }

  public forEach(
    handler: Function<SQSEvent<T>, lambda.SQSBatchResponse>,
    props?: aws_lambda_event_sources.SqsEventSourceProps
  ): void {
    handler.resource.addEventSource(
      new aws_lambda_event_sources.SqsEventSource(this.resource, props)
    );
  }
}

export interface SQSEvent<T> {
  Records: SQSRecord<T>[];
}

export interface SQSRecord<T> extends Omit<lambda.SQSRecord, "body"> {
  body: T;
}

export interface QueueProps extends aws_sqs.QueueProps {}

export interface IQueue<T = string> extends BaseQueue<T> {}

// export interface QueueEvent

export class Queue<T = string> extends BaseQueue<T> implements IQueue<T> {}
