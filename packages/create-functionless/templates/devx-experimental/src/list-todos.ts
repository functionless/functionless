import { LambdaFunction } from "@functionless/aws";

import { AppTable } from "./table";

export default LambdaFunction(async (event: {}) => {
  const response = AppTable.query({
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
      id: item.id.S,
      message: item.message.S,
    };
  });
});
