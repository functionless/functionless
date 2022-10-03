# Event Sources

AWS Lambda Async Invocation supports setting an `EventBus` as the destination. [Event Bus events](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html#invocation-async-destinations) are sent based on the configuration. Functionless provides easy access to them through `EventBus` [Event Sources](../event-bridge/event-sources).

```ts
const bus = EventBus.default(stack);
const succeededInvocations = new Function(stack, 'func', {
    // the bus used for the rule must be configured as the destination.
    onSuccess: bus,
    onFailure: bus
  }, () => ...)
  .onSuccess(bus, 'succeeded');
succeededInvocations.pipe(new Function(...));
```

:::caution
The `Function` must configure the async invocation destination for the event being consumed in order for that event to exist and the destination must be the same `EventBus` being used to consume the event. `new Function(stack, id, { onSuccess: bus }, async () => {});`
:::

## Event Sources

| Event   | Method        | Detail Type                                 | Description                                             |
| ------- | ------------- | ------------------------------------------- | ------------------------------------------------------- |
| Success | `onSuccess()` | Lambda Function Invocation Result - Success | When an invocation succeeds.                            |
| Failure | `onFailure()` | Lambda Function Invocation Result - Failure | When an invocation failure (retry limit, timeout, etc). |

## Example Event

```json
{
  "version": "0",
  "id": "315c1398-40ff-a850-213b-158f73e60175",
  "detail-type": "Lambda Function Invocation Result - Failure",
  "source": "lambda",
  "account": "012345678912",
  "time": "2019-02-26T19:42:21Z",
  "region": "us-east-1",
  "resources": ["arn:aws:lambda:us-east-2:123456789012:function:my-function"],
  "detail": {
    "version": "1.0",
    "timestamp": "2019-11-14T18:16:05.568Z",
    "requestContext": {
      "requestId": "e4b46cbf-b738-xmpl-8880-a18cdf61200e",
      "functionArn": "arn:aws:lambda:us-east-2:123456789012:function:my-function:$LATEST",
      "condition": "RetriesExhausted",
      "approximateInvokeCount": 3
    },
    "requestPayload": {
      "ORDER_IDS": [
        "9e07af03-ce31-4ff3-xmpl-36dce652cb4f",
        "637de236-e7b2-464e-xmpl-baf57f86bb53",
        "a81ddca6-2c35-45c7-xmpl-c3a03a31ed15"
      ]
    },
    "responseContext": {
      "statusCode": 200,
      "executedVersion": "$LATEST",
      "functionError": "Unhandled"
    },
    "responsePayload": {
      "errorMessage": "RequestId: e4b46cbf-b738-xmpl-8880-a18cdf61200e Process exited before completing request"
    }
  }
}
```
