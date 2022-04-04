# Getting Started

`functionless` makes configuring services like AWS Step Functions and Appsync as easy as writing TypeScript functions. To get started, you only need to wrap your Constructs with the Functionless type-safe extension classes, `Function` and `Table`, and then write your business logic with `AppsyncResolver`, `StepFunction` or `ExpressStepFunction`.

### Integration interfaces for `Function` and `Table`

You must wrap your CDK L2 Constructs in the corresponding wrapper class provided by functionless. Currently, Lambda `Function` and DynamoDB `Table` are supported.

**Function**

The `Function` wrapper annotates an `aws_lambda.Function` with a TypeScript function signature that controls how it can be called.

```ts
import { aws_lambda } from "aws-cdk-lib";
import { Function, StepFunction } from "functionless";

const myFunc = new Function<{ name: string }, string>(
  new aws_lambda.Function(this, "MyFunc", {
    ..
  })
);
```

Within an AppsyncResolver, the `myFunc` function is integrated with an ordinary function call.

```ts
new AppsyncResolver(() => {
  return myFunc({ name: "my name" });
});
```

Input to the Lambda Function is a JSON object, as should be expected.

```json
{
  "name": "my name"
}
```

In a `StepFunction`, calling the `myFunc` function configures an integration that returns only the `Payload`:

```ts
new StepFunction(this, "MyStepFunction", (name: string) => {
  return myFunc({ name });
});
```

To get the entire AWS SDK request, use `$AWS.Lambda.Invoke`:

```ts
new StepFunction(this, "MyStepFunction", (name: string) => {
  return $AWS.Lambda.Invoke({
    FunctionName: myFunc,
    Payload: {
      name,
    },
  });
});
```

**Table**

The `Table` wrapper annotates an `aws_dynamodb.Table` with a type-safe interface that describes the Table's data.

See [`typesafe-dynamodb`](https://github.com/sam-goodwin/typesafe-dynamodb) for more information on how to model DynamoDB Tables with TypeScript.

In short: you first declare an `interface` describing the data in your Table:

```ts
interface Item {
  key: string;
  data: number;
}
```

Then, wrap a `aws_dynamodb.Table` CDK Construct with the `functionless.Table` construct, specify the `Item` type, Partition Key `"id"` and (optionally) the Range Key.

```ts
import { aws_dynamodb } from "aws-cdk-lib";
import { Table } from "functionless";

// see https://github.com/sam-goodwin/typesafe-dynamodb for more information on type-safe DynamoDB Tables.
const myTable = new Table<Item, "key">(
  new aws_dynamodb.Table(this, "MyTable", {
    ..
  })
)
```

Finally, call `getItem`, `putItem`, etc. (see: [#3](https://github.com/sam-goodwin/functionless/issues/3)) from within an [AppsyncResolver](#AppsyncResolver):

```ts
new AppsyncResolver(() => {
  return myTable.get({
    key: $util.toDynamoDB("key"),
  });
});
```

For `StepFunction` and `ExpressStepFunction`, you must use the `$AWS.DynamoDB.*` APIs to interact with the table instead of the `Table`'s methods. This is because Step Functions doesn't marshall DynamoDB's JSON format on behalf of the caller. For this, use the `$AWS` APIs which are a one-to-one model of the [AWS SDK service integrations](https://docs.aws.amazon.com/step-functions/latest/dg/supported-services-awssdk.html).

```ts
new StepFunction() => {
  return $AWS.DynamoDB.GetItem({
    TableName: myTable,
    Key: {
      key: {
        S: "key"
      }
    }
  });
})
```

### `AppsyncResolver` construct for defining Appsync Resolver with TypeScript syntax

After wrapping your Functions/Tables, you can then instantiate an `AppsyncResolver` and interact with them using standard TypeScript syntax.

```ts
const getItem = new AppsyncResolver(
  ($context: AppsyncContext<{ key: string }>, key) => {
    const item = myTable.get({
      key: {
        S: key,
      },
    });

    const processedName = myFunc(item.key);

    return {
      ...item,
      processedName,
    };
  }
);
```

Calls to services such as Table or Function can only be performed at the top-level. See below for some examples of valid and invalid service calls

**Valid**:

```ts
// stash the result of the service call - the most common use-case
const item = myTable.get();

// calling the service but discarding the result is fine
myTable.get();
```

**Invalid**:

```ts
// you cannot in-line a call as the if condition, store it as a variable first
if (myTable.get()) {
}

if (condition) {
  // it is not currently possible to conditionally call a service, but this will be supported at a later time
  myTable.get();
}

for (const item in list) {
  // resolvers cannot be contained within a loop
  myTable.get();
}
```

### Add Resolvers to an `@aws-cdk/aws-appsync-alpha.GraphQLApi`

When you create a `new AppsyncResolver`, it does not immediately generate an Appsync Resolver. `AppsyncResolver` is more like a template for creating resolvers and can be re-used across more than one API.

To add to an API, use the `addResolver` utility on `AppsyncResolver`.

```ts
const app = new App();

const stack = new Stack(app, "stack");

const schema = new appsync.Schema({
  filePath: path.join(__dirname, "..", "schema.gql"),
});

const api = new appsync.GraphqlApi(stack, "Api", {
  name: "demo",
  schema,
  authorizationConfig: {
    defaultAuthorization: {
      authorizationType: appsync.AuthorizationType.IAM,
    },
  },
  xrayEnabled: true,
});

// create a template AppsyncResolver
const getPerson = new AppsyncResolver(..);

// use it add resolvers to a GraphqlApi.
getPerson.addResolver(api, {
  typeName: "Query",
  fieldName: "getPerson",
});
```
