---
sidebar_position: 1.1
---

# Supported Integrations

You must wrap your CDK L2 Constructs in the corresponding wrapper class provided by functionless. Currently, Lambda `Function` and DynamoDB `Table` are supported.

## Function

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

## Table

TODO
