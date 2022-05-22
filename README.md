# Functionless `λ<`

[![npm version](https://badge.fury.io/js/functionless.svg)](https://badge.fury.io/js/functionless)

**Functionless** is a compiler plugin and Construct library that enhances your cloud programming experience with TypeScript and the AWS Cloud Development Kit (CDK). Tedious and error-prone configurations are inferred directly from your application logic, including IAM Policies, environment variables and proprietary domain specific languages such as Amazon States Language, Velocity Templates and Event Bridge Pattern Documents. This makes it simple, easy and fun(!) to configure AWS's powerful services without learning a new language or abstraction. Functionless always ensures that your IAM Policies are minimally permissive and that there is no missing plumbing code, so you can be confident that when your code compiles - then it also deploys, runs and is secure!

# Documentation

- [Functionless Documentation](https://functionless.org)

# Example Developer Experience

The below snippet shows how easy it is to configure AWS Appsync, Lambda, Step Functions and DynamoDB.

Functionless parses the TypeScript code and converts it to IAM Policies, Amazon States Language, Apache Velocity Templates and a CloudFormation configuration - saving you from writing all of that boilerplate!

```ts
const postTable = new functionless.Table<Post, "postId">(this, "PostTable", {
  partitionKey: {
    name: "postId",
    type: aws_dynamodb.AttributeType.String,
  },
  billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
});

// Query.addPost AppSync Resolver
const addPost = new functionless.AppsyncResolver<
  { title: string; text: string },
  Post
>(($context) => {
  const post = postDatabase.get({
    key: $util.toDynamoDB($util.autoUuid()),
    title: $util.toDynamoDB($context.arguments.title),
    text: $util.toDynamoDB($context.arguments.text),
  });

  // start execution of a long-running workflow to validate the Post
  validatePostWorkflow(post);

  return post;
});

// a Lambda Function which can validate the contents of a Post
const validatePost = new Function<Post, { status: string}>(this, "Validate", async (event) => {...});

// Step Function workflow that validates the contents of a Post and deletes it if bad
const validatePostWorkflow = new StepFunction(this, "ValidatePostWorkflow", (post: Post) => {
  const validationResult = validatePost(post);
  if (validationResult.status === "Not Cool") {
    $AWS.DynamoDB.DeleteItem({
      TableName: postTable,
      Key: {
        postId: {
          S: post.postId
        }
      }
    });
  }
});
```

Functionless parses the TypeScript code and converts it to Amazon States Language, Apache Velocity Templates and a CloudFormation configuration, saving you from writing all of that boilerplate.

## Why you should use Service-to-Service Integrations

Paul Swail has a piece on this topic which is worth reading: https://serverlessfirst.com/functionless-integration-trade-offs/.

In short: these integrations have many advantages over using AWS Lambda Functions, including:

1. **lower latency** - there is no cold start, so a service-to-service integration will feel "snappy" when compared to a Lambda Function.
2. **lower cost** - there's no intermediate Lambda Invocation when AppSync calls DynamoDB directly.
3. **higher scalability** - the handlers are not subject to Lambda's concurrent invocation limits and are running on dedicated Amazon servers.
4. **no operational maintenance** - such as upgrading dependencies, patching security vulnerabilities, etc. - theoretically, once the configuration is confirmed to be correct, it then becomes entirely AWS's responsibility to ensure the code is running optimally.

The downsides of these integrations are their dependence on Domain Specific Languages (DSL) such as Apache Velocity Templates or Amazon States Language JSON. These DSLs are difficult to work with since they lack the type-safety and expressiveness of TypeScript. Functionless aims to solve this problem by converting beautiful, type-safe TypeScript code directly into these configurations.

## Setup

First, install the `functionless` and `ts-patch` NPM packages.

```shell
npm install --save-dev functionless ts-patch
```

Then, add `ts-patch install -s` to your `prepare` script (see [ts-patch](https://github.com/nonara/ts-patch) for mode details.)

```json
{
  "scripts": {
    "prepare": "ts-patch install -s"
  }
}
```

Make sure to run `npm install` to bootstrap `ts-patch` (via the `prepare` script).

```shell
npm install
```

Finally, configure the `functionless/lib/compile` TypeScript transformer plugin in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "functionless/lib/compile"
      }
    ]
  }
}
```

Files can be ignored by the transformer by using glob patterns in the `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "functionless/lib/compile",
        "exclude": ["./src/**/protected/*"]
      }
    ]
  }
}
```

## Usage

`functionless` makes configuring services like AWS Appsync as easy as writing TypeScript functions.

- [App Sync](#App-Sync)
- [Event Bridge](#Event-Bridge)
- [Lambda](#Lambda)

### App Sync

There are three aspects your need to learn before using Functionless in your CDK application:

1. Appsync Integration interfaces for `Function` and `Table`.
2. `AppsyncResolver` construct for defining Appsync Resolver with TypeScript syntax.
3. Add Resolvers to an `@aws-cdk/aws-appsync-alpha.GraphQLApi`.

#### Appsync Integration interfaces for `Function` and `Table`

You must wrap your CDK L2 Constructs in the corresponding wrapper class provided by functionless. Currently, Lambda `Function` and DynamoDB `Table` are supported.

**Function**

The `Function` wrapper annotates an `aws_lambda.Function` with a TypeScript function signature that controls how it can be called from within an `AppsyncResolver`.

```ts
import { aws_lambda } from "aws-cdk-lib";
import { Function } from "functionless";

