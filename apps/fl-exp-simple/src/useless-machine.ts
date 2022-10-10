import { StepFunction } from "@functionless/aws-stepfunctions";

import MyDatabase from "./table";

export default StepFunction(async (input: { todoId: string }) => {
  await StepFunction.waitSeconds(10);

  await MyDatabase.attributes.delete({
    Key: {
      pk: {
        S: "todo",
      },
      sk: {
        S: input.todoId,
      },
    },
  });
});
