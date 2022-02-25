# Functionless

Functionless is a TypeScript compiler transformer and framework for building "**functionless**" applications with the AWS Cloud Development Kit. The term, "functionless", refers to services such as AWS AppSync and AWS Step Functions that are configured with JSON and Velocity Templates. These services have the advantage of

See https://serverlessfirst.com/functionless-integration-trade-offs/ for more information on the concept of "functionless"

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

First, wrap your `aws_lambda.Function` or `aws_dynamodb.Table` CDK Constructs in `functionless.Lambda` or `functionless.Table` helper classes:

```ts
const myFunc = new Lambda<(name: string) => string>(
  new aws_lambda.Function(this, "MyFunc", {
    ..
  })
);

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

Then, instantiate an `AppsyncFunction` and provide a function which implements an [Appsync Resolver](https://docs.aws.amazon.com/appsync/latest/devguide/configuring-resolvers.html).

```ts
// make sure you explicitly provide a type-signature for the function, or else the compiler transformer will not function
const getItem = new AppsyncFunction<(key: string) => Item | null>(
  ($context, key) => {
    const item = myTable.get({
      key: {
        s: key,
      },
    });

    return item;
  }
);
```

## How it Works

When you compile your application with `tsc`, the [`functionless/lib/compile`](./src/compile.ts) transformer will replace the function declaration in `new AppsyncFunction(F)`, `F`, with [Abstract Syntax Tree](./src/expression.ts) data structure that represents the function's implementation. This AST is then synthesized to Velocity Templates and AWS AppSync Resolver configurations, using the `@aws-cdk/aws-appsync-alpha` CDK Construct Library.

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
