# Function

`Function` is the cloud's swiss army knife - an AWS Lambda Function. Functionless serializes in-line Function closures, automatically configures IAM Policies, Environment Variables, and initializes SDK clients (such as the AWS SDK) at runtime.

## Declare a Function

To create a new `Function`, simply instantiate the Construct and provide an implementation.

```ts
new Function(scope, "foo", async () => {
  console.log("hello, world");
});
```

Functionless is all about embedding the business logic within the infrastructure logic, so instead of referencing an external file containing the function implementation, it can be provided in-line as if it were an ordinary function.

## Configure Properties

To configure its properties, such as memory, timeout, runtime, etc. specify an object as the third argument:

```ts
new Function(
  scope,
  "F",
  {
    memory: 512,
    timeout: Duration.minutes(1),
    runtime: aws_lambda.Runtime.NODE_JS_16,
  },
  async () => {
    console.log("hello, world");
  }
);
```

## Wrap an existing Function

There are cases in which you want to integrate with an existing Lambda Function - perhaps you need to use a different runtime than NodeJS or you have existing Functions that you want to call from Functionless.

To achieve this, use the `Function.from` utility to wrap an existing `aws_lambda.Function`.

```ts
import { aws_lambda } from "aws-cdk-lib";
import { Function, StepFunction } from "functionless";

const myFunc = Function.from<{ name: string }, string>(
  new aws_lambda.Function(this, "MyFunc", {
    ..
  })
);
```

A wrapped function annotates the type signature of the Function and makes it available to be called from Functionless Constructs.

## Request Payload

