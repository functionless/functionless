import { LambdaFunction } from "@functionless/aws";
import * as uuid from "uuid";

import { AppTable } from "./table";

export default LambdaFunction(async (event: { message: string }) => {
  const id = uuid.v4();
  await AppTable.put({
    Item: {
      pk: {
        S: "todo",
      },
      sk: {
        S: id,
      },
      id: {
        S: id,
      },
      message: {
        S: event.message,
      },
      type: {
        S: "todo",
      },
    },
  });

  return "CREATED";
});
