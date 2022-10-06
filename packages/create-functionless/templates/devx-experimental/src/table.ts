import { Table } from "@functionless/aws";

interface TableItem<T extends string> {
  pk: T;
  sk: string;
  type: T;
  id: string;
}

interface Todo extends TableItem<"todo"> {
  message: string;
}

export const AppTable = Table<Todo, "pk", "sk">({
  partitionKey: {
    name: "pk",
    type: "S",
  },
  sortKey: {
    name: "sk",
    type: "S",
  },
});

export default AppTable;
