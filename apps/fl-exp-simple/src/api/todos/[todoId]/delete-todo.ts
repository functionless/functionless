// BUG: Uncomment this and this line and `putEvents` call bellow
//      to trigger the function serializer error.
// import Events from "../event-bus";

import { PathParam } from "@functionless/aws-apigateway";
import { LambdaFunction } from "@functionless/aws-lambda";
import { Method } from "@functionless/aws-apigateway";
import { MyDatabase } from "../../../table";

export default Method<{
  todoId: PathParam<string>;
}>(
  {
    httpMethod: "DELETE",
  },
  LambdaFunction(async (request) => {
    await MyDatabase.delete({
      Key: {
        pk: "todo",
        sk: request["todoId"],
      },
    });

    return {
      statusCode: 200,
      body: "DELETED",
    };
  })
);
