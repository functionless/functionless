import { Stack } from "aws-cdk-lib";
import { EventBus, Function, Rule } from "../../src";
import { EventTransform } from "../../src/event-bridge/transform";

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

bus.when("rule1", (event): event is any => {
  return (func() as any) === "x";
});

new Rule(stack, "rule2", bus, (event): event is any => {
  return (func() as any) === "x";
});
