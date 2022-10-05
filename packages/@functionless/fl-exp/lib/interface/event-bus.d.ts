import type { EventBusProps } from "aws-cdk-lib/aws-events";
export interface EventBusEvent<Detail extends object = {}, Type extends string = string, Source extends string = string> {
    detail: Detail;
    "detail-type": Type;
    source: Source;
}
export declare const EventBusKind = "fl.EventBus";
export interface EventBus<in In extends EventBusEvent = EventBusEvent, out Out extends In = In> {
    _out?: Out;
    kind: typeof EventBusKind;
    props?: EventBusProps;
}
export declare function isEventBus(a: any): a is EventBus;
export declare function EventBus<Event extends EventBusEvent>(props?: EventBusProps): EventBus<EventBusEvent<Event["detail"], Event["detail-type"], Event["source"]>>;
//# sourceMappingURL=event-bus.d.ts.map