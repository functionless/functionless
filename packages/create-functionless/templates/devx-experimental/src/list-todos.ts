import { LambdaFunction } from "@functionless/aws-lambda";

import { AppTable } from "./table";

export default LambdaFunction(async (event: {}) => {
  const response = await AppTable.query({
    KeyConditionExpression: "#pk = :pk",
    ExpressionAttributeNames: {
      "#pk": "pk",
    },
    ExpressionAttributeValues: {
      ":pk": "todo",
    },
  });

  return (response.Items ?? []).map((item) => {
    return {
      id: item.id,
      message: item.message,
    };
  });
});
