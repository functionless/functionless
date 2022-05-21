---
sidebar_position: 4
---

# How it Works

When you compile your application with `tsc`, the [`functionless/lib/compile`](../../src/compile.ts) transformer will replace the function declaration, `F`, in `new AppsyncResolver(F)` with its corresponding [Abstract Syntax Tree](../../src/expression.ts) representation. This representation is then synthesized to Velocity Templates and AWS AppSync Resolver configurations, using the `@aws-cdk/aws-appsync-alpha` CDK Construct Library.

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
