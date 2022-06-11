# Event Sources

AWS Step Functions sends [Event Bus events](https://docs.aws.amazon.com/step-functions/latest/dg/cw-events.html) for each machine execution. Functionless provides easy access to them through `EventBus` [Event Sources](../event-bridge/event-sources).

```ts
const succeededExecutions =
  new StepFunction(stack, 'sfn', () => ...)
    .onSucceeded(stack, 'succeeded');
succeededExecutions.pipe(new Function(...));
```

## Event Sources

| Event         | Method              | STATUS    | Description                  |
| ------------- | ------------------- | --------- | ---------------------------- |
| Succeeded     | `onSucceeded()`     | SUCEEDEED | When an execution succeeds.  |
| Failed        | `onFailed()`        | FAILED    | When an execution fails.     |
| Aborted       | `onAborted()`       | ABORTED   | When an execution aborts.    |
| TimeOut       | `onTimedOut()`      | TIMED_OUT | When an execution times out. |
| Started       | `onStarted()`       | RUNNING   | When an execution starts     |
| StatusChanged | `onStatusChanged()` | \<any\>   | When the status changes.     |

## Example Event

```json
{
  "version": "0",
  "id": "315c1398-40ff-a850-213b-158f73e60175",
  "detail-type": "Step Functions Execution Status Change",
  "source": "aws.states",
  "account": "012345678912",
  "time": "2019-02-26T19:42:21Z",
  "region": "us-east-1",
  "resources": [
    "arn:aws:states:us-east-1:012345678912:execution:state-machine-name:execution-name"
  ],
  "detail": {
    "executionArn": "arn:aws:states:us-east-1:012345678912:execution:state-machine-name:execution-name",
    "stateMachineArn": "arn:aws:states:us-east-1:012345678912:stateMachine:state-machine",
    "name": "execution-name",
    "status": "RUNNING",
    "startDate": 1551225271984,
    "stopDate": null,
    "input": "{}",
    "inputDetails": {
      "included": true
    },
    "output": null,
    "outputDetails": null
  }
}
```
