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

After configuring your schema, the next step is to implement Resolvers for each of the type's fields in the schema. Functionless's `AppsyncResolver` Construct makes this simple by generating all of the VTL templates, IAM Policies and Resolver configurations from an ordinary TypeScript function.

```ts
new AppsyncResolver(($context) => {
  return table.get({
    id: $context.arguments.id,
  });
});
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

`TSource` is only defined when the field being resolved is nested

## Add Resolvers to a GraphQLApi

When you create a `new AppsyncResolver`, it does not immediately generate an Appsync Resolver. `AppsyncResolver` is more like a template for creating resolvers and can be re-used across more than one API.

Options:

1. Add a resolver to a GraphQL Api with a pre-defined schema
2. Add a field resolver to a GraphQL Api using CDK's CodeFirst schema

### Add a resolver to a GraphQL Api with a pre-defined schema

To add to an API, use the `addResolver` utility on `AppsyncResolver`.

```ts
const getPerson = new AppsyncResolver(..);

// use it add resolvers to a GraphqlApi.
getPerson.addResolver(api, {
  typeName: "Query",
  fieldName: "getPerson",
});
```

### Add a field resolver to a GraphQL Api using CDK's CodeFirst schema

To add to a CodeFirst GraphQL schema, use `getField` utility on the `AppsyncResolver`.

```ts
const getPerson = new AppsyncResolver(..);

// define the type in code
const personType = api.addType(appsync.ObjectType(...));

// use it add resolvers to a GraphqlApi.
api.addQuery("getPerson", getPerson.getField(api, personType));
```

## $util

The `$util` object contains Appsync's intrinsic functions. See the [Resolver mapping template utility reference](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference.html)

**Warning**: not all of the utilities have been implemented. You can track progress here [#61](https://github.com/sam-goodwin/functionless/issues/61)
