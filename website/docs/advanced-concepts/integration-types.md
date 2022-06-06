---
sidebar_position: 1
---

# Integration Types

Integration Types are an interface which [Integrations](../concepts/integration/) implement to be used by some Resource.

For example, when an [`AppSyncResolver`](../concepts/appsync/) calls a [`StepFunction`](../concepts/step-function), it expects the [AppSyncVtlIntegration](../api/interfaces/AppSyncVtlIntegration.md) to be implemented on `StepFunction`.

The user writes:

```ts
const sfn = new StepFunction(stack, "sfn", () => { ... });

const sendEvent = new AppsyncResolver(() => {
  sfn();
});
```

And the [`StepFunction`](../api/classes/StepFunction.md) implements the [AppSyncVtlIntegration](../api/interfaces/AppSyncVtlIntegration.md) interface.

```ts
/**
 * Hooks used to create an app sync integration, implement using the {@link Integration} interface.
 *
 * 1. Get the AppSync data source
 * 2. Create the VTL request template to make data source call.
 * 3. Optionally post process the result of the data source call.
 */
export interface AppSyncVtlIntegration {
  /**
   * Retrieve the id of the date source to use for the integration.
   */
  dataSourceId: () => string;
  /**
   * Retrieve a unique data source for the {@link appsync.GraphqlApi}.
   */
  dataSource: (
    api: appsync.GraphqlApi,
    dataSourceId: string
  ) => appsync.BaseDataSource;
  /**
   * Return a VTL template which builds a valid request to the integration's endpoint.
   */
  request: (call: CallExpr, context: VTL) => string;
  /**
   * Optionally transform the result of the API and place into a unique variable.
   */
  result?: (resultVariable: string) => {
    returnVariable: string;
    template: string;
  };
}
```

Which looks something like ([source](https://github.com/functionless/functionless/blob/main/src/step-function.ts#L460)):

```ts
this.appSynVtl =  {
  dataSourceId: () => { return /** unique id for the step function, ex: the node addr from the CDK `Construct` **/ }.
  dataSource: () => {
    const ds = new appsync.HttpDataSource(api, dataSourceId, { ... });
    // grant any permissions
    this.grantStartExecution(ds.grantPrincipal); // or start sync
    // return a valid data source
    return ds;
  },
  request: (call, context) => { return /** formatted VTL which correctly calls this step function **/ },
  // optional
  result: (call, context) => { return /** formatted VTL which transforms the output of the step function **/ }
}
```

## Integration Types

| Name               | Key          | Description                                                                                                                                                                    | Implementing Resource(s)                                                                                            | Interface                                                                     |
| ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| App Sync VTL       | `appSyncVtl` | Provides velocity (VTL) and App Sync Pipeline Resolver used with AWS App Sync to invoke the `Integration`.                                                                     | [`AppsyncResolver`](../api/classes/AppsyncResolver.md)                                                              | [`AppSyncVtlIntegration`](../api/interfaces/AppSyncVtlIntegration.md)         |
| EventBus           | `eventBus`   | Provides an [`aws_events.IRuleTarget`](https://docs.aws.amazon.com/cdk/api/v1/docs/@aws-cdk_aws-events.IRuleTarget.html) which is used to forward events to the `Integration`. | [`EventBus`](../api/classes/EventBus.md)                                                                            | [`EventBusTargetIntegration`](../api/interfaces/EventBusTargetIntegration.md) |
| Native Function    | `native`     | Wires up permissions and a clients for Integrations to be invoked by a lambda Function.                                                                                        | [`Function`](../api/classes/Function.md)                                                                            | [`NativeIntegration`](../api/interfaces/NativeIntegration.md)                 |
| Step Functions ASL | `asl`        | Provides a Task definition and in the Amazon States Language to invoke an execution.                                                                                           | [`StepFunction`](../api/classes/StepFunction.md) and [`ExpressStepFunction`](../api/classes/ExpressStepFunction.md) | [None](https://github.com/functionless/functionless/issues/197)               |
