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
2. An AppsyncFunction with a TypeScript function representing the Appsync Resolver Pipeline

### Type-Safe Wrappers - Function and Table

You must wrap your CDK L2 Constructs in the corresponding wrapper provided by functionless. At this time, we currently support AWS Lambda Functions and AWS DynamoDB Tables.

**Function**:

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

```ts
interface Item {
  key: string;
  data: number;
}

// see https://github.com/sam-goodwin/typesafe-dynamodb for more information on type-safe DynamoDB Tables.
const myTable = new Table<Item, "key">(
  new aws_dynamodb.Table(this, "MyTable", {
    ..
  })
)
```

### AppsyncFunction

Then, instantiate an `AppsyncFunction` and provide a function which implements an [Appsync Resolver](https://docs.aws.amazon.com/appsync/latest/devguide/configuring-resolvers.html).

```ts
// make sure you explicitly provide a type-signature for the function, or else the compiler transformer will not function
const getItem = new AppsyncFunction<(key: string) => Item | null>(
  ($context, key) => {
    const item = myTable.get({
      key: {
        S: key,
      },
    });

    return item;
  }
);
```

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

## Writing your own Synthesis process

You can access this data structure and build your own interpretations:

```ts
import { Expr } from "functionless/lib/expression";

const myFunc = new AppsyncFunction<F>(..);

myFunc.decl // FunctionDecl<F>

processExpr(myFunc.decl);

// write recursive functions to process the expressions
function processExpr(expr: Expr) {
  // do work
  if (expr.kind === "FunctionDecl") {
    // blah
  }
}
```
