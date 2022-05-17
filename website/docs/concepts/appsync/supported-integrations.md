---
sidebar_position: 1.1
---

# Supported Integrations

## Function

A `Function` can be called directly from an AppsyncResolver.

```ts
new AppsyncResolver(() => {
  return myFunc({ name: "my name" });
});
```

The first argument is passed to the Lambda Function as the Payload.

```json
{
  "name": "my name"
}
```

## Table

Each of the methods on the `Table` Construct map 1:1 to the [DynamoDB Resolvers](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html).

### Marshalling and Unmarshalling

AWS's DynamoDB Resolvers require all inputs to a request be marshalled into the [DynamoDB AttributeValue format](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html), e.g. `{S: "hello"}` instead of `"hello"`.

Use Appsync's `$util` to do the marshalling automatically.

```ts
$util.dynamodb.toJson($context.arguments.id);
```

The Response from DynamoDB, however, comes already un-marshalled, e.g. `"hello` instead of `{S: "hello"}`.

```ts
const item = table.geItem({..});
item.userId.S; // invalid
item.userId; // is already unmarshalled to a string
```

This is useful so that you don't have to do work to convert the AttributeValue format into the JSON format expected by GraphQL APIs.

### getItem

`getItem` gets a value from the database by its key and returns `undefined` if it does not exist.

It invokes `DynamoDB:GetItem` API using the [GetItem Appsync Resolver](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem).

```ts
new AppsyncResolver(($context: AppsyncContext<{ id: string }>) => {
  return table.getItem({
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

`putItem` writes a value into the database and overwrites the existing value if one already exists.

It invokes `DynamoDB:PutItem` API using the [PutItem Appsync Resolver](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-putItem).

### updateItem

`updateItem` updates a value in the database using an UpdateExpression. If no value already exists, then the expression runs against the empty value and may result in unexpected behavior or an error.

It invokes `DynamoDB:UpdateItem` API using the [UpdateItem Appsync Resolver](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-updateitem).

### deleteItem

It invokes `DynamoDB:DeleteItem` API using the [DeleteItem Appsync Resolver](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-deleteitem).

```ts
new AppsyncResolver(($context: AppsyncContext<{ id: string }>) => {
  return table.deleteItem({
    key: {
      id: $util.dynamodb.toJson($context.arguments.id),
    },
  });
});
```

The `condition` property enables you to write [DynamoDB ConditionExpressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html) so that the item is only deleted if some condition is true.

```ts
table.deleteItem({
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

### Query

`query` efficiently queries records from the database using a [KeyConditionExpression](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.html#Query.KeyConditionExpressions).

It invokes `DynamoDB:Query` API using the [Query Appsync Resolver](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-query).

#### Key Condition Expression

The `query` property contains a KeyConditionExpression that will apply a condition on the PartitionKey and RangeKey of the table to efficiently find records.

```ts
new AppsyncResolver(($context: AppsyncContext<{ id: string }>) => {
  return table.query({
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
table.query({
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
table.query({
  nextToken: paginationToken,
});
```

This token is made available in the query's response payload.

```ts
const response = table.query(..);
response.nextToken;
```

**\*Not yet supported**: Querying an Index, see [#136](https://github.com/sam-goodwin/functionless/issues/136).
