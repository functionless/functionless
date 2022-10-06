import type * as functionless from "@functionless/aws-constructs";
import type { EventBusProps } from "aws-cdk-lib/aws-events";

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

export function EventBus<Event extends EventBusEvent>(
  props?: EventBusProps
): EventBus<
  EventBusEvent<Event["detail"], Event["detail-type"], Event["source"]>
> {
  return (<
    EventBus<
      functionless.Event<Event["detail"], Event["detail-type"], Event["source"]>
    >
  >{
    kind: EventBusKind,
    props,
  }) as any;
}
