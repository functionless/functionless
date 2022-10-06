import { LambdaFunction, Method } from "@functionless/fl-exp";
import * as uuid from "uuid";
import MyDatabase from "../../table";

export default Method<CreateTodoRequest>(
  {
    httpMethod: "POST",
  },
  LambdaFunction(async (request) => {
    const id = uuid.v4();

    await MyDatabase.put({
      Item: {
        pk: "todo",
        sk: id,
        id,
        type: "todo",
        message: request.message,
      },
    });

    return {
      statusCode: 200,
      body: id,
    };
  })
);

export interface CreateTodoRequest {
  message: string;
}
