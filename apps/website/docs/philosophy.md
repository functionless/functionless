---
sidebar_position: 5
---

# Philosophy

## Why you should use Service-to-Service Integrations

Paul Swail has a piece on this topic which is worth reading: https://serverlessfirst.com/functionless-integration-trade-offs/.

In short: these integrations have many advantages over using AWS Lambda Functions, including:

1. **lower latency** - there is no cold start, so a service-to-service integration will feel "snappy" when compared to a Lambda Function.
2. **lower cost** - there's no intermediate Lambda Invocation when AppSync calls DynamoDB directly.
3. **higher scalability** - the handlers are not subject to Lambda's concurrent invocation limits and are running on dedicated Amazon servers.
4. **no operational maintenance** - such as upgrading dependencies, patching security vulnerabilities, etc. - theoretically, once the configuration is confirmed to be correct, it then becomes entirely AWS's responsibility to ensure the code is running optimally.

The downsides of these integrations are their dependence on Domain Specific Languages (DSL) such as Apache Velocity Templates or Amazon States Language JSON. These DSLs are difficult to work with since they lack the type-safety and expressiveness of TypeScript. Functionless aims to solve this problem by converting beautiful, type-safe TypeScript code directly into these configurations.
