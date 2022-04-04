# Function

The `Function` wrapper annotates an `aws_lambda.Function` with a TypeScript function signature that controls how it can be called.

```ts
import { aws_lambda } from "aws-cdk-lib";
import { Function, StepFunction } from "functionless";

const myFunc = new Function<{ name: string }, string>(
  new aws_lambda.Function(this, "MyFunc", {
    ..
  })
);
```

Within an AppsyncResolver, the `myFunc` function is integrated with an ordinary function call.

```ts
new AppsyncResolver(() => {
  return myFunc({ name: "my name" });
});
```

Input to the Lambda Function is a JSON object, as should be expected.

```json
{
  "name": "my name"
}
```

In a `StepFunction`, calling the `myFunc` function configures an integration that returns only the `Payload`:

```ts
new StepFunction(this, "MyStepFunction", (name: string) => {
  return myFunc({ name });
});
```

To get the entire AWS SDK request, use `$AWS.Lambda.Invoke`:

```ts
new StepFunction(this, "MyStepFunction", (name: string) => {
  return $AWS.Lambda.Invoke({
    FunctionName: myFunc,
    Payload: {
      name,
    },
  });
});
```
