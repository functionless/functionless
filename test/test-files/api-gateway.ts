import {
  App,
  aws_apigateway,
  aws_dynamodb,
  aws_events,
  Stack,
} from "aws-cdk-lib";
import {
  $AWS,
  AwsMethod,
  EventBus,
  Function,
  StepFunction,
  Table,
} from "../../src";

const app = new App({
  autoSynth: false,
});
const stack = new Stack(app, "stack");

const func = new Function(stack, "func", async () => {
  return "hello";
});

interface Item {
  id: string;
  name: string;
}
const table = new Table<Item, "id">(stack, "table", {
  partitionKey: {
    name: "id",
    type: aws_dynamodb.AttributeType.NUMBER,
  },
});

const api = new aws_apigateway.RestApi(stack, "API");

// VALID
new AwsMethod(
  {
    httpMethod: "GET",
    resource: api.root,
  },
  ($input) => {
    return func($input.data);
  },
  ($input) => $input.data
);

// VALID
new AwsMethod(
  {
    httpMethod: "GET",
    resource: api.root,
  },
  ($input) =>
    $AWS.DynamoDB.GetItem({
      Table: table,
      Key: {
        id: {
          S: $input.params("id") as string,
        },
      },
    }),
  ($input) => $input.data
);

// INVALID - missing integration call in request
new AwsMethod(
  {
    httpMethod: "GET",
    resource: api.root,
  },
  ($input) => {
    return $input.data;
  },
  ($input) => $input.data
);

// INVALID - uses a spread and computed property name
new AwsMethod(
  {
    httpMethod: "GET",
    resource: api.root,
  },
  ($input) => {
    return $AWS.DynamoDB.GetItem({
      Table: table,
      ...$input.data,
      [$input.params("param")]: null,
    });
  },
  ($input) => $input.data
);

// INVALID - calls an integration from within a response
new AwsMethod(
  {
    httpMethod: "GET",
    resource: api.root,
  },
  ($input) =>
    $AWS.DynamoDB.GetItem({
      Table: table,
      Key: {
        id: {
          S: $input.params("id") as string,
        },
      },
    }),
  ($input) => {
    // this is not allowed
    return $AWS.DynamoDB.GetItem({
      Table: table,
      Key: {
        id: {
          S: $input.params("id") as string,
        },
      },
    });
  }
);

// unsupported - new resources in closure

new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    const sfn = new StepFunction(stack, "", () => {});
    return sfn({});
  },
  () => {
    new StepFunction(stack, "", () => {});
  }
);

new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    const func = new Function<undefined, void>(stack, "", async () => {});
    return func();
  },
  () => {
    new Function(stack, "", async () => {});
  }
);

new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    const bus = new EventBus(stack, "");
    return bus.putEvents({ "detail-type": "", source: "", detail: {} });
  },
  () => {
    new EventBus(stack, "");
  }
);

new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    new aws_events.EventBus(stack, "");
    return func(null);
  },
  () => {
    new aws_events.EventBus(stack, "");
  }
);

// unsupported object references in $AWS calls

new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    const event = {
      Table: table,
      Key: {
        id: { S: "sas" },
      },
    };

    await $AWS.DynamoDB.GetItem(event);
  },
  () => {
    return "";
  }
);

// supported - object literal in $AWS calls

new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    await $AWS.DynamoDB.GetItem({
      Table: table,
      Key: {
        id: { S: "sas" },
      },
    });
  },
  () => {
    return "";
  }
);
