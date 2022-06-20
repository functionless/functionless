---
sidebar_position: 0
---

# How Integrations Work

This section goes into detail on how [Integrations](../concepts/integration) work and how to implement your own. If you are just looking to use Functionless without extending it, this section can be skipped. If you have not read [Integrations](../concepts/integration), do that first.

## Integration Interface

An `Integration` has the following interface (simplified for brevity).

```ts
export interface Integration<
  K extends string = string,
  F extends AnyFunction = AnyFunction
> {
  readonly __functionBrand: F;
  readonly kind: K;
  readonly appSyncVtl?: AppSyncVtlIntegration;
  readonly apiGWVtl?: ApiGatewayVtlIntegration;
  readonly asl?: (call: CallExpr, context: ASL) => Omit<State, "Next">;
  readonly eventBus?: EventBusInteg;
  readonly native?: NativeIntegration<F>;
}
```

### `__functionBrand`

The `__functionBrand` property is a type-only property, meaning that it is not designed to be accessed at runtime. Its only purpose it to define the function signature of the integration (the way in which the integration can be called).

### `kind`

The `kind` property is a string literal that uniquely identifies the Integration kind. Think of it like the class name. It doesn't matter what it is, only that it is unique.

### `appSyncVtl`

As the name suggests, `appSyncVtl` implements the logic for connecting a Resource to an AWS Appsync Resolver Pipeline. It generates a Data Source and Velocity Templates (VTL) to satisfy the Integration requirements.

It contains the following hooks that will be invoked when this Integration is called from within an [AppsyncResolver](../concepts/appsync/index.md):

1. `dataSourceId` - provides a unique ID for a data source to ensure only one is configured per GraphQL API.
2. `dataSource` - creates a Data Source and binds it to the GraphQL API. The Data Source will be used at runtime by Appsync to resolve the query.
3. `request` - generate a Velocity Template string that will emit the JSON request payload required by the Integration's API call.
4. `result` - an optional callback to emit Velocity Templates that will transform the JSON response payload returned by the Integration's API call.

See the [Appsync Integration](../concepts/appsync/index.md) for more information on how Appsync works.

### `apiGWVtl`

Implements the logic for attaching an Integration to an AWS API Gateway REST HTTP Method. It contains the following hooks that will be invoked when this Integration is called from within an [AwsMethod](../api/classes/AwsMethod.md).

- `renderRequest` - generate a VTL template that will emit the JSON request payload required by the Integration's API call.
- `createIntegration` - creates the corresponding [REST API Integration](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-integration-settings.html) to configure AWS to call the Integration.

:::caution
The API GW interface is not mature or stable.
:::

### `asl`

The `asl` property defines how to generate Amazon States Language (ASL) for integrating a service into an AWS Step Function. It is a function that accepts a [`CallExpr`](../api/classes/CallExpr.md) and an [`ASL`](../api/classes/ASL.md) context representing the Integration and the current Amazon States Language (ASL) Context. This callback then grants any IAM Policies it requires and returns an ASL Task State that fulfils the request.

See the [Step Function](../concepts/step-function/index.md) for more information on Step Functions.

### `eventBus`

AWS Event Bridge is a serverless service that inbound routes events to downstream services, via Integrations. The `eventBus` property defines the Integration logic for [Event Bus Targets](../concepts/event-bridge/integrations.md).

It contains a single hook:

- `target` - called during CDK synthesis to configure the Event Bridge Target.

### `native`

Finally, the `native` Integration is for an AWS Lambda Function. It is called `native` because it means it is running from "native" (aka. imperative) NodeJS code. Its responsibility is to configure least-privilege IAM Policies, set Environment Variables with any identifiers (ARNs) it needs and then to initiate an SDK client when the Function is first invoked. By centralizing this logic within the Integration, consumers are freed from the boilerplate of manually configuring these details.

It contains the following hooks that will be called either during CDK synthesis or at runtime within the Lambda Function container:

- `bind` - called during CDK synthesis to create required IAM Policies and set any required Environment Variables.
- `preWarm` - an optional hook to "warm" the integration on the first invocation, for example initialize any SDK clients once and cache the result.
- `call` - implements the Integration's logic, for example call an SDK client or HTTP request, etc.

## Functionless AST

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

<details>

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

</details>
