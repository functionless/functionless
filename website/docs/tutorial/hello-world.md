---
label: Hello World
sidebar_position: 1
---

# Hello World

Let's demonstrate the power of Functionless with the traditional example of logging a simple message, "hello, world!". We'll log the message within a Lambda Function, because (you know) we're all about cloud programming over here.

Now, let's import the `Function` Construct from `functionless` and use it to create a Lambda Function that logs out `"hello, world!"`.

```ts
import { Function } from "functionless";
```

This primitive enables you to define your Lambda Function's implementation directly within your Constructs. Let's add it to our `HelloWorldStack`:

```ts
export class HelloWorldStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new Function(this, "HelloWorld", async () => {
      console.log("hello, world!");
    });
  }
}
```

Deploy with `cdk deploy` and invoke the Function from the AWS Console. You should hopefully see a message in your CloudWatch Logs:
```
hello, world!
```

And just like that, you've created your first functioning application with Functionless. Pretty easy, right?
