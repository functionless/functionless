import { Stack } from "aws-cdk-lib";

import {
  EventBus,
  EventTransform,
  Rule,
} from "@functionless/aws-events-constructs";
import { Function } from "@functionless/aws-lambda-constructs";

const stack = new Stack();
const bus = new EventBus(stack, "bus");
const func = new Function<undefined, { source: string }>(
  stack,
  "func",
  async () => ({ source: "hi" })
);

/**
 * Invalid integrations in transformers
 */
bus.all().map(() => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  bus.putEvents({ "detail-type": "detail", detail: {}, source: "" });
  return {};
});

bus.all().map(async () => {
  return func();
});

new EventTransform(async () => {
  return func();
}, bus.all());

/**
 * Invalid integrations in rules
 */

bus.when("rule1", () => {
  return (func() as any) === "x";
});

new Rule(stack, "rule2", bus, () => {
  return (func() as any) === "x";
});

// truthy is not allowed
bus.when("rule", (event) => <any>event);
bus.when("rule", (event) => event as any);
bus.when("rule", (event) => event.detail.a);
bus.when("rule", (event) => !event.detail.a);
bus.when("rule", (event) => !event.detail.a || event.detail.b === "b");
bus.when("rule", (event) => event.detail.a === "b" || !event.detail.b);
bus.when("rule", (event) => event.detail.a && event.detail.b === "b");
bus.when("rule", (event) => event.detail.a === "a" && event.detail.b);
bus.when("rule", (event) => event.detail.a || event.detail.b === "b");
bus.when("rule", (event) => event.detail.a === "a" || event.detail.b);
