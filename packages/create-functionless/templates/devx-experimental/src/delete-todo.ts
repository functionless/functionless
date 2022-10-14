import { LambdaFunction } from "@functionless/aws-lambda";
import { AppTable } from "./table";

export default LambdaFunction(async (event: { id: string }) => {
  await AppTable.delete({
    Key: {
      pk: "todo",
      sk: event.id,
    },
  });

  return "DELETED";
});
