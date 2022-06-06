---
label: Implement Integrations
sidebar_position: 1
---

# Implement and Extend Integrations

[Integrations](../../concepts/integration/) are objects or function which can be used within a Resource. Here we will talk about making new integrations with other Resources/[Integration Types](../integration-types.md).

Goal: make an object or method/function callable from within a Resource. Here is an example with Lambda we want to pass.

```ts
const table = new Table<{ id: string; name: string }, "id">(stack, "table");

// Read from dynamo, but always only return a subset of fields.
const reader = new PartialItemReader(table, ["name"]);

const func = new Function(stack, "func", async () => {
  // calling the reader with a key should return an item that only contains the fields in the PartialItemReader instance.
  const item = reader({ id: { S: "someId" } });

  // calling the reader's query method performs a query instead of a get, with the fields from the PartialItemReader instance.
  const queryResults = reader.query({
    KeyConditionExpression: "id = :id",
    ExpressionAttributeNames: {
      id: "someId",
    },
  });
});
```

## Object Integration

### 1) Create class if it doesn't exist

```ts
export class PartialItemReader {}
```

### 2) Implement the `Integration` interface

```ts
export class PartialItemReader<I extends Item, T extends Table<I>>
  implements Interface<"PartialItemReader", (id: string) => I | undefined>
{
  readonly kind = "PartialItemReader";

  // @ts-ignore
  readonly __functionBrand: (arg: CallIn) => CallOut;
}
```

- `kind` is a compile time visible key that can be used to determine what is an Integration.
- `__functionBrand` tells the compiler that this class/interface uses the function interface. If left off, type checking may fail.

### 3) Implement the [Integration Type(s)](../integration-types.md) desired

In our case, we want to implement the `native` Integration Type in order for `Function` to use our integration (`PartialItemReader`).

:::caution
Much of the below example are specific to the [NativeIntegration](../../api/interfaces/NativeIntegration.md) [Integration Type](../integration-types.md) for [`Function`](../../concepts/function/). For details on other types, see [Integration Type](../integration-types.md).
:::

```ts
export class PartialItemReader<I extends Item, PartitionKey extends keyof I, T extends Table<I, PartitionKey>>
  implements Interface<"PartialItemReader", (key: Key) => I | undefined> {
    ...

    native: NativeIntegration<(id: string) => I | undefined>

    constructor(private table: T, private fields: string[]) {
      this.native = NativeIntegration<(id: string) => I | undefined>{
        // NativeIntegration uses bind to wire up infrastructure like grantingPermissions
        bind: (context: Function<any, any>) => {
          // this integration needs to grant read on the table to the current function
          this.table.grantRead(context.resource);
        },
        // prewarm runs once per lambda instance
        preWarm: (preWarmContext: NativePreWarmContext) => {
          // make sure the dynamo client is initialized
          preWarmContext.getOrInit(PrewarmClients.DYNAMO);
        },
        call: async (args, prewarmClient) => {
          // get our dynamo client from before
          const dynamo = preWarmContext.getOrInit(PrewarmClients.DYNAMO);
          return dynamo.getItem({
            Key: args[0], // should be the key
            AttributesToGet: this.fields // only return the attributes defined by the PartialItemReader instance
          });
        }
      }
    }
  }
```

## Method/Function Integration

A function or method integration is one which the integration is a named method or function on another object or namespace.

These are very similar to a [Object Integration](#object-integration), but can use a helper to create the integration instead of an interface.

In our example we'll extend the `PartialItemReader` from above to have a `query` method integration.

```ts
export class PartialItemReader<
  I extends Item,
  PartitionKey extends keyof I,
  T extends Table<I, PartitionKey>
> {
  // define the
  readonly query: IntegrationCall<
    "PartialItemReader.query",
    (query: {
      KeyConditionExpression: string;
      ExpressionAttributeNames?: Record<string, string>;
    }) => QueryResult
  >;

  constructor(public table: Table<T>, private fields: string[]) {
    this.query = makeIntegration<
      "PartialItemReader.query",
      (query: {
        KeyConditionExpression: string;
        ExpressionAttributeNames?: Record<string, string>;
      }) => QueryResult
    >({
      kind: "PartialItemReader.query",
      native: {
        bind: (context: Function<any, any>) => {
          this.table.grantRead(context.resource);
        },
        // prewarm runs once per lambda instance
        preWarm: (preWarmContext: NativePreWarmContext) => {
          // make sure the dynamo client is initialized
          preWarmContext.getOrInit(PrewarmClients.DYNAMO);
        },
        call: async (args, prewarmClient) => {
          // get our dynamo client from before
          const dynamo = preWarmContext.getOrInit(PrewarmClients.DYNAMO);
          return dynamo.query({
            ...args[0], // key expression and expression attributes
            AttributesToGet: this.fields, // only return the attributes defined by the PartialItemReader instance
          });
        },
      },
    });
  }
}
```

## Extending Integrations

Any integration may implement a subset of all [Integration Types](../integration-types.md). The best user experience is for an Integration to support as many Integration Types as possible.

Extending an Integration to support additional integration types is the same as implementing the first integration.

Lets add `StepFunctions` support to our `PartialItemReader` from [here](#3-implement-the-integration-typesintegration-typesmd-desired).

```ts
const table = new Table<{ id: string; name: string }, "id">(stack, "table");

// Read from dynamo, but always only return a subset of fields.
const reader = new PartialItemReader(table, ["name"]);

const sfn = new StepFunction(stack, "sfn", () => {
  const item = reader({
    id: { S: "someID" },
  });
});
```

```ts
export class PartialItemReader<I extends Item, PartitionKey extends keyof I, T extends Table<I, PartitionKey>>
  implements Interface<"PartialItemReader", (key: Key) => I | undefined> {
    native: NativeIntegration<(id: string) => I | undefined>;

    constructor(private table: T, private fields: string[]) {
      this.native = NativeIntegration<(id: string) => I | undefined>{ /** native code from above **/ };
    }

    public asl(call: CallExpr, context: ASL) {
      const key = call.getArgument("key")?.expr;
      if (!isObjectLiteralExpr(key)) {
        throw new Error(
          `key parameter must be an ObjectLiteralExpr, but was ${key?.kind}`
        );
      }

      table.resource.grantReadData(context.role);

      return {
        Type: "Task",
        Resource: `arn:aws:states:::aws-sdk:dynamodb:${operationName}`,
        Parameters: {
          TableName: this.table.tableName,
          Key: ASL.toJson(key),
          AttributesToGet: this.fields
        },
      };
    }
  }
```
