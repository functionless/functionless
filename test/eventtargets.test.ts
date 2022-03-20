import { EventTransformFunction } from "../src/eventbridge";
import { Function } from "../src/function";

import { reflect, Table } from "../src";
import { aws_events_targets } from "aws-cdk-lib";

test("", () => {
  const lambda = new Function<(arg1: string) => void>(null as any);
  const table = new Table(null as any);
  table.deleteItem
  ebEventTargetTestCase(
    reflect<EventTransformFunction>((event) => lambda(event.source)),
    new aws_events_targets.LambdaFunction(null as any, {
      event: {},
    })
  );
});
