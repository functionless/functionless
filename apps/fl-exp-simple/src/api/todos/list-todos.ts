import { LambdaFunction, Method } from "@functionless/aws";

import { MyDatabase } from "../../table";

export default Method(
  {
    httpMethod: "GET",
  },
  LambdaFunction(async () => {
    const result = await MyDatabase.query({
      KeyConditionExpression: "#pk = :pk",
      ExpressionAttributeNames: {
        "#pk": "pk",
      },
      ExpressionAttributeValues: {
        ":pk": "todo",
      },
    });

    const response = {
      items: (result.Items ?? []).map((item) => {
        return {
          id: item.id,
          message: item.message,
        };
      }),
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  })
);
