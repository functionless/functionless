---
sidebar_position: 7
---

# AWS SDK

The `$AWS.SDK` object contains implementations of each AWS API that do not require the instantiation of any client. Use these static API calls to interact with AWS services from within Functionless. These API calls are known by the Functionless framework and are used to automatically configure integrations between services.

```ts
import { $AWS, Table } from "@functionless/aws-constructs";

const table = Table.fromTable<Item, "pk">(..);

new StepFunction(scope, "Func", async (name: string) => {
  await $AWS.SDK.DynamoDB.DeleteItem({
    TableName: table.tableName,
    Key: {
      name: {
        S: name
      }
    }
  }, {
    iam: { resources: [table.tableArn] },
  });
});
```
