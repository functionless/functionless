---
sidebar_position: 0
---
# Integration

An **Integration** is a connection between two services, for example an AWS Step Function calling a Lambda Function, or a Lambda Function writing to a DynamoDB Table, etc.

Integrations are a fundamental concept in building modern cloud applications. Cloud providers such as AWS provide services that manage integrations on your behalf, relieving you from scaling, operational and compliance responsibilities encountered in more traditional server-based applications.

A goal of Functionless is to make configuring integrations as simple as an ordinary function call, for example:

```ts
const stringSplit = new Function(this, "StringSplit", (text: string) => text.split(","));

new StepFunction(this, "Integration", (sentence: string) => {
  const words = stringSplit(sentence);
  for (const word of words) {
    // etc.
  }
})
```

This code has two cloud services, an AWS Step Function and Lambda Function, and one integration where the Step Function invokes the `stringSplit` Lambda Function.

The Functionless compiler analyzes this code to: 1) automatically create a minimally permissive IAM Policy with access to invoke the `stringSplit` Lambda Function, and 2) generate the corresponding service configuration, in this case a Task State in Amazon States Language JSON (ASL).

All integrations in Functionless follow this same pattern. Using Functionless should feel like writing ordinary application code, no boiler-plate and no DSLs!

# Supported Integrations
Functionless supports the following Integration patterns:
* [Function](./function.md) - the cloud's swiss army knife, an AWS Lambda Function. Functionless serializes in-line Function closures and automatically configures IAM Policies and Environment Variables, and initializes SDK clients (such as the AWS SDK) at runtime. 
* [DynamoDB Table](./table.md) - a DynamoDB Table can be called from any functional integration, such as Function, Appsync Resolver, Step Function and Express Step Function.
* [Appsync Resolver](./appsync) - resolve fields in a GraphQL APi's Query, Mutation and Subscribe operations.
* [Step Function](./step-function/standard.md) - orchestrate long-running asynchronous workflows with AWS Step Functions. 
* [Express Step Function](./step-function/express.md) - short-running synchronous or asynchronous workflows. Express Step Functions can often be a great replacement for intermediate Lambda Functions in APIs.
* [Event Bus Rule](./event-bridge/event-bus.md) - filter events flowing through an AWS Event Bridge Bus, optionally transform them and finally route them to a downstream integration, e.g. a Lambda Function, Step Function, SQS Queue, etc.



