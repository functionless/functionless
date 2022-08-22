import { aws_sqs, aws_lambda } from "aws-cdk-lib";
import { Construct, IConstruct } from "constructs";
import { Function, FunctionProps } from "./function";

export interface IEventSource<
  RawEvent = any,
  ParsedEvent = any,
  Response = any,
  EventSourceConfig = any
> {
  onEvent(
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  onEvent(
    props: FunctionProps<ParsedEvent, Response> & EventSourceConfig,
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  onEvent(
    id: string,
    props: FunctionProps<ParsedEvent, Response> & EventSourceConfig,
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

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

export abstract class EventSource<
  Resource extends IConstruct = IConstruct,
  ResourceProps = any,
  RawEvent extends EventBatch = EventBatch,
  ParsedEvent extends EventBatch = EventBatch,
  Response = any,
  EventSourceConfig = any
> implements IEventSource<RawEvent, ParsedEvent, Response, EventSourceConfig>
{
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
  }

  public onEvent(
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  public onEvent(
    props: FunctionProps<ParsedEvent, Response> & EventSourceConfig,
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

  public onEvent(
    id: string,
    props: FunctionProps<ParsedEvent, Response> & EventSourceConfig,
    handler: (parsed: ParsedEvent, raw: RawEvent) => Promise<Response>
  ): Function<RawEvent, Response>;

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
      return handler(parse(event), event);
    });

    func.resource.addEventSource(this.createEventSource(props));

    return func;
  }

  protected abstract createParser(): (event: RawEvent) => ParsedEvent;

  public abstract createGetPayload(): (
    event: ParsedEvent["Records"][number]
  ) => any;

  public abstract createResponseHandler(): (
    failed: RawEvent["Records"]
  ) => Response;

  protected abstract createResource(
    scope: Construct,
    id: string,
    props: ResourceProps
  ): Resource;

  protected abstract createEventSource(
    config: EventSourceConfig
  ): aws_lambda.IEventSource;

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
