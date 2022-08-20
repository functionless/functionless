import type { Construct } from "constructs";
import type { EventSource } from "./event-source";
import type { Function, FunctionProps } from "./function";

export type Processor<
  Item = any,
  Processed = any,
  Record = any,
  Event = any,
  Raw = any
> = (item: Item, record: Record, event: Event, raw: Raw) => Promise<Processed>;

export type BatchProcessor<Element, Response, Event, Raw> = (
  batch: Element[],
  event: Event,
  raw: Raw
) => Promise<Response>;

export interface IEnumerable<
  Item,
  RawEvent,
  ParsedEvent,
  ParsedRecord,
  Response,
  EventSourceConfig
> {
  map<U>(
    process: Processor<Item, U, ParsedRecord, ParsedEvent, RawEvent>
  ): IEnumerable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  flatMap<U>(
    process: Processor<Item, U[], ParsedRecord, ParsedEvent, RawEvent>
  ): IEnumerable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  filter<U extends Item>(
    predicate: (item: Item) => item is U
  ): IEnumerable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  >;

  forEach(
    process: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEach(
    props: FunctionProps<any, any> & EventSourceConfig,
    process: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEach(
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    process: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEach(
    scope: Construct,
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    process: Processor<Item, void, ParsedRecord, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEachBatch(
    process: BatchProcessor<Item, Response, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEachBatch(
    props: FunctionProps<any, any> & EventSourceConfig,
    process: BatchProcessor<Item, Response, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEachBatch(
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    process: BatchProcessor<Item, Response, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;

  forEachBatch(
    scope: Construct,
    id: string,
    props: FunctionProps<any, any> & EventSourceConfig,
    process: BatchProcessor<Item, Response, ParsedEvent, RawEvent>
  ): Function<RawEvent, Response>;
}

export function isChain(a: any): a is Chain {
  return a?.kind === "Chain";
}

export class Chain<
  Item = any,
  RawEvent = any,
  ParsedEvent = any,
  ParsedRecord = any,
  Response = any,
  EventSourceConfig = any
> implements
    IEnumerable<
      Item,
      RawEvent,
      ParsedEvent,
      ParsedRecord,
      Response,
      EventSourceConfig
    >
{
  readonly kind = "Chain";

  constructor(
    private readonly prev: EventSource | Chain,
    private readonly process: Processor<
      any,
      Item,
      ParsedRecord,
      ParsedEvent,
      RawEvent
    >
  ) {}

  public map<U>(
    process: Processor<Item, U, ParsedRecord, ParsedEvent, RawEvent>
  ): IEnumerable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  > {
    return this.flatMap(async (...args) => [await process(...args)]);
  }

  public filter<U extends Item>(
    predicate: (item: Item) => item is U
  ): IEnumerable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  > {
    return this.flatMap(async (event) => (predicate(event) ? [event] : []));
  }

  public flatMap<U>(
    process: Processor<Item, U[], ParsedRecord, ParsedEvent, RawEvent>
  ): IEnumerable<
    U,
    RawEvent,
    ParsedEvent,
    ParsedRecord,
    Response,
    EventSourceConfig
  > {
    throw new Error("Method not implemented.");
  }

  public forEach(...args: any[]): Function<RawEvent, Response, RawEvent> {
    const [scope, id, props, process] =
      this.getSource().parseArgs<(event: any) => any[] | Promise<any[]>>(args);

    const chain = this.getCallChain();

    return this.getSource().onEvent(scope, id, props, async (event, raw) => {
      return Promise.all(
        event.Records.map(async (record) => {
          try {
            let items: any[] = [record];
            for (const func of chain) {
              items = (
                await Promise.all(
                  items.map(async (item) => {
                    let result = func(item, record, event, raw);
                    if (result instanceof Promise) {
                      result = await result;
                    }
                    return result;
                  })
                )
              ).flat();
            }
            return {
              ok: process(items),
            };
          } catch {
            return {
              err: record,
            };
          }
        })
      );
    });
  }

  public forEachBatch(...args: any[]): Function<RawEvent, Response, RawEvent> {
    throw new Error("Method not implemented.");
  }

  private getCallChain(): Processor[] {
    if (isChain(this.prev)) {
      return [...this.prev.getCallChain(), this.process];
    } else {
      return [this.process];
    }
  }

  private getSource(): EventSource {
    if (isChain(this.prev)) {
      return this.prev.getSource();
    } else {
      return this.prev;
    }
  }
}
