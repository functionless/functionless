---
sidebar_position: 0
---

# How to create Integrations

This section goes into detail on how [Integrations](./concepts/integration/) work. If you are just looking to use Functionless without extending it, this section can be skipped. If you have not read [Integrations](./concepts/integration/), do that first.

## Integration Interface

An Integration has the following interface. It is simplified for brevity.

```ts
export interface Integration<
  K extends string = string,
  F extends AnyFunction = AnyFunction
> {
  readonly __functionBrand: F;
  readonly kind: K;
  readonly appSyncVtl: AppSyncVtlIntegration;
  readonly apiGWVtl: ApiGatewayVtlIntegration;
  readonly asl: (call: CallExpr, context: ASL) => Omit<State, "Next">;
  readonly eventBus: EventBusInteg;
  readonly native: NativeIntegration<F>;
}
```

Let's walk through this one by one.

### \_\_functionBrand

The `__functionBrand` property is a type-only property, meaning that it is not designed to be accessed at runtime. Its only purpose it to define the function signature of the integration (the way in which the integration can be called).

### kind

The `kind` property is a string literal that uniquely identifies the Integration kind. Think of it like the class name. It doesn't matter what it is, only that it is unique.

### appSyncVtl

As the name suggests, `appSyncVtl` implements the logic for connecting a Resource to an AWS Appsync Resolver Pipeline. It generates a Data Source and Velocity Templates (VTL) to satisfy the Integration requirements.

See the [Appsync Integration](./concepts/appsync/index.md) for more information on how Appsync works.

### apiGWVtl

:::Warning: API GW is not mature or stable:::

### asl

The `asl` property defines how to generate Amazon States Language (ASL) for integrating a service into an AWS Step Function.

See the [Step Function](./concepts/step-function/index.md) for more information on Step Functions.

### eventBus

AWS Event Bridge is a serverless service that inbound routes events to downstream services, via Integrations. THe `eventBus` property defines the Integration logic for [Event Bus Targets](./concepts/event-bridge/integrations.md).

### native

Finally, the `native` Integration is for an AWS Lambda Function. It is called `native` because it means it is running from "native" (aka. imperative) code. Its responsibility is to configure least-privilege IAM Policies, set Environment Variables with any identifiers (ARNs) it needs and then to initiate an SDK client when the Function is first invoked. By centralizing this logic within the Integration, consumers are freed from the boilerplate of manually configuring these details.

## makeIntegration

The `makeIntegration` method helps generate the right object and type for all integrations as well as making the property callable

```ts
this.putEvents = makeIntegration<...>({
```

ASL is an [Integration Type](./integration-types.md) that requests a method of the form `(call: CallExpr, context: ASL) => Omit<State, "Next">`.

This is where the integration prepares the ASL `State` which allows step functions to invoke the integration.

```ts
asl: (call: CallExpr, context: ASL) => {
  ...
}
```

On the `StepFunctions` side, it uses the `StepFunction` ASL Interface to extract the right data from the integrations. In this case its pretty simple.

When the Functionless compiler encounters an Integration, it wraps it in a [ReferenceExpr](../api/classes/ReferenceExpr.md).

The example with the `EventBus` and `StepFunction` above ends up looking like this after compilation:

```js
// event bus is a Resource
const bus = new functionless_2.EventBus(exports.stack, "bus");
// StepFunction is a Resource
new functionless_2.StepFunction(
  exports.stack,
  "sfn",
  new functionless_1.FunctionDecl(
    [new functionless_1.ParameterDecl("payload")],
    new functionless_1.BlockStmt([
      new functionless_1.ExprStmt(
        new functionless_1.CallExpr(
          new functionless_1.ReferenceExpr(
            "bus.putEvents",
            () =>
              // bus.putEvents is an Integration that supports the StepFunction ASL Integration Type
              bus.putEvents
          ),
          [
            new functionless_1.Argument(
              new functionless_1.ObjectLiteralExpr([
                new functionless_1.PropAssignExpr(
                  new functionless_1.StringLiteralExpr("source"),
                  new functionless_1.StringLiteralExpr("specialSource")
                ),
                new functionless_1.PropAssignExpr(
                  new functionless_1.StringLiteralExpr("detail-type"),
                  new functionless_1.StringLiteralExpr("UserNameEvent")
                ),
                new functionless_1.PropAssignExpr(
                  new functionless_1.StringLiteralExpr("detail"),
                  new functionless_1.Identifier("payload")
                ),
              ]),
              "event"
            ),
            new functionless_1.Argument(
              new functionless_1.ArrayLiteralExpr([]),
              "events"
            ),
          ]
        )
      ),
    ])
  )
);
```

During synthesis, when StepFunctions finds a [CallExpr](../api/classes/CallExpr.md), it checks to see if the call is on an Integration.

```ts
if (isCallExpr(expr)) {
```

Instead of actually calling the Integration, it knows the implemented interface on the Integration and can call that instead.

It looks for a ReferenceExpr and returns the contents

```ts
const integration = findIntegration(expr);
// IntegrationImpl is a friendly wrapper around an integration that generates consistent failures.
const integ = new IntegrationImpl(integration);
```

Then it calls the ASL method shown in the EventBus above.

```ts
const state = integ.asl(expr, this);
```

And finally add the resulting `state` to the ASL graph.
