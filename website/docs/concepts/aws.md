---
sidebar_position: 7
---

# AWS SDK

The `$AWS` object contains specialized implementations of each AWS API that do not require the instantiation of any client. Use these static API calls to interact with AWS services from within Functionless. These API calls are known by the Functionless framework and are used to automatically configure integrations between services.

```ts
import { $AWS, Table } from "functionless";

const table = new Table<Item, "pk">(..);

new StepFunction(scope, "Func", (name: string) => {
  // call DynamoDB's DeleteItem API.
  $AWS.DynamoDB.DeleteItem({
    TableName: table,
    Key: {
      name: {
        S: name
      }
    }
  })
});
```

For now, only hand-coded implementations exist for DynamoDB that also integrate with typesafe-dynamodb. To track the DynamoDB progress, see https://github.com/sam-goodwin/functionless/issues/3.

Also review and contribute to this discussion https://github.com/sam-goodwin/functionless/issues/76.

See the [API Reference Documentation](../api/namespaces/AWS.md) for `$AWS`.
