import { App, Stack } from "aws-cdk-lib";
import { AttributeType } from "aws-cdk-lib/aws-dynamodb";
import { EventBus, Function, StepFunction, Table } from "../../src";

const app = new App({
  autoSynth: false,
});
const stack = new Stack(app, "stack");

const bus = new EventBus(stack, "bus");
const sfn = new StepFunction(stack, "sfn", () => {
  return "hi";
});
const func = new Function(stack, "validfunc", async () => {
  return "hi";
});
const table = new Table<{ id: "string" }, "id">(stack, "table", {
  partitionKey: {
    name: "id",
    type: AttributeType.STRING,
  },
});

new Function(stack, "event bus bus", async () => {
  bus.bus.eventBusArn;
});

new Function(stack, "sfn resource", async () => {
  sfn.resource.stateMachineArn;
});

new Function(stack, "func resource", async () => {
  func.resource;
});

new Function(stack, "table resource", async () => {
  table.resource;
});
