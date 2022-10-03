---
sidebar_position: 3
---

# Supported Integrations

## Function

A `Function` can be called directly from an [`AppsyncResolver`](./usage.md).

```ts
const myFunc = new Function(scope, "id", (input: {name: string}) => { .. });

new AppsyncResolver(scope, id, props, () => {
  return myFunc({ name: "my name" });
});
```

The first argument is passed to the Lambda Function as the Payload.

```json
{
  "name": "my name"
}
```

## Step Function

A `StepFunction` can be called directly from an [`AppsyncResolver`](./usage.md#implement-a-resolver-for-a-field).

```ts
const myStepFunc = new StepFunction(scope, "id", (input: {name: string}) => { .. });

new AppsyncResolver(scope, id, props, () => {
  return myStepFunc({ name: "my name" });
});
```

The first argument is passed to the Step Function as the initial state.

```json
{
  "name": "my name"
}
```

### Standard Execution

Executing a `StepFunction` returns a handle to the asynchronously running execution. This is because a `StepFunction` is a [Standard Step Function](../step-function/index.md#standard-step-function) and runs asynchronously, potentially taking up to a year, so its result cannot be returned synchronously.

```ts
const execution = myStepFunc({ name: "my name" });
```

Get the status of the execution by calling `describeExecution`:

```ts
const status = myStepFunc.describeExecution(execution.executionArn);
```

The `response` may be in one of five states, `ABORTED`, `RUNNING`, `SUCCEEDED`, `FAILED` or `TIMED_OUT`. Use the `status` field to handle each state gracefully.

```ts
const execution = myStepFunc({ name: "sam" });

// describe the Step Function's execution
const response = myStepFunc.describeExecution(execution.executionArn);

// check the status
if (response.status === "RUNNING") {
  // the function is still running, do nothing
} else if (response.status === "SUCCEEDED") {
  // the output field is present when status is SUCCEEDED
  return response.output; // "hello sam";
} else if (
  response.status === "FAILED" ||
  response.status === "TIMED_OUT" ||
  response.status === "ABORTED"
) {
  // the error and cause fields are present when status is ABORTED, FAILED or TIMED_OUT
  if (response.error === "MY_ERROR") {
    // check for the case when the error code is a known error and handle gracefully
    throw new Error(response.cause);
  } else {
    throw new Error("generic error");
  }
}
```

### Express Execution

Executing an `ExpressStepFunction` returns the result synchronously.

```ts
const myExpressFunc = new ExpressStepFunction(
  scope,
  "id",
  (input: { name: string }) => {
    return `hello ${input.name}`;
  }
);

new AppsyncResolver(scope, id, props, async () => {
  const response = await myExpressFunc({ name: "my name" });
});
```

The `response` may be in one of three states, `SUCCEEDED`, `FAILED` or `TIMED_OUT`. Use the `status` field to handle each state gracefully.

```ts
const response = myExpressFunc({ name: "sam" });
if (response.status === "SUCCEEDED") {
  // the output field is present when status is SUCCEEDED
  return response.output; // "hello sam";
} else if (response.status === "FAILED" || response.status === "TIMED_OUT") {
  // the error and cause fields are present when status is FAILED or TIMED_OUT
  if (response.error === "MY_ERROR") {
    // check for the case when the error code is a known error and handle gracefully
    throw new Error(response.cause);
  } else {
    throw new Error("generic error");
  }
}
```

## Table

Each of the methods on the `Table` Construct map 1:1 to the [DynamoDB Resolvers](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html).

### Marshalling and Unmarshalling

AWS's DynamoDB Resolvers require all inputs to a request be marshalled into the [DynamoDB AttributeValue format](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html), e.g. `{S: "hello"}` instead of `"hello"`.

Use Appsync's `$util.dynamodb.toDynamoDB` to do the marshalling automatically.

```ts
$util.dynamodb.toDynamoDB($context.arguments.id);
```

The Response from DynamoDB, however, comes already un-marshalled, e.g. `"hello` instead of `{S: "hello"}`.

```ts
const item = table.geItem({..});
item.userId.S; // invalid
item.userId; // is already unmarshalled to a string
```

This is useful so that you don't have to do work to convert the AttributeValue format into the JSON format expected by GraphQL APIs.

### getItem

`appsync.getItem` gets a value from the database by its key and returns `undefined` if it does not exist.

It invokes `DynamoDB:GetItem` API using the [GetItem Appsync Resolver](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem).

```ts
new AppsyncResolver(async ($context: AppsyncContext<{ id: string }>) => {
  return table.appsync.getItem({
    key: {
      id: $util.dynamodb.toJson($context.arguments.id),
    },
  });
});
```

Specify `consistentRead: true` for a strongly consistent read (read-after-write semantics).

```ts
table.deleteItem({
  consistentRead: true,
  // ..
});
```

### putItem

`appsync.putItem` writes a value into the database and overwrites the existing value if one already exists.

It invokes `DynamoDB:PutItem` API using the [PutItem Appsync Resolver](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-putItem).

```ts
new AppsyncResolver(
  ($context: AppsyncContext<{ id: string; text: string }>) => {
    return table.appsync.putItem({
      key: {
        id: $util.dynamodb.toJson($context.arguments.id),
      },
      attributeValues: {
        text: $util.dynamodb.toJson($context.arguments.text),
      },
    });
  }
);
```

The `condition` property enables you to write [DynamoDB ConditionExpressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html) so that the item is only update if some condition is true.

```ts
table.appsync.putItem({
  key: {
    id: $util.dynamodb.toJson($context.arguments.id),
  },
  attributeValues: {
    text: $util.dynamodb.toJson($context.arguments.text),
  },
  condition: {
    expression: "attribute_not_exists(id) OR version = :expectedVersion",
    expressionValues: {
      ":expectedVersion": $util.dynamodb.toDynamoDB($expectedVersion),
    },
  },
});
```

### updateItem

`appsync.updateItem` updates a value in the database using an UpdateExpression. If no value already exists, then the expression runs against the empty value and may result in unexpected behavior or an error.

It invokes `DynamoDB:UpdateItem` API using the [UpdateItem Appsync Resolver](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-updateitem).

```ts
new AppsyncResolver(($context: AppsyncContext<{ id: string }>) => {
  return table.appsync.updateItem({
    key: {
      id: $util.dynamodb.toJson($context.arguments.id),
    },
    update: {
      expression: "ADD #votefield :plusOne, version :plusOne",
      expressionNames: {
        "#votefield": "upvotes",
      },
      expressionValues: {
        ":plusOne": { N: "1" },
      },
    },
  });
});
```

### deleteItem

It invokes `DynamoDB:DeleteItem` API using the [DeleteItem Appsync Resolver](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-deleteitem).

```ts
new AppsyncResolver(($context: AppsyncContext<{ id: string }>) => {
  return table.appsync.deleteItem({
    key: {
      id: $util.dynamodb.toJson($context.arguments.id),
    },
  });
});
```

The `condition` property enables you to write [DynamoDB ConditionExpressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html) so that the item is only deleted if some condition is true.

```ts
table.appsync.deleteItem({
  key: {
    id: $util.dynamodb.toJson($context.arguments.id),
  },
  condition: {
    expression: "attribute_not_exists(id) OR version = :expectedVersion",
    expressionValues: {
      ":expectedVersion": $util.dynamodb.toDynamoDB($expectedVersion),
    },
  },
});
```

### query

`query` efficiently queries records from the database using a [KeyConditionExpression](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.html#Query.KeyConditionExpressions).

It invokes `DynamoDB:Query` API using the [Query Appsync Resolver](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-query).

#### Key Condition Expression

The `query` property contains a KeyConditionExpression that will apply a condition on the PartitionKey and RangeKey of the table to efficiently find records.

```ts
new AppsyncResolver(($context: AppsyncContext<{ id: string }>) => {
  return table.appsync.query({
    query: {
      expression: "ownerId = :ownerId",
      expressionValues: {
        ":ownerId": $util.dynamodb.toJson($context.arguments.id),
      },
    },
  });
});
```

#### Filter Expression

The KeyConditionExpression is limited to only operating on the Partition and Range Key properties. To further filter the returned items from your query, use a FilterExpression.

```ts
table.appsync.query({
  filter: {
    expression: "Price > :p",
    expressionValues: {
      ":p": {
        N: "0",
      },
    },
  },
});
```

#### Pagination

To paginate through results, use the `nextToken` field.

```ts
table.appsync.query({
  nextToken: paginationToken,
});
```

This token is made available in the query's response payload.

```ts
const response = table.appsync.query(..);
response.nextToken;
```

**Not yet supported**: Querying an Index, see [#136](https://github.com/functionless/functionless/issues/136).
