---
sidebar_position: 3
---

# Writing your own interpreters

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

1. [expression.ts](../src/expression.ts)
2. [statement.ts](../src/statement.ts)
3. [declaration.ts](../src/declaration.ts)

For an example of an evaluator, see [vtl.ts](../src/vtl.ts).
