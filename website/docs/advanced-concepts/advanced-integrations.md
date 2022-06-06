---
sidebar_position: 0
---

# Integration - Advanced

This section goes into detail on how [Integrations](../concepts/integration/) work. If you are just looking to use Functionless without extending it, this section can be skipped. If you have not read [Integrations](../concepts/integration/), do that first.

## Terms

### **Resource**

Infrastructure and Business Logic which use an integration, generally modelled as some infrastructure like a [`Function`](../concepts/function/) or [`EventBus`](../concepts/event-bridge/).

### **[Integration](../concepts/integration/)**

An object (may be a Resource) or function which can be used within a Resource.

### **[Integration Type](./integration-types.md)**

A pattern that an integration implements to be used within one or more Resources.

```mermaid
graph LR;
  IntegrationType(Integration Type)
  Resource--uses-->Integration;
  Resource--supports-->IntegrationType;
  Integration--implements-->IntegrationType;
```

How Integrations and Resources appear as a consumer of Functionless:

```ts
// event bus is a Resource
const bus = new EventBus<Event<{ name: string }>>(this, "bus");

// StepFunction is a Resource
const sfn = new StepFunction(this, sfn, (payload: { name: string }) => {
  // bus.putEvents is an Integration that supports the StepFunction ASL Integration Type
  bus.putEvents({
    source: "specialSource",
    "detail-type": "UserNameEvent",
    detail: payload,
  });
});
```

The `EventBus` and `putEvents` source which supports the StepFunction Integration Type:

```ts
class EventBus {
  constructor(...) {
    this.putEvents = makeIntegration<"EventBus.putEvents", IEventBus<E>["putEvents"]>({
      asl: (call: CallExpr, context: ASL) => {
        ...
      }
    })
  }
}
```

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
