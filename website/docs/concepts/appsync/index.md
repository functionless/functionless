# Appsync Resolver

An `AppsyncResolver` function is translated into an AWS AppSync Resolver Pipeline. It can call 0-10 integrations in sequence:

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

## Add Resolvers to an `@aws-cdk/aws-appsync-alpha.GraphQLApi`

When you create a `new AppsyncResolver`, it does not immediately generate an Appsync Resolver. `AppsyncResolver` is more like a template for creating resolvers and can be re-used across more than one API.

Options:

1. Add a resolver to a GraphQL Api with a pre-defined schema
2. Add a field resolver to a GraphQL Api using CDK's CodeFirst schema

### Add a resolver to a GraphQL Api with a pre-defined schema

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

### Add a field resolver to a GraphQL Api using CDK's CodeFirst schema

To add to a CodeFirst GraphQL schema, use `getField` utility on the `AppsyncResolver`.

```ts
const app = new App();

const stack = new Stack(app, "stack");

const api = new appsync.GraphqlApi(stack, "Api", {
  name: "demo",
  authorizationConfig: {
    defaultAuthorization: {
      authorizationType: appsync.AuthorizationType.IAM,
    },
  },
  xrayEnabled: true,
});

// create a template AppsyncResolver
const getPerson = new AppsyncResolver(..);

const personType = api.addType(appsync.ObjectType(...));

// use it add resolvers to a GraphqlApi.
api.addQuery("getPerson", getPerson.getField(api, personType));
```
