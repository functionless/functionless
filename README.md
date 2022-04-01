# Functionless `λ<`

[![npm version](https://badge.fury.io/js/functionless.svg)](https://badge.fury.io/js/functionless)

**Functionless** is a TypeScript plugin that transforms TypeScript code into Service-to-Service (aka. "functionless") integrations, such as AWS AppSync [Resolvers](https://docs.aws.amazon.com/appsync/latest/devguide/configuring-resolvers.html) and [Velocity Templates](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-programming-guide.html), or [Amazon States Language](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html) for AWS Step Functions.

For example, the below function creates an Appsync Resolver Pipeline with two stages:

1. Get an item from the `myTable` DynamoDB Table
2. Call the `myFunction` Lambda Function
3. Start the `myStepF Step Function

```ts
const postTable = new Table<Post, "postId">(new aws_dynamodb.Table(this, "PostTable", { .. }));

// Query.addPost AppSync Resolver
const addPost = new AppsyncResolver<{ title: string, text: string }, Post>(($context) => {
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
const validatePost = new Function<Post, >(new aws_lambda.Function(this, "Validate", { .. }))

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

There are three aspects your need to learn before using Functionless in your CDK application:

1. Appsync Integration interfaces for `Function` and `Table`.
2. `AppsyncResolver` construct for defining Appsync Resolver with TypeScript syntax.
3. Add Resolvers to an `@aws-cdk/aws-appsync-alpha.GraphQLApi`.

### Appsync Integration interfaces for `Function` and `Table`

You must wrap your CDK L2 Constructs in the corresponding wrapper class provided by functionless. Currently, Lambda `Function` and DynamoDB `Table` are supported.

**Function**

The `Function` wrapper annotates an `aws_lambda.Function` with a TypeScript function signature that controls how it can be called from within an `AppsyncResolver`.

```ts
import { aws_lambda } from "aws-cdk-lib";
import { Function } from "functionless";

const myFunc = new Function<{ name: string }, string>(
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
});
```

```
#if($condition)
#set($a = 'value')
#set($b = $a)
#end

#foreach($i in $list)
#set($a = 'value')
#set($b = $a)
#end
```

#### Template Expressions (string interpolation)

Template expressions translate almost 1:1 with VTL:

```ts
const a = `hello ${name}`;
```

```
#set($context.stash.a = "hello ${name}")
```

#### Property and Index Assignment

```ts
a[0] = value;
a.prop = value;
a["prop"] = value;
a[prop] = value;
```

```
$util.qr($a[0] = $value)
$util.qr($a.prop = $value)
$util.qr($a['prop'] = $value)
$util.qr($a[$prop] = $value)
```

#### ArrayLiteralExpr

Array Literals can contain arbitrary expressions.

```ts
const a = [];
const b = ["hello", 1, util.toJson(a)];
```

```
#set($a = [])
#set($b = ['hello', 1, $util.toJson($a)])
```

#### SpreadElementExpr

There is a special case when you use a `SpreadElementExpr` (e.g. `[...list]`) because there is no way to achieve this behavior in VTL without first assigning a list and then using `addAll` to copy the items in.

If you ever use `SpreadElementExpr`, a temporary variable will be first initialized with an empty array (`[]`):

```ts
const c = [...b];
```

```
#set($v1 = [])
$util.qr($c.addAll($b))
#set($c = $v1)
```

#### ObjectLiteralExpr

An `ObjectLiteralExpr` is first stored as an empty map `{}` in a temporary variable and subsequent statements are generated to add each of the elements in.

```ts
const a = {
  key: "string",
};
```

```
#set($a = {})
$util.qr($a.put('key', 'string'))
```

#### SpreadAssignExpr

If you spread an object into another, a [`java.util.Map.putAll`](https://docs.oracle.com/javase/8/docs/api/java/util/HashMap.html#putAll-java.util.Map-) statement is generated to copy over each item in the source object into the destination object.

```ts
const a = {
  ...obj,
};
```

```
#set($a = {})
$util.qr($a.putAll($obj))
```

#### CallExpr - $util

The `$util.*` utility functions are translated verbatim into a VTL expression.

```ts
$util.error("error");
const a = $util.toJson(val);
```

```
$util.error('error')
#set($a = $util.toJson($val))
```

#### If Statement

An `if` statement translates to a series of `#if`, `#else` statements.

```ts
if (a === "hello") {
  return a;
}
```

```
#if($a == 'hello')
  #return($a)
#end
```

`#elseif` is not used because evaluating the condition may translate to a series of `#set` or `$util.qr` statements. For this reason, all `else if` clauses are translated to `#else` with a nested `#if`:

```ts
if (a === "hello") {
  return a;
} else if (call() === "hello") {
  return false;
}
```

```
#if($a == 'hello')
  #return($a)
#else
  #set($v1 = call())
  #if($v1 === "hello")
    #return($a)
  #end
#end
```

#### Conditional Expressions

A conditional expression, i.e. `cond ? then : else` are translated into `#if` and `#else` statements that assign a shared variable with the result of their computation;

```ts
const a = condition ? "left" : "right;
```

```
#if($condition)
#set($result = 'left')
#else
#set($result = 'right')
#end
#set($a = $result)
```

#### For-In-Statement

A `for-in` statement iterates over the keys in an object using `java.util.Map.keySet()`.

```ts
for (const i in obj) {
  const a = obj[i];
}
```

```
#foreach($i in $obj.keySet())
#set($a = $obj[$i])
#end
```

#### For-Of-Statement

A `for-of` statement iterates over the items in a `java.util.List`.

```ts
for (const item in list) {
}
```

```
#foreach($item in $list)
#end
```

#### CallExpr - map

When you map over a list, a new list is created and then `#foreach` is used to iterate over the source list, evaluate your function and add the result to the new list.

**Warning**: chains of `map`, `forEach` and `reduce` results in redundant `#foreach` loops, see https://github.com/sam-goodwin/functionless/issues/2

```ts
const newList = list.map((i) => i + 1);
```

```
#set($newList = [])
#foreach($i in $list)
$util.qr($newList.add($i + 1))
#end
```

#### CallExpr - forEach

`forEach` is similar to `map` except it does not produce a value. The (below) example emulates `map` with `forEach`.

**Warning**: chains of `map`, `forEach` and `reduce` results in redundant `#foreach` loops, see https://github.com/sam-goodwin/functionless/issues/2

```ts
const newList = [];
list.forEach((i) => newList.push(i + 1));
```

```
#set($newList = [])
#foreach($i in $list)
$util.qr($newList.add($i + 1))
#end
```

#### CallExpr - reduce

`reduce` has two variants: 1) with an `initialValue` and 2) without.

**Warning**: chains of `map`, `forEach` and `reduce` results in redundant `#foreach` loops, see https://github.com/sam-goodwin/functionless/issues/2

If there is no initial value, then the list cannot be empty - if an empty list is encountered an error will be raised with `$util.error`.

Within the loop, the first value will not be processed by your function, instead it becomes the first value `$a`.

```ts
// without an initial value
const sum = list.reduce((a, b) => a + b);
```

```
#set(sum = [])
#if($list.isEmpty())
$util.error('Reduce of empty array with no initial value')
#end
#foreach($b in $list)
#if($foreach.index == 0)
#set($a = $b)
#else
#set($a = $a + $b)
#end
#end
```

If there is an initial value, then it is stored as a variable, referenced in the `#foreach` loop and overwritten at the end of each loop.

```ts
// with an initial value
const obj = list.reduce((a: Record<string, boolean>, b: string) => {
  ...a,
  [b]: true
}, {})
```

```
#set($a = {})
#foreach($b in $obj)
#set($v1 = {})
$util.qr($v1.putAll($a))
$util.qr($v1.put($b, true))
#set($a = $v1)
#end
```

</details>

## How it Works

When you compile your application with `tsc`, the [`functionless/lib/compile`](./src/compile.ts) transformer will replace the function declaration, `F`, in `new AppsyncResolver(F)` with its corresponding [Abstract Syntax Tree](./src/expression.ts) representation. This representation is then synthesized to Velocity Templates and AWS AppSync Resolver configurations, using the `@aws-cdk/aws-appsync-alpha` CDK Construct Library.

For example, this function declaration:

```ts
new AppsyncResolver<(input: { name: string }) => Person>((_$context, input) => {
  const person = this.personTable.putItem({
    key: {
      id: {
        S: $util.autoId(),
      },
    },
    attributeValues: {
      name: {
        S: input.name,
      },
    },
  });

  return person;
});
```

Is replaced with the following AST data structure:

```ts
new AppsyncResolver(
  new FunctionDecl(
    [new ParameterDecl("input")],
    new BlockStmt([
      new VariableStmt(
        "person",
        new CallExpr(
          new PropAccessExpr(
            new ReferenceExpr(() => this.personTable),
            "putItem"
          ),
          {
            input: new ObjectLiteralExpr([
              new PropAssignExpr(
                "key",
                new ObjectLiteralExpr([
                  new PropAssignExpr(
                    "id",
                    new ObjectLiteralExpr([
                      new PropAssignExpr(
                        "S",
                        new CallExpr(
                          new PropAccessExpr(new Identifier("$util"), "autoId"),
                          {}
                        )
                      ),
                    ])
                  ),
                ])
              ),
              new PropAssignExpr(
                "attributeValues",
                new ObjectLiteralExpr([
                  new PropAssignExpr(
                    "name",
                    new ObjectLiteralExpr([
                      new PropAssignExpr(
                        "S",
                        new PropAccessExpr(new Identifier("input"), "name")
                      ),
                    ])
                  ),
                ])
              ),
            ]),
          }
        )
      ),
      new ReturnStmt(new Identifier("person")),
    ])
  )
);
```

## Writing your own interpreters

Functionless converts TypeScript function syntax into a [`FunctionDecl`](./src/declaration.ts) AST data object. This object contains a total representation of the syntax contained within the Function and can then be processed within your CDK application.

To get a `FunctionDecl` for a function, use the `functionless.reflect` utility:

```ts
import { reflect } from "functionless";

const functionDecl = reflect((arg: string) => {
  return `${arg}_1`;
});
```

Then, write a recursive function to process the representation:

```ts
import { FunctionlessNode } from "functionless";

function processExpr(node: FunctionlessNode) {
  // do work
  if (node.kind === "FunctionDecl") {
    // blah
  }
}
```

See the following files to understand the structure of the Abstract Syntax Tree:

1. [expression.ts](./src/expression.ts)
2. [statement.ts](./src/statement.ts)
3. [declaration.ts](./src/declaration.ts)

For an example of an evaluator, see [vtl.ts](./src/vtl.ts).
