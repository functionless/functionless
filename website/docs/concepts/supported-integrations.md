---
sidebar_position: 0.1
---

# Supported Integrations

- [Function](./function) - the cloud's swiss army knife, an AWS Lambda Function. Functionless serializes in-line Function closures and automatically configures IAM Policies and Environment Variables, and initializes SDK clients (such as the AWS SDK) at runtime.
- [DynamoDB Table](./table.md) - a DynamoDB Table can be called from any functional integration, such as Function, Appsync Resolver, Step Function and Express Step Function.
- [Appsync Resolver](./appsync) - resolve fields in a GraphQL APi's Query, Mutation and Subscribe operations.
- [Step Function](./step-function/index.md#standard-step-function) - orchestrate long-running asynchronous workflows with AWS Step Functions.
- [Express Step Function](./step-function/index.md#express-step-function) - short-running synchronous or asynchronous workflows. Express Step Functions can often be a great replacement for intermediate Lambda Functions in APIs.
- [Event Bus Rule](./event-bridge/event-bus.md) - filter events flowing through an AWS Event Bridge Bus, optionally transform them and finally route them to a downstream integration, e.g. a Lambda Function, Step Function, SQS Queue, etc.
