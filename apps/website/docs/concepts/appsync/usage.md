---
sidebar_position: 1
---

# Usage

Creating a GraphQL API with Functionless involves configuring a GraphQL Schema and implementing Resolvers for each of the Type's Fields in your schema.

## AWS Appsync Alpha

Functionless builds on top of the [`@aws-cdk/aws-appsync-alpha`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-appsync-alpha-readme.html) Construct library to build GraphQL APIs. The implementation of Resolvers are simplified with the `AppsyncResolver` Construct that derives the VTL templates, IAM Policies, Data Sources and Resolvers from a TypeScript function. The rest of the configuration is delegated to the underlying library.

## Create a GraphQL API

An Appsync GraphQL endpoint is created by instantiating the `GraphQLApi` Construct from AWS Appsync Alpha.

```ts
import * as appsync from "@aws-cdk/aws-appsync-alpha";

const api = new appsync.GraphqlApi(stack, "Api", {
  name: "demo",
});
```

It can be configured with properties such as authorization and xray.

```ts
const api = new appsync.GraphqlApi(stack, "Api", {
  name: "demo",
  authorizationConfig: {
    defaultAuthorization: {
      authorizationType: appsync.AuthorizationType.IAM,
    },
  },
  xrayEnabled: true,
});
```

Refer to the [official documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-appsync-alpha-readme.html) for more information.

## Schema

Define the GraphQL Schema for a GraphQLApi with one of two methods: 1) load it from the file system, or 2) create it programmatically in code.

### Load a GraphQL Schema

A GraphQL schema can be loaded from the file system with an instance of the `Schema` class.

```ts
const schema = new appsync.Schema({
  filePath: path.join(__dirname, "..", "schema.gql"),
});
```

To use this as the API's schema, pass it as a property when instantiating `GraphQLApi`.

```ts
const api = new appsync.GraphqlApi(stack, "Api", {
  name: "demo",
  schema,
});
```

See the [reference documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-appsync-alpha-readme.html#schema-first) for more information.

### Create a GraphQL Schema with code

GraphQL schemas can be created programmatically with code using the AWS Appsync Alpha library.

```ts
const Person = api.addType(
  appsync.ObjectType("Person", {
    definition: {
      name: appsync.GraphqlType.string(),
    },
  })
);

api.addQuery(
  "getPerson",
  new appsync.Field({
    returnType: Person,
    args: {
      id: appsync.GraphqlType.string(),
    },
  })
);
```

See the [reference documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-appsync-alpha-readme.html#code-first-schema) for more information.

## Implement a Resolver for a Field

After configuring your schema, the next step is to implement Resolvers for each of the type's fields in the schema.

### AppsyncResolver

Functionless's `AppsyncResolver` Construct makes this simple by generating all of the VTL templates, IAM Policies and Resolver configurations from an ordinary TypeScript function.

```ts
new AppsyncResolver(
  scope,
  id,
  {
    api,
    typeName: "Query",
    fieldName: "getItem",
  },
  ($context) => {
    return table.get({
      id: $context.arguments.id,
    });
  }
);
```

### Type Arguments

An `AppsyncResolver` has three type arguments - `TArgs`, `TResult` and `TSource`:

- `TArgs` is an object representing the arguments of the GraphQL field.
- `TResult` is the type of resolved data
- `TSource` is an optional type argument representing the parent type of the field currently being resolved.

For example, say we have the following GraphQL schema:

```graphql
type Query {
  getPerson(id: ID!): Person
}
```

We can define an `AppsyncResolver` for the `getPerson` field like so:

```ts
new AppsyncResolver<{ id: string }, Person | undefined, undefined>(
  scope,
  id,
  props,
  ($context) => {
    // ..
  }
);
```

Here, `TArgs` is `{id: string}`, `TResult` is `Person | undefined` and `TSource` is `undefined`.

The default of `TSource` is `undefined` so we can omit it in this case.

```ts
new AppsyncResolver<{ id: string }, Person | undefined>(($context) => {
  // ..
});
```

### Nested Resolvers and TSource

`TSource` is only defined when the field being resolved is nested. For example, resolving a `Person`'s `children` field has a `TSource` of `Person`.

```ts
new AppsyncResolver<undefined, Person[], Person>(
  scope,
  id,
  props,
  async ($context) => {
    const result = await db.query({
      key: {
        personId: {
          // access the parent's personId
          S: $context.source.personId,
        },
      },
    });
    return result.Items;
  }
);
```

The following GraphQL query will now trigger this Resolver to fetch the `children` property.

```graphql
query {
  getPerson(id: "personId") {
    # resolve the Person's children by invoking the nested Resolver
    children
  }
}
```

### Add a field resolver to a GraphQL Api using CDK's CodeFirst schema

To add to a CodeFirst GraphQL schema, use `getField` utility on the `AppsyncResolver`.

```ts
import * as appsync from "@aws-cdk/aws-appsync-alpha";

const getPerson = new AppsyncField({
  api,
  returnType: appsync.Field.string(),
  args: {
    argName: appsync.Field.string()
  }
}, ($context) => {
  return table.appsync.getItem({
    key: {
      id: {
        S: $context.arguments.id
      }
    }
  })
});

// define the type in code
const personType = api.addType(appsync.ObjectType(...));

// use it add resolvers to a GraphqlApi.
api.addQuery("getPerson", getPerson);
```

## $util

The `$util` object contains Appsync's intrinsic functions.

For example, it provides intrinsic functions for generating UUIDs, working with timestamps and transforming data from AWS DynamoDB.

```ts
new AppsyncResolver(scope, id, props, () => {
  // generate a unique UUID at runtime
  const uuid = $util.autoUuid();
  // get the current timestamp in ISO 8601 format
  const now = $util.time.nowISO8601();
  // convert the string timestamp to a DynamoDB Attribute Value
  const attribute = $util.dynamodb.toDynamoDB(now);
});
```

For a full list of all available utility functions, see the [API reference documentation for $util](../../api/aws-appsync-constructs/interfaces/util.md) and [AWS's Resolver mapping template utility reference](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference.html).

**Warning**: not all of the utilities have been implemented. You can track progress here [#61](https://github.com/functionless/functionless/issues/61)

## Limitations

Calls to services such as Table or Function can only be performed at the top-level. See below for some examples of valid and invalid service calls.

### Valid

```ts
// stash the result of the service call - the most common use-case
const item = myTable.get();

// calling the service but discarding the result is fine
myTable.get();
```

### Invalid

```ts
// you cannot in-line a call as the if condition, store it as a variable first
if (myTable.appsync.getItem(..)) {
}

if (condition) {
  // it is not currently possible to conditionally call a service, but this will be supported at a later time
  myTable.appsync.getItem(..);
}

for (const item in list) {
  // resolvers cannot be contained within a loop
  myTable.appsync.getItem(..);
}
```

No branching or parallel logic is supported. If you need more flexibility, consider calling a [Step Function](../step-function/index.md):

```ts
new ExpressStepFunction(this, "MyFunc", async (items: string[]) => {
  // process each item in parallel, an operation not supported in AWS AppSync.
  return Promise.all(items.map((item) => task(item)));
});
```
