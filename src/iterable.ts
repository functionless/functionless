import type { Construct } from "constructs";
import type { EventBatch, EventSource, IEventSource } from "./event-source";
import type { Function, FunctionProps } from "./function";

export type Processor<
  Item = any,
  Processed = any,
  Record = any,
  Event = any,
  Raw = any
> = (
  item: Item,
  record: Record,
  event: Event,
  raw: Raw
) => Processed | Promise<Processed>;

export type BatchProcessor<Element, Response, Event, Raw> = (
  batch: Element[],
  event: Event,
  raw: Raw
) => Promise<Response>;

export interface IIterable<
  Item,
  RawEvent,
  ParsedEvent,
  ParsedRecord,
  Response,
  EventSourceConfig
> {
  map<U>(
    fn: Processor<Item, U, ParsedRecord, ParsedEvent, RawEvent>
  ): IIterable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  flatMap<U>(
    fn: Processor<Item, U[], ParsedRecord, ParsedEvent, RawEvent>
  ): IIterable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  filter<U extends Item>(
    predicate: (item: Item) => item is U
  ): IIterable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  filter(
    predicate: (item: Item) => boolean | Promise<boolean>
  ): IIterable<
    Item,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  forEach(
    fn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEach(
    props: FunctionProps<any, any> & EventSourceConfig,
    fn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEach(
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    fn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEach(
    scope: Construct,
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    fn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEachBatch(
    fn: BatchProcessor<Item, Response, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEachBatch(
    props: FunctionProps<any, any> & EventSourceConfig,
    fn: BatchProcessor<Item, Response, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEachBatch(
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    fn: BatchProcessor<Item, Response, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEachBatch(
    scope: Construct,
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    fn: BatchProcessor<Item, Response, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;
}

export function isIterable(a: any): a is Iterable {
  return a?.kind === "Iterable";
}

export class Iterable<
  Item = any,
  RawEvent extends EventBatch = any,
  ParsedEvent extends EventBatch = any,
  ParsedRecord = any,
  Response = any,
  EventSourceConfig = any
> implements
    IIterable<
      Item,
      RawEvent,
      ParsedEvent,
      ParsedRecord,
      Response,
      EventSourceConfig
    >
{
  readonly kind = "Iterable";

  constructor(
    private readonly prev:
      | IEventSource<RawEvent, ParsedEvent, Response, EventSourceConfig>
      | Iterable<
          any,
          RawEvent,
          ParsedEvent,
          ParsedRecord,
          Response,
          EventSourceConfig
        >,
    private readonly fn: Processor<
      any,
      Item[],
      ParsedRecord,
      ParsedEvent,
      RawEvent
    >
  ) {}

  public map<U>(
    fn: Processor<Item, U, ParsedRecord, ParsedEvent, RawEvent>
  ): IIterable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  > {
    return this.flatMap(async (...args) => [await fn(...args)]);
  }

  public filter<U extends Item>(
    predicate: (item: Item) => item is U
  ): IIterable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  public filter(
    predicate: (item: Item) => boolean | Promise<boolean>
  ): IIterable<
    Item,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  public filter(
    predicate: (item: Item) => boolean | Promise<boolean>
  ): IIterable<
    any,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  > {
    return this.flatMap(async (event) => {
      let pred = predicate(event);
      if (pred instanceof Promise) {
        pred = await pred;
      }
      return pred ? [event] : [];
    });
  }

  public flatMap<U>(
    fn: Processor<Item, U[], ParsedRecord, ParsedEvent, RawEvent>
  ): IIterable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  > {
    return new Iterable(this, fn);
  }

  public forEach(
    fn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  public forEach(
    props: FunctionProps<any, any> & EventSourceConfig,
    fn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  public forEach(
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    fn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  public forEach(
    scope: Construct,
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    fn: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  public forEach(...args: any[]): Function<RawEvent, Response, RawEvent> {
    const source = this.getSource();
    const [scope, id, props, processFunc] =
      source.parseArgs<(event: any) => any[] | Promise<any[]>>(args);

    const chain = this.getCallChain();

    const handleResponse = source.createResponseHandler();

    const getPayload = source.createGetPayload();

    return this.getSource().onEvent(scope, id, props, async (event, raw) => {
      return handleResponse(
        (
          await Promise.all(
            event.Records.map(async (record) => {
              const payload = getPayload(record);
              try {
                let items: any[] = [payload];
                for (const func of chain) {
                  items = (
                    await Promise.all(
                      items.map((item) =>
                        awaitIfPromise(func(item, record, event, raw))
                      )
                    )
                  ).flat(1);
                }

                await Promise.all(
                  items.map(async (item) => awaitIfPromise(processFunc(item)))
                );
                return undefined;
              } catch (err) {
                // TODO: is it safe to always log user-errors? Should this be enabled/disabled?
                console.error(err);
                return record;
              }
            })
          )
        ).filter(
          (record): record is Exclude<typeof record, undefined> =>
            record !== undefined
        )
      );
    });
  }

  public forEachBatch(
    fn: BatchProcessor<Item, Response, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  public forEachBatch(
    props: FunctionProps<any, any> & EventSourceConfig,
    fn: BatchProcessor<Item, Response, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  public forEachBatch(
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    fn: BatchProcessor<Item, Response, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  public forEachBatch(
    scope: Construct,
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    fn: BatchProcessor<Item, Response, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  public forEachBatch(..._args: any[]): Function<RawEvent, Response, RawEvent> {
    throw new Error("Method not implemented.");
  }

  private getCallChain(): Processor[] {
    if (isIterable(this.prev)) {
      return [...this.prev.getCallChain(), this.fn];
    } else {
      return [this.fn];
    }
  }

  private getSource(): EventSource<
    any,
    any,
    RawEvent,
    ParsedEvent,
    Response,
    any
  > {
    if (isIterable(this.prev)) {
      return this.prev.getSource();
    } else {
      return this.prev as any;
    }
  }
}

function awaitIfPromise<T>(value: T | Promise<T>): Promise<T> {
  if (value instanceof Promise) {
    return value;
  } else {
    return Promise.resolve(value);
  }
}
