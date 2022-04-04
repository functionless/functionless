---
sidebar_position: 0
---

# `AppsyncResolver`

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

No branching or parallel logic is supported. If you need more flexibility, consider calling a [Step Function](../stepfunctions/stepfunction):

```ts
new ExpressStepFunction(this, "MyFunc", (items: string[]) => {
  // process each item in parallel, an operation not supported in AWS AppSync.
  return items.map((item) => task(item));
});
```

## Add Resolvers to an `@aws-cdk/aws-appsync-alpha.GraphQLApi`

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
