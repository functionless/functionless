import {
  App,
  aws_apigateway,
  aws_dynamodb,
  aws_events,
  Stack,
} from "aws-cdk-lib";
import { AwsMethod, EventBus, Function, StepFunction, Table } from "../../src";

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
    table.attributes.get({
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
    return table.attributes.get({
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
    table.attributes.get({
      Key: {
        id: {
          S: $input.params("id") as string,
        },
      },
    }),
  ($input) => {
    // this is not allowed
    return table.attributes.get({
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
      Key: {
        id: { S: "sas" },
      },
    };

    await table.attributes.get(event);
  },
  () => {
    return "";
  }
);

// supported - object literal in $AWS calls

new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    await table.attributes.get({
      Key: {
        id: { S: "sas" },
      },
    });
  },
  () => {
    return "";
  }
);

// unsupported - cannot find reference to integration outside of scope.

new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    const getIntegration = (): typeof func => {
      return func;
    };
    const x = getIntegration();
    await x("");
  },
  () => {
    return "";
  }
);

/**
 * Unsupported
 * @see ErrorCodes.ApiGateway_Unsupported_Reference
 */

const a = "x";
new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    await table.attributes.get({
      Key: {
        id: { S: a },
      },
    });
  },
  () => {
    return "";
  }
);

new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    return table.attributes.get({
      Key: {
        id: { S: "sas" },
      },
    });
  },
  () => {
    return a;
  }
);

/**
 * Supported - Number reference
 */
new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    const a = Number("1");
    await table.attributes.get({
      Key: {
        id: { S: `${a}` },
      },
    });
  },
  () => {
    return "";
  }
);

/**
 * Unsupported - putEvents with references
 */

const bus = new EventBus(stack, "");

new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    const x = { "detail-type": "", source: "", detail: {} };
    return bus.putEvents(x);
  },
  () => {}
);

/**
 * Supported - putEvents with object literal
 */

new AwsMethod(
  { httpMethod: "ANY", resource: api.root },
  async () => {
    return bus.putEvents({ "detail-type": "", source: "", detail: {} });
  },
  () => {}
);
