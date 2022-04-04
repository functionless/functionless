# $AWS

The `$AWS` object provides integration functions for the AWS SDK that can be called from within a [Step Function](./4-Step-Functions.md).

```ts
import { $AWS, Table } from "functionless";

const table = new Table<Item, "pk">(new aws_dynamodb.Table(..));

new StepFunction(stack, "Func", (name: string) => {
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
