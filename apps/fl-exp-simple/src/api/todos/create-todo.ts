import { LambdaFunction, Method } from "fl-exp";
import * as uuid from "uuid";
import MyDatabase from "../../table";

export default LambdaFunction(async (request: CreateTodoRequest) => {
  const id = uuid.v4();

  await MyDatabase.put({
    Item: {
      pk: "todo",
      sk: id,
      message: request.message,
    },
  });

  return {
    statusCode: 200,
    body: id,
  };
});

export interface CreateTodoRequest {
  message: string;
}
