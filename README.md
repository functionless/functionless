# Functionless `λ<`

**Functionless** is a TypeScript plugin that transforms TypeScript code into Service-to-Service (aka. "functionless") integrations, such as AWS AppSync [Resolvers](https://docs.aws.amazon.com/appsync/latest/devguide/configuring-resolvers.html) and [Velocity Templates](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-programming-guide.html), or (coming soon) [Amazon States Language](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html) for AWS Step Functions.

For example, the below function creates an Appsync Resolver Pipeline with two stages:

1. Call the `myTable` DynamoDB Table
2. Call the `myFunction` Lambda Function

```ts
const getItem = new AppsyncFunction<(id: string) => Item | null>(
  ($context, id) => {
    const item = myTable.get({
      id: $util.toDynamoDB(id),
    });

    const score = myFunction(item);

    return {
      ...item,
      score,
    };
  }
);
```

Functionless parses the TypeScript code and converts it to Apache Velocity Templates and an AWS Appsync CloudFormation configuration, saving you from writing all of that boilerplate. Below are snippets of the Velocity Templates that this TypeScript code generates.

**Get Item**:

```
#set($id = $util.toDynamoDB(id))
{
  "operation": "GetItem",
  "key": {
    "id": $util.toJson($id)
  }
}
```

**Invoke Function**:

```
{
  "operation": "Invoke",
  "payload": {
    "item": $util.toJson($context.stash.item)
  }
}
```

**Resolver Mapping Template**:

```
#set(v1 = {})
#foreach($k in $context.stash.item.keySet())
$util.qr($v1.put($k, $context.stash.item[$k]))
#end
$util.qr($v1.put('score', $context.stash.score))
$util.toJson($v1)
```

**Final JSON**

```json
{
  "id": "user-id",
  "score": 9001
}
```

## Why you should use Service-to-Service Integrations

Paul Swail has a piece on this topic which is worth reading: https://serverlessfirst.com/functionless-integration-trade-offs/.

In short: these integrations have many advantages over using AWS Lambda Functions, including:

1. **lower latency** - there is no cold start, so a service-to-service integration will feel "snappy" when compared to a Lambda Function.
2. **lower cost** - there's no intermediate Lambda Invocation when AppSync calls DynamoDB directly.
3. **higher scalability** - the handlers are not subject to the concurrent invocation limits and are running on dedicated Amazon servers.
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

## Usage

`functionless` makes configuring services like AWS Appsync as easy as writing TypeScript functions.

There are two aspects to Functionless:

1. Type-Safe wrappers of CDK L2 Constructs
2. An AppsyncFunction which represents the Appsync Resolver Pipeline

### Type-Safe Wrappers - Function and Table

You must wrap your CDK L2 Constructs in the corresponding wrapper provided by functionless. At this time, Lambda Functions and DynamoDB Tables are supported.

**Function**

The `Function` wrapper annotates an `aws_lambda.Function` with a TypeScript function signature that controls how the Function can be called from within an AppsyncFunction.

```ts
import { aws_lambda } from "aws-cdk-lib";
import { Function } from "functionless";

const myFunc = new Function<(name: string) => string>(
  new aws_lambda.Function(this, "MyFunc", {
    ..
  })
);
```

Within an [AppsyncFunction](#appsyncfunction), you can use the `myFunc` reference like an ordinary Function:

```ts
new AppsyncFunction(() => {
  return myFunc("name");
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

Finally, call `getItem`, `putItem`, etc. from within an [AppsyncFunction](#appsyncfunction):

```ts
new AppsyncFunction(() => {
  return myTable.get({
    key: $util.toDynamoDB("key"),
  });
});
```

### AppsyncFunction

After wrapping your Functions and Tables, you can then instantiate an `AppsyncFunction` and interact with them using standard TypeScript syntax.

```ts
const getItem = new AppsyncFunction<
  // you must explicitly provide a type-signature for the function
  (key: string) => Item | null
>(($context, key) => {
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
});
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

### TypeScript -> Velocity Template Logic

In order to write effective VTL templates, it helps to understand how TypeScript syntax maps to Velocity Template Statements.

An AppSync Request Mapping Template is synthesized by evaluating all [Expressions](./src/expression.ts) to a series of `#set`, `$util.qr`, `#foreach` and `#if` statements. The end result is an object containing the returned result of the function which can then be converted to JSON with `$util.toJson`.

The following section provides a reference guide on how each of the supported TypeScript syntax is mapped to VTL.

#### Variable - Top Level Scope

If in the top-level scope, all Variables are stored in `$context.stash`.

```ts
new AppsyncFunction(() => {
  const a = "value";
  const b = a;
});
```

```
#set($context.stash.a = 'value')
#set($context.stash.b = $context.stash.a)
```

#### Variable Reference - Function Parameter

A reference to a top-level Function Parameter is mapped to a `$context.arguments`-prefixed reference in VTL:

```ts
new AppsyncFunction((arg: string) => {
  return arg;
});
```

```
#return($context.arguments.arg)
```

#### Variable Declaration - Nested Scope

If in a nested scope, then the local variable name is used. These variables will not be available across Resolver Pipeline stages - but this should not be a problem as they are contained within a nested scope in TypeScript also.

```ts
new AppsyncFunction(() => {
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

## How it Works

When you compile your application with `tsc`, the [`functionless/lib/compile`](./src/compile.ts) transformer will replace the function declaration, `F`, in `new AppsyncFunction(F)` with its corresponding [Abstract Syntax Tree](./src/expression.ts) representation. This representation is then synthesized to Velocity Templates and AWS AppSync Resolver configurations, using the `@aws-cdk/aws-appsync-alpha` CDK Construct Library.

For example, this function declaration:

```ts
new AppsyncFunction<(input: { name: string }) => Person>((_$context, input) => {
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
new AppsyncFunction(
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
