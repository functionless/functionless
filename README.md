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

You must wrap your CDK L2 Constructs in the corresponding wrapper provided by functionless. At this time, we currently support AWS Lambda Functions and AWS DynamoDB Tables.

**Function**:

The `Function` wrapper annotates an `aws_lambda.Function` with a TypeScript function signature. This signature controls how the Function can be called from within an AppsyncFunction.

```ts
import { aws_lambda } from "aws-cdk-lib";
import { Function } from "functionless";

const myFunc = new Function<(name: string) => string>(
  new aws_lambda.Function(this, "MyFunc", {
    ..
  })
);
```

**Table**

The `Table` wrapper annotates an `aws_dynamodb.Table` with a type-safe interface.

First, declare a `interface` to describe your Table's data. You can use any of the features available in [`typesafe-dynamodb`](https://github.com/sam-goodwin/typesafe-dynamodb).

```ts
interface Item {
  key: string;
  data: number;
}
```

Then, wrap your `aws_dynamodb.Table` CDK Construct with the `functionless.Table` construct, specify the `Item` type, Partition Key `"id"` and (optionally) the Range Key.

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

## Why you should use Service-to-Service Integrations

Paul Swail has a piece on this topic which is worth reading: https://serverlessfirst.com/functionless-integration-trade-offs/.

In short: these integrations have many advantages over using AWS Lambda Functions, including:

1. **lower latency** - there is no cold start, so a service-to-service integration will feel "snappy" when compared to a Lambda Function.
2. **lower cost** - there's no intermediate Lambda Invocation when AppSync calls DynamoDB directly.
3. **higher scalability** - the handlers are not subject to the concurrent invocation limits and are running on dedicated Amazon servers.
4. **no operational maintenance** - such as upgrading dependencies, patching security vulnerabilities, etc. - theoretically, once the configuration is confirmed to be correct, it then becomes entirely AWS's responsibility to ensure the code is running optimally.

The downsides of these integrations are their dependence on Domain Specific Languages (DSL) such as Apache Velocity Templates or Amazon States Language JSON. These DSLs are difficult to work with since they lack the type-safety and expressiveness of TypeScript. Functionless aims to solve this problem by converting beautiful, type-safe TypeScript code directly into these configurations.

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
    new Block([
      new VariableDecl(
        "person",
        new Call(
          new PropRef(new Reference(() => this.personTable), "putItem"),
          {
            input: new ObjectLiteral([
              new PropertyAssignment(
                "key",
                new ObjectLiteral([
                  new PropertyAssignment(
                    "id",
                    new ObjectLiteral([
                      new PropertyAssignment(
                        "S",
                        new Call(
                          new PropRef(new Identifier("$util"), "autoId"),
                          {}
                        )
                      ),
                    ])
                  ),
                ])
              ),
              new PropertyAssignment(
                "attributeValues",
                new ObjectLiteral([
                  new PropertyAssignment(
                    "name",
                    new ObjectLiteral([
                      new PropertyAssignment(
                        "S",
                        new PropRef(new Identifier("input"), "name")
                      ),
                    ])
                  ),
                ])
              ),
            ]),
          }
        )
      ),
      new Return(new Identifier("person")),
    ])
  )
);
```

## Writing your own interpreters

Functionless converts TypeScript function syntax into a [`FunctionDecl`](./src/declaration.ts) AST data object. This object contains a total representation of the syntax contained within the Function and can then be processed within your CDK application. This is how `AppsyncFunction` works.

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
