import { App, aws_dynamodb, Stack } from "aws-cdk-lib";
import "jest";
import { Table, $util, AppsyncContext, reflect } from "../src";
import { appsyncTestCase } from "./util";

interface Item {
  id: string;
  name: number;
}

const app = new App({ autoSynth: false });
const stack = new Stack(app, "stack");

const fromTable = Table.fromTable<Item, "id">(
  new aws_dynamodb.Table(stack, "FromTable", {
    partitionKey: {
      name: "id",
      type: aws_dynamodb.AttributeType.STRING,
    },
  })
);

const newTable = new Table<Item, "id">(stack, "NewTable", {
  partitionKey: {
    name: "id",
    type: aws_dynamodb.AttributeType.STRING,
  },
});

test.each([fromTable, newTable])("get item", (table) => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ id: string }>): Item | undefined => {
      return table.getItem({
        key: {
          id: {
            S: context.arguments.id,
          },
        },
      });
    })
  );
});

test.each([fromTable, newTable])(
  "get item and set consistentRead:true",
  (table) => {
    appsyncTestCase(
      reflect((context: AppsyncContext<{ id: string }>): Item | undefined => {
        return table.getItem({
          key: {
            id: {
              S: context.arguments.id,
            },
          },
          consistentRead: true,
        });
      })
    );
  }
);

test.each([fromTable, newTable])("put item", (table) => {
  appsyncTestCase(
    reflect(
      (
        context: AppsyncContext<{ id: string; name: number }>
      ): Item | undefined => {
        return table.putItem({
          key: {
            id: {
              S: context.arguments.id,
            },
          },
          attributeValues: {
            name: {
              N: `${context.arguments.name}`,
            },
          },
          condition: {
            expression: "#name = :val",
            expressionNames: {
              "#name": "name",
            },
            expressionValues: {
              ":val": {
                S: context.arguments.id,
              },
            },
          },
        });
      }
    )
  );
});

test.each([fromTable, newTable])("update item", (table) => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ id: string }>): Item | undefined => {
      return table.updateItem({
        key: {
          id: {
            S: context.arguments.id,
          },
        },
        update: {
          expression: "#name = #name + 1",
          expressionNames: {
            "#name": "name",
          },
        },
      });
    })
  );
});

test.each([fromTable, newTable])("delete item", (table) => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ id: string }>): Item | undefined => {
      return table.deleteItem({
        key: {
          id: {
            S: context.arguments.id,
          },
        },
        condition: {
          expression: "#name = #name + 1",
          expressionNames: {
            "#name": "name",
          },
        },
      });
    })
  );
});

test.each([fromTable, newTable])("query", (table) => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ id: string; sort: number }>): Item[] => {
      return table.query({
        query: {
          expression: "id = :id and #name = :val",
          expressionNames: {
            "#name": "name",
          },
          expressionValues: {
            ":id": $util.dynamodb.toDynamoDB(context.arguments.id),
            ":val": $util.dynamodb.toDynamoDB(context.arguments.sort),
          },
        },
      }).items;
    })
  );
});