The callback ([`FunctionClosure`](../../api/modules.md#functionclosure)) matches the interface supported by a [NodeJS Lambda function handler](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html).

Your Function must have 0, 1, or 2 arguments. The first argument contains the JSON data from the Invoke Lambda API Request payload. The second parameter is the [Lambda Context Object](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html).

```ts
// valid
async (arg: string) => {};

// valid
async () => {};

// valid
async (arg: string, context: Context) => {};
```

For example, if you have a Function accepting input of `{key: string}`:

```ts
async (input: { key: string }) => {};
```

It can be invoked with the following JSON data:

```json
{
  "key": "value"
}
```

Any valid JSON value type (not just objects) is supported - for example, a `string`, `number`, `boolean` or `null`:

```ts
async (input: string | number | boolean | null | string[]) => {};
```

This function can accept any of the the following input JSON payload:

```json
null
true
false
123
123.456
"hello world"
["hello world"]
```

_Note the surrounding double-quotes (`"`) for strings._

## Response Payload

The data returned from teh Function is serialized to JSON as the response payload.

```ts
() => ({
  key: "value",
});
```

This function results in the following JSON response payload:

```json
{
  "key": "value"
}
```

Functions can be both synchronous or asynchronous. If a Promise is returned, then the result of the asynchronous execution (value contained within the Promise) is returned as the Response.

```ts
// use async/await
async () => ({
  key: "value",
});

// or the Promise API
() =>
  Promise.resolve({
    key: "value",
  });
```

These two functions are equivalent and result in the same JSON response:

```json
{
  "key": "value"
}
```

## Call an Integration

Most of Functionless's [integrations](../integration) can be called from within a Lambda Function. Functionless will automatically infer the required IAM Policies, set any environment variables it needs (such as the ARN of a dependency) and instantiate any SDK clients when the Function is first invoked.

```ts
const Table = Table.fromTable(scope, "Table");

new Function(scope, "foo", async (id: string) => {
  return $AWS.DynamoDB.GetItem({
    TableName: table,
    Key: {
      id: {
        S: id,
      },
    },
  });
});
```

This Function infers the following configuration and runtime code boilerplate from the function's implementation:

1. an IAM Policy Statement allowing `GetItem` on the `Table`

```json
{
  "Action": ["dynamodb:GetItem"],
  "Effect": "Allow",
  "Resource": "arn:aws:dynamodb:<region>:<account-ud>:table/Table"
}
```

2. an Environment Variable making the ARN of the DynamoDB `Table` available at runtime

```json
{
  "EnvironmentVariables": {
    "Ref": "Table"
  }
}
```

3. when your Lambda Function calls `$AWS.DynamoDB.GetItem`, underneath a client is being instantiated (once per container) and used for the request. This saves your from worrying about boilerplate plumbing code.

```ts
new AWS.DynamoDB();
```

:::warn
[Cannot use Infrastructure resource in `Function` closure (107)](../../error-codes.md#cannot-use-infrastructure-resource-in-function-closure).

`.resource` (`Function`, `StepFunction`, `Table`, `EventBus`) may not be used within a `Function`.

```ts
const table = new Table(this, 'table', { ... });
new Function(this, 'func', async () => {
   // valid use of a Table
   const $AWS.DynamoDB.GetItem({
       TableName: table,
       ...
   })
   // invalid - .resource is not available
   const index = table.resource.tableStreamArn;
});
```

See [error](../../error-codes.md#cannot-use-infrastructure-resource-in-function-closure) for details and workarounds.
:::

## Call from an Integration

Lambda Functions can be called directly from any of Functionless's primitives, for example AppsyncResolvers, Step Functions and Lambda Functions.

```ts
await myFunc({ name: "sam" });
```

Input to the Lambda Function is a JSON object, as should be expected.

```json
{
  "name": "sam"
}
```

Output from the Lambda Function is the raw JSON value returned by the Lambda Function, for example:

```json
"hello sam"
```

:::info
For a list of all `Function` integrations and more integration options, see [Integrations](./integrations.md).
:::

## Call and receive the entire API Response Envelope

To get the entire AWS SDK response, use `$AWS.Lambda.Invoke`:

```ts
const response = $AWS.Lambda.Invoke({
  FunctionName: myFunc,
  Payload: {
    name,
  },
});
```

## Forward Events from an EventBus to a Lambda Function

Finally, you can route Events from an [Event Bus](../event-bridge/event-bus.md) to a Lambda Function, provided the Function's signature is compatible.

```ts
bus
  .when(..)
  .pipe(myFunc)
```

## Closure Serialization

Functionless leverages [Pulumi's closure serializer](https://www.pulumi.com/docs/intro/concepts/function-serialization/) to serialize your function into a bundle that can be ran within the AWS Lambda Function.

The serializer captures all of your closure's state.

1. referenced variables outside the function body

```ts
const variable = "hello";

new Function(scope, "foo", () => {
  // variable is captured and serialized into the bundle
  return variable;
});
```

2. calls to Constructs such as other Functions or a DynamoDB Table are re-written as client API calls

```ts
const table = Table.fromTable(..)

new Function(scope, "foo", (key: string) => {
  // re-written as a call to an AWS.DynamoDB.GetItem API call
  return table.getItem({
    key
  });
});
```

3. imported dependencies are included in the bundle as is, similarly to how esbuild performs bundling

```ts
import { v4 } from "uuid";

new Function(scope, "foo", () => {
  // v4 will be tree-shaken and included in your bundle
  return v4();
});
```

## Performance Considerations

You can write arbitrary code from within the Lambda Function but be aware that the function's body will run on EVERY invocation, so you should avoid writing expensive one-off computations inside.

For example, loading a static file into memory should probably not be done within the function body.

```ts
new Function(scope, "foo", async () => {
  const allowList = await fs.promises.readFile("allow-list.json");
});
```

Instead, move expensive initialization code outside of the closure.

```ts
const allowList = await fs.promises.readFile("allow-list.json");

new Function(scope, "foo", async () => {
  // reference the allowList here instead
});
```

**Warning**: By moving the value outside of the closure, the `allowList` value will be serialized as JSON into the bundle. This can also affect your performance by bloating the size of the bundle.

**Warning**: The `allow-list.json` file will not be automatically included in your bundle. See [#135](https://github.com/functionless/functionless/issues/135)

## Async Invocation

Lambda [Async Invocation](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html) allows a `Function` to be invoked from services that cannot handle the `Function`'s response. For example, a `Function` invoked by an [EventBus](../event-bridge) or by a SNS topic.

```ts
const bus = new EventBus<Event<string>>(stack, "bus");
const func = new Function<Event<string>, string>(stack, "asyncFunc", () => {
  return "hi";
});
// all events on the bus are piped to the function asynchronously.
bus.all().pipe(func);
```

A common need to is to handle success or failure events from async invocations. Lambda supports sending `onSuccess` and `onFailure` events to [Destinations](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html#invocation-async-destinations) (Event Bridge, SNS, Lambda, SQS). Functionless makes this easier by allowing `EventBus`es or `Functions` to be provided directly as `Destinations`.

```ts
const failureBus = new EventBus<AsyncResponseFailureEvent<void>>(
  stack,
  "failureBus"
);
const successFunction = new Function<AsyncResponseSuccess<void, string>>(
  stack,
  "successFunction",
  async () => {
    console.log("yay");
  }
);
const func = new Function<void, string>(
  stack,
  "asyncFunc",
  {
    // success function will be invoked on each success
    onSuccess: successFunction,
    // failure bus will get an event for each failure on the bus
    onFailure: failureBus,
  },
  async () => {
    return "hi";
  }
);
```

When working with `EventBus` destinations, Functionless provides [Event Sources](./event-sources) to easily consume and filter events generated by the `Function`.

```ts
const failureBus = new EventBus<AsyncResponseFailureEvent<void>>(
  stack,
  "failureBus"
);
const func = new Function<void, string>(
  stack,
  "asyncFunc",
  {
    // failure bus will get an event for each failure on the bus
    onFailure: failureBus,
  },
  async () => {
    return "hi";
  }
);
func
  // for all failure events
  .onFailure(failureBus, "failures")
  // refine to just failure events caused by RetriesExhausted
  .when((event) => event.detail.requestContext.condition === "RetriesExhausted")
  // send to another function (or any EventBus integration)
  .pipe(
    new Function(stack, "retryOnlyFunction", async () =>
      console.log("not enough retries!")
    )
  );
```

## Limitations

The bundler does not detect references to static files and include them by default.

See: [#135](https://github.com/functionless/functionless/issues/135)

```ts
let _allowList;
const loadAllowList = async () => {
  return (_allowList =
    _allowList ?? (await fs.promises.readFile("allow-list.json")));
};

new Function(scope, "foo", async () => {
  // reference the allowList here instead
  const list = await loadAllowList();
});
```
