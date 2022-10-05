import type { AttributeType, BillingMode } from "aws-cdk-lib/aws-dynamodb";
import { Table } from "fl-exp";

interface TableItem<T extends string> {
  pk: T;
  sk: string;
}

export interface Todo extends TableItem<"todo"> {
  message: string;
}

export const MyDatabase = Table<Todo, "pk", "sk">({
  partitionKey: {
    name: "pk",
    type: "S" as AttributeType,
  },
  sortKey: {
    name: "sk",
    type: "S" as AttributeType,
  },
  billingMode: "PAY_PER_REQUEST" as BillingMode,
});

export default MyDatabase;
