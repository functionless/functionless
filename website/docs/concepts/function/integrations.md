---
sidebar_position: 1
---

# Integrations

Functionless supports integrations between some AWS services and Lambda Functions. Invoke a `Function` by calling the function, `pipe` from an [`EventBus`](../event-bridge/), or use the [`$AWS.Lambda.Invoke`] integration. Call other integrations within the Function's callback.

| Resource                   | From `Function` | To `Function` | To `Function`        | To `Function`   |
| -------------------------- | --------------- | ------------- | -------------------- | --------------- |
| _via_                      | callback        | function()    | `$AWS.Lambda.Invoke` | `EventBus.pipe` |
| Lambda                     | &#x2705;        | &#x2705;      |                      |                 |
| Step Functions             | &#x2705;        | &#x2705;      | &#x2705;             |                 |
| EventBus                   | &#x2705;        |               |                      | &#x2705;        |
| App Sync                   |                 | &#x2705;      |                      |                 |
| Table                      |                 |               |                      |                 |
| [$AWS.DynamoDB](../aws)    | &#x2705;        |               |                      |                 |
| [$AWS.Lambda](../aws)      |                 |               |                      |                 |
| [$AWS.EventBridge](../aws) | &#x2705;        |               |                      |                 |
| API Gateway                |                 | Coming Soon   | Coming Soon          |                 |

See [issues](https://github.com/functionless/functionless/issues?q=is%3Aissue+is%3Aopen+label%3Alambda) for progress or create a new issue in the form `Function + [Service]`.

## Call an Integration

Most of Functionless's [integrations](../integration/) can be called from within a Lambda Function. Functionless will automatically infer the required IAM Policies, set any environment variables it needs (such as the ARN of a dependency) and instantiate any SDK clients when the Function is first invoked.

```ts
const Table = new Table(scope, "Table");

new Function(scope, "foo", async (id: string) => {
  return $AWS.DynamoDB.GetItem({
    Table: table,
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
