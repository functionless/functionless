import "jest";
import { aws_events, Duration, Stack } from "aws-cdk-lib";
import { Function } from "../src";

test("should not create new resources in lambda", async () => {
  await expect(async () => {
    const stack = new Stack();
    new Function(
      stack,
      "function",
      {
        timeout: Duration.seconds(20),
      },
      async () => {
        const bus = new aws_events.EventBus(stack, "busbus");
        return bus.eventBusArn;
      }
    );
    await Promise.all(Function.promises);
  }).rejects.toThrow(
    `Cannot initialize new CDK resources in a runtime function.`
  );
});