const myFunc = Function.fromFunction<{ name: string }, string>(
  new aws_lambda.Function(this, "MyFunc", {
    ..
  })
);
```

Within an [AppsyncResolver](#AppsyncResolver), you can use the `myFunc` reference like an ordinary Function:

```ts
new AppsyncResolver(() => {
  return myFunc({ name: "my name" });
});
```

The first argument is passed to the Lambda Function.

```json
{
  "name": "my name"
}
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

#### `AppsyncResolver` construct for defining Appsync Resolver with TypeScript syntax

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
});

// Step Function workflow that validates the contents of a Post and deletes it if bad
const validatePostWorkflow = new StepFunction(
  this,
  "deleteRule",
  (event) => event["detail-type"] === "Delete"
);
```

We also want to do something special when we get a new cat lover who is between 18 and 30 years old, lets make another rule for those.

```ts
const catPeopleEvents = bus.when(
  (event) =>
    event["detail-type"] === "Create" &&
    event.detail.interests.includes("CATS") &&
    event.detail.age >= 18 &&
    event.detail.age < 30
);
```

Rules can be further refined by calling `when` on a Functionless `EventBusRule`.

```ts
// Cat people who are between 18 and 30 and do not also like dogs.
catPeopleEvents.when((event) => !event.detail.interests.includes("DOGS"));
```

#### Transform the event before sending to some services like `Lambda` Functions.

We have two lambda functions to invoke, one for create or updates and another for deletes, lets make those.

```ts
const createOrUpdateFunction = new aws_lambda.Function(this, 'createOrUpdate', ...);
const deleteFunction = new aws_lambda.Function(this, 'delete', ...);
```

and wrap them with Functionless's `Function` wrapper, including given them input types.

```ts
interface CreateOrUpdate {
  id?: string;
  name: string;
  age: number;
  operation: "Create" | "Update";
  interests: string[];
}

interface Delete {
  id: string;
}

const createOrUpdateOperation = functionless.Function<CreateOrUpdate, void>(
  createOrUpdateFunction
);
const deleteOperation = functionless.Function<Delete, void>(deleteFunction);
```

The events from before do not match the formats from before, so lets transform them to the structures match.

```ts
const createOrUpdateEventsTransformed =
  createOrUpdateEvents.map<CreateOrUpdate>((event) => ({
    id: event.detail.id,
    name: event.detail.name,
    age: event.detail.age,
    operation: event["detail-type"],
    interests: event.detail.interests,
  }));

const deleteEventsTransformed = createOrUpdateEvents.map<Delete>((event) => ({
  id: event.detail.id,
}));
```

#### Target other AWS services like Lambda and other Event Buses

Now that we have created rules on our event buses using `when` and transformed those matched events using `map`, we need to send the events somewhere.

We can `pipe` the transformed events to the lambda functions we defined earlier.

```ts
createOrUpdateEventsTransformed.pipe(createOrUpdateOperation);
deleteEventsTransformed.pipe(deleteOperation);
```

What about our young cat lovers? We want to forward those events to our sister team's event bus for processing.

```ts
const catPeopleBus = functionless.EventBus.fromBus(
  aws_events.EventBus.fromEventBusArn(this, "catTeamBus", catTeamBusArn)
);

// Note: EventBridge does not support transforming events which target other event buses. These events are sent as is.
catPeopleEvents.pipe(catPeopleBus);
```

#### Put Events from other sources

Event Bridge Put Events API is one of the methods for putting new events on an event bus. We support some first party integrations between services and event bus.

Support (See [issues](https://github.com/sam-goodwin/functionless/issues?q=is%3Aissue+is%3Aopen+label%3Aevent-bridge) for progress):

- Step Functions
- App Sync (coming soon)
- API Gateway (coming soon)
- More - Please create a new issue in the form `Event Bridge + [Service]`

```ts
bus = new EventBus(stack, "bus");
new StepFunction<{ value: string }, void>((input) => {
  bus({
    detail: {
      value: input.value,
    },
  });
});
```

This will create a step function which sends an event. It is also possible to send multiple events and use other Step Function logic.

> Limit: It is not currently possible to dynamically generate different numbers of events. All events sent must start from objects in the form `{ detail: ..., source: ... }` where all fields are optional.

#### Summary

Lets look at the above all together.

```ts
interface UserDetails {
  id?: string;
  name: string;
  age: number;
  interests: string[];
}

