import { aws_sqs, aws_lambda } from "aws-cdk-lib";
import { Construct, IConstruct } from "constructs";
import { Function, FunctionProps } from "./function";

export interface IEventSource<Event, Response, EventSourceConfig> {
  onEvent(
    handler: (event: Event) => Promise<Response>
  ): Function<Event, Response>;

  onEvent(
    props: FunctionProps<Event, Response> & EventSourceConfig,
    handler: (event: Event) => Promise<Response>
  ): Function<Event, Response>;

  onEvent(
    id: string,
    props: FunctionProps<Event, Response> & EventSourceConfig,
    handler: (event: Event) => Promise<Response>
  ): Function<Event, Response>;

  onEvent(
    scope: Construct,
    id: string,
    props: FunctionProps<Event, Response> & EventSourceConfig,
    handler: (event: Event) => Promise<Response>
  ): Function<Event, Response>;
}

export interface EventSource<
  Resource extends IConstruct,
  ResourceProps,
  RawEvent,
  Event,
  Response,
  EventSourceConfig
> extends IEventSource<Event, Response, EventSourceConfig> {}

export abstract class EventSource<
  Resource extends IConstruct,
  ResourceProps,
  RawEvent,
  Event,
  Response,
  EventSourceConfig
> {
  readonly resource: Resource;

  constructor(scope: Construct, id: string, props?: ResourceProps);
  constructor(resource: Resource, props?: ResourceProps);
  constructor(
    ...args:
      | [secret: aws_sqs.IQueue, props?: ResourceProps]
      | [scope: Construct, id: string, props?: ResourceProps]
  ) {
    if (typeof args[1] !== "string") {
      this.resource = args[0] as Resource;
    } else {
      this.resource = this.createResource(
        args[0],
        args[1],
        args[2] as ResourceProps
      );
    }

    this.onEvent = function (...args: any[]) {
      const [scope, id, props, handler] = (
        typeof args[1] === "string"
          ? args
          : typeof args[0] === "string"
          ? [this.resource, ...args]
          : typeof args[0] === "object"
          ? [this.resource, "forEach", ...args]
          : [this.resource, "forEach", {}, ...args]
      ) as [
        scope: Construct,
        id: string,
        props: FunctionProps<any, Response> & EventSourceConfig,
        handler: (event: Event) => Promise<Response>
      ];

      const preProcess = this.createPreProcessor();

      const func = new Function(scope, id, props, (event: any) => {
        return handler(preProcess(event));
      });
      func.resource.addEventSource(this.createEventSource(props));
      return func;
    };
  }

  protected abstract createPreProcessor(): (event: RawEvent) => Event;

  protected abstract createResource(
    scope: Construct,
    id: string,
    props: ResourceProps
  ): Resource;

  protected abstract createEventSource(
    config: EventSourceConfig
  ): aws_lambda.IEventSource;
}
