import { aws_events, aws_lambda, Stack } from "aws-cdk-lib";
import { EventBus, EventBusRule } from "../src/event-bridge";
import { EventBusTransform } from "../src/event-bridge/transform";
import { Function } from "../src/function";

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});

test("new bus from aws bus", () => {
  const bus = new aws_events.EventBus(stack, "bus");

  EventBus.fromBus(bus);
});

test("new bus without wrapper", () => {
  new EventBus(stack, "bus");
});

test("new rule without when", () => {
  const bus = new EventBus(stack, "bus");

  const rule = new EventBusRule(stack, "rule", bus, (_event) => true);

  expect(rule.rule._renderEventPattern()).toEqual({ source: [{ prefix: "" }] });
});

test("new transform without map", () => {
  const bus = new EventBus(stack, "bus");

  const rule = new EventBusRule(stack, "rule", bus, (_event) => true);
  const transform = new EventBusTransform((event) => event.source, rule);

  expect(transform.targetInput.bind(rule.rule)).toEqual({
    inputPath: "$.source",
  } as aws_events.RuleTargetInputProperties);
});

test("rule from existing rule", () => {
  const awsRule = new aws_events.Rule(stack, "rule");

  const rule = EventBusRule.fromRule(awsRule);
  const transform = new EventBusTransform((event) => event.source, rule);

  expect(transform.targetInput.bind(rule.rule)).toEqual({
    inputPath: "$.source",
  } as aws_events.RuleTargetInputProperties);
});

test("new bus with when", () => {
  const rule = new EventBus(stack, "bus").when(stack, "rule", () => true);

  expect(rule.rule._renderEventPattern()).toEqual({ source: [{ prefix: "" }] });
});

test("new bus with when pipe event bus", () => {
  const busBus = new EventBus(stack, "bus");

  const rule = busBus.when(stack, "rule", () => true);
  rule.pipe(busBus);

  expect((rule.rule as any).targets.length).toEqual(1);
  expect(
    (rule.rule as any).targets[0] as aws_events.IRuleTarget
  ).toHaveProperty("arn");
});

test("new bus with when map pipe function", () => {
  const busBus = new EventBus(stack, "bus");

  const func = new Function(
    aws_lambda.Function.fromFunctionArn(stack, "func", "")
  );

  const rule = busBus
    .when(stack, "rule", () => true)
    .map((event) => event.source);
  rule.pipe(func);

  expect(rule.targetInput.bind(rule.rule.rule)).toEqual({
    inputPath: "$.source",
  } as aws_events.RuleTargetInputProperties);
  expect((rule.rule.rule as any).targets.length).toEqual(1);
  expect(
    (rule.rule.rule as any).targets[0] as aws_events.IRuleTarget
  ).toHaveProperty("arn");
});

test("new bus with when map pipe function props", () => {
  const busBus = new EventBus(stack, "bus");

  const func = new Function(
    aws_lambda.Function.fromFunctionArn(stack, "func", "")
  );

  const rule = busBus
    .when(stack, "rule", () => true)
    .map((event) => event.source);
  rule.pipe({ func, retryAttempts: 10 });

  expect(rule.targetInput.bind(rule.rule.rule)).toEqual({
    inputPath: "$.source",
  } as aws_events.RuleTargetInputProperties);
  expect((rule.rule.rule as any).targets.length).toEqual(1);
  expect(
    (rule.rule.rule as any).targets[0] as aws_events.RuleTargetConfig
  ).toHaveProperty("arn");
  expect(
    ((rule.rule.rule as any).targets[0] as aws_events.RuleTargetConfig)
      .retryPolicy?.maximumRetryAttempts
  ).toEqual(10);
});
