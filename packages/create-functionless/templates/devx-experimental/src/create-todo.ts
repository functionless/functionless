import { LambdaFunction } from "@functionless/aws-lambda";
import * as uuid from "uuid";

import { AppTable } from "./table";

export default LambdaFunction(async (event: { message: string }) => {
  const id = uuid.v4();
  await AppTable.put({
    Item: {
      pk: "todo",
      sk: id,
      id: id,
      message: event.message,
      type: "todo",
    },
  });

  return "CREATED";
});
