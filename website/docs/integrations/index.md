# Integrations

An **Integration** is a connection between two services, for example an AWS Step Function calling a Lambda Function. In Functionless, this is achieved with a simple, ordinary function call expression:

```ts
const stringSplit = new Function(this, "StringSplit", (text: string) => text.split(","));

new StepFunction(this, "Integration", (sentence: string) => {
  const words = stringSplit(sentence);
  for (const word of words) {
    // etc.
  }
})
```

The Functionless compiler analyzes this code to: 1) automatically create a minimally permissive IAM Policy with access to invoke the `stringSplit` Lambda Function, and 2) generate the corresponding service configuration, in this case a Task State in Amazon States Language JSON (ASL).

Functionless supports the following Integration patterns:
* [Function](./function.md) - the cloud's swiss army knife, an AWS Lambda Function. Functionless serializes in-line Function closures and automatically configures IAM Policies and Environment Variables, and initializes SDK clients (such as the AWS SDK) at runtime. 
* [DynamoDB Table](./table.md) - a DynamoDB Table can be called from any functional integration, such as Function, Appsync Resolver, Step Function and Express Step Function.
* [Appsync Resolver](./appsync) - resolve fields in a GraphQL APi's Query, Mutation and Subscribe operations.
* [Step Function](./step-function/standard.md) - orchestrate long-running asynchronous workflows with AWS Step Functions. 
* [Express Step Function](./step-function/express.md) - short-running synchronous or asynchronous workflows. Express Step Functions can often be a great replacement for intermediate Lambda Functions in APIs.
* [Event Bus Rule](./event-bridge/event-bus.md) - filter events flowing through an AWS Event Bridge Bus, optionally transform them and finally route them to a downstream integration, e.g. a Lambda Function, Step Function, SQS Queue, etc.



