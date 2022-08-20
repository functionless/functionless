import { aws_sqs, aws_lambda } from "aws-cdk-lib";
import { Construct, IConstruct } from "constructs";
import { Function, FunctionProps } from "./function";

export interface IEventSource<RawEvent, Event, Response, EventSourceConfig> {
  onEvent(
    handler: (parsed: Event, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  onEvent(
    props: FunctionProps<Event, Response> & EventSourceConfig,
    handler: (parsed: Event, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  onEvent(
    id: string,
    props: FunctionProps<Event, Response> & EventSourceConfig,
    handler: (parsed: Event, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  onEvent(
    scope: Construct,
    id: string,
    props: FunctionProps<Event, Response> & EventSourceConfig,
    handler: (parsed: Event, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;
}

export interface EventSource<
  Resource extends IConstruct,
  ResourceProps,
  RawEvent,
  ParsedEvent,
  Response,
  EventSourceConfig
> extends IEventSource<RawEvent, ParsedEvent, Response, EventSourceConfig> {}

export abstract class EventSource<
  Resource extends IConstruct,
  ResourceProps,
  RawEvent,
  ParsedEvent,
  Response,
  EventSourceConfig
> {
  readonly resource: Resource;

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

    this.onEvent = function (...args: any[]) {
      const [scope, id, props, handler] =
        this.parseEventSourceArgs<
          (event: ParsedEvent, payload: RawEvent) => Promise<Response>
        >(args);

      const parse = this.createParser();

      const func = new Function(scope, id, props, (event: any) => {
        console.log(event);
        return handler(parse(event), event);
      });
      func.resource.addEventSource(this.createEventSource(props));
      return func;
    };
  }

  protected parseEventSourceArgs<F>(
    args: any[],
    /**
     * Optionally specify an override for the default Construct ID
     *
     * @default "onEvent"
     */
    defaultId?: string
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
      return [this.resource, defaultId ?? "onEvent", ...args] as any;
    } else {
      return [this.resource, defaultId ?? "onEvent", {}, ...args] as any;
    }
  }

  protected abstract createParser(): (event: RawEvent) => ParsedEvent;

  protected abstract createResource(
    scope: Construct,
    id: string,
    props: ResourceProps
  ): Resource;

  protected abstract createEventSource(
    config: EventSourceConfig
  ): aws_lambda.IEventSource;
}