interface UserEvent
  extends functionless.EventBusRuleInput<
    UserDetails,
    // We can provide custom detail-types to match on
    "Create" | "Update" | "Delete"
  > {}

interface CreateOrUpdate {
  id?: string;
  name: string;
  age: number;
  operation: "Create" | "Update";
  interests: string[];
}

interface Delete {
  id: string;
}

const createOrUpdateFunction = new functionless.Function<CreateOrUpdate, void>(this, "createOrUpdate", ...);

const deleteFunction = new functionless.Function<Delete, void>(this, "delete", ...);

const bus = new functionless.EventBus<UserEvent>(this, "myBus");

// Create and update events are sent to a specific lambda function.
bus
  .when(
    this,
    "createOrUpdateRule",
    (event) =>
      event["detail-type"] === "Create" || event["detail-type"] === "Update"
  )
  .map<CreateOrUpdate>((event) => ({
    id: event.detail.id,
    name: event.detail.name,
    age: event.detail.age,
    operation: event["detail-type"] as "Create" | "Update",
    interests: event.detail.interests,
  }))
  .pipe(createOrUpdateFunction);

// Delete events are sent to a specific lambda function.
bus
  .when(this, "deleteRule", (event) => event["detail-type"] === "Delete")
  .map<Delete>((event) => ({
    id: event.detail.id!,
  }))
  .pipe(deleteFunction);

// New, young users interested in cat are forwarded to our sister team.
bus
  .when(
    this,
    "catLovers",
    (event) =>
      event["detail-type"] === "Create" &&
      event.detail.interests.includes("CATS") &&
      event.detail.age >= 18 &&
      event.detail.age < 30
  )
  .pipe(
    functionless.EventBus<UserEvent>.fromBus(
      aws_events.EventBus.fromEventBusArn(this, "catTeamBus", catBusArn)
    )
  );
```

### Lambda

Functionless supports the use of native typescript callbacks as lambda function handlers.

```ts
new Function(this, "myFunction", async (event) => {
  console.log(event);
  return Object.keys(event).length;
});
```

#### !!CAVEAT: Using Function Callbacks with `app.synth()`!!

https://github.com/sam-goodwin/functionless/issues/128

Normal use of the CDK through the CLI should work just fine without doing anything special.

The problem comes when using the explicit `app.synth()` method. This is a common case if trying to test your CDK code through testing tooling like `jest`.

CDK does not natively support async code through the constructs, however, Functionless is using `pulumi`'s `serializeFunction` which is an async function.

When using `.synth()` programmatically, use the provided `asyncSynth` method to wrap your app.

```ts
const cloudAssembly = await asyncSynth(app, options);
```

For a full example of testing CDK using [`localstack`](https://localstack.cloud/) in jest, see [here](https://github.com/sam-goodwin/functionless/blob/253c33a14c246b70481f75f94cbffcb38d21053b/test/localstack.ts#L18).

#### Troubleshooting: Tests with `Function` are extremely slow.

1. Ensure you are not running coverage on your `/test` files. The function serializer will try to serialize the coverage instrumentation.
2. Use `Function.fromFunction` if you are not testing the behavior of your lambda.

## TypeScript -> Velocity Template Logic

In order to write effective VTL templates, it helps to understand how TypeScript syntax maps to Velocity Template Statements.

An AppSync Request Mapping Template is synthesized by evaluating all [Expressions](./src/expression.ts) to a series of `#set`, `$util.qr`, `#foreach` and `#if` statements. The end result is an object containing the returned result of the function which can then be converted to JSON with `$util.toJson`.

The following section provides a reference guide on how each of the supported TypeScript syntax is mapped to VTL.

<details>
<summary>Click to expand</summary>

#### Parameter Reference

A reference to the top-level Function Parameter is mapped to a `$context` in VTL:

```ts
new AppsyncResolver((c: AppsyncContext<{ arg: string }>) => {
  return c.arguments.arg;
});
```

```
#return($context.arguments.arg)
```

#### Variable Declaration

If in the top-level scope, all Variables are stored in `$context.stash`.

```ts
new AppsyncResolver(() => {
  const a = "value";
  const b = a;
});
```

```
#set($context.stash.a = 'value')
#set($context.stash.b = $context.stash.a)
```

#### Variable Declaration in a nested scope

If in a nested scope, then the local variable name is used. These variables will not be available across Resolver Pipeline stages - but this should not be a problem as they are contained within a nested scope in TypeScript also.

```ts
new AppsyncResolver(() => {
  if (condition) {
    const a = "value";
    const b = a;
  }

  for (const i in list) {
    const a = "value";
    const b = a;
  }
);
```
