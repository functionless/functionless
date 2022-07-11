import { GraphqlApi } from "@aws-cdk/aws-appsync-alpha";
import { App, aws_events, Stack } from "aws-cdk-lib";
import { AttributeType } from "aws-cdk-lib/aws-dynamodb";
import {
  EventBridgeDestination,
  LambdaDestination,
} from "aws-cdk-lib/aws-lambda-destinations";
import {
  $AWS,
  AppsyncResolver,
  EventBus,
  Function,
  StepFunction,
  Table,
} from "../../src";

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
const table = new Table<{ id: string }, "id">(stack, "table", {
  partitionKey: {
    name: "id",
    type: AttributeType.STRING,
  },
});

new Function(stack, "event bus bus", async () => {
  bus.resource.eventBusArn;
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

// valid case
new Function(
  stack,
  "table resource",
  { onSuccess: new EventBridgeDestination(bus.resource) },
  async () => {
    return "";
  }
);

// valid case
new Function(
  stack,
  "table resource",
  {
    onSuccess: new LambdaDestination(
      new Function(stack, "nestedFunc", async () => {}).resource
    ),
  },
  async () => {
    return "";
  }
);

// invalid, nested
new Function(
  stack,
  "table resource",
  {
    onSuccess: new LambdaDestination(
      new Function(stack, "nestedFunc", async () => {
        return bus.resource;
      }).resource
    ),
  },
  async () => {
    return "";
  }
);

// unsupported - new resources in closure

new Function(stack, "new step function", async () => {
  new StepFunction(stack, "", () => {});
});

new Function(stack, "new function", async () => {
  new Function(stack, "", async () => {});
});

new Function(stack, "new bus", async () => {
  new EventBus(stack, "");
});

new Function(stack, "new resolver", async () => {
  new AppsyncResolver(
    stack,
    "",
    {
      api: new GraphqlApi(stack, "", { name: "api" }),
      typeName: "type",
      fieldName: "field",
    },
    () => {}
  );
});

new Function(stack, "cdk resource", async () => {
  new aws_events.EventBus(stack, "");
});

// unsupported object references in $AWS calls

new Function(stack, "obj ref", async () => {
  const event = {
    Table: table,
    Key: {
      id: { S: "sas" },
    },
  };

  await $AWS.DynamoDB.GetItem(event);
});

// supported - object literal in $AWS calls

new Function(stack, "obj ref", async () => {
  await $AWS.DynamoDB.GetItem({
    Table: table,
    Key: {
      id: { S: "sas" },
    },
  });
});

// unsupported - cannot find reference to integration outside of scope.

new Function(stack, "obj ref", async () => {
  const getIntegration = (): typeof func => {
    return func;
  };
  const x = getIntegration();
  await x("");
});
