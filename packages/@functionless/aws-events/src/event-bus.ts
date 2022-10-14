import type { EventBusProps } from "aws-cdk-lib/aws-events";
import { Event } from "./event";

export interface EventBusEvent<
  Detail extends object = {},
  Type extends string = string,
  Source extends string = string
> {
  detail: Detail;
  "detail-type": Type;
  source: Source;
}

export const EventBusKind = "fl.EventBus";

export interface EventBus<
  in In extends EventBusEvent = EventBusEvent,
  out Out extends In = In
> {
  _out?: Out;

  kind: typeof EventBusKind;
  props?: EventBusProps;
}

export function isEventBus(a: any): a is EventBus {
  return a?.kind === EventBusKind;
}

export function EventBus<E extends EventBusEvent>(
  props?: EventBusProps
): EventBus<EventBusEvent<E["detail"], E["detail-type"], E["source"]>> {
  return (<EventBus<Event<E["detail"], E["detail-type"], E["source"]>>>{
    kind: EventBusKind,
    props,
  }) as any;
}
