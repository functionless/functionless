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

const table = new Table<Item, "id">(
  new aws_dynamodb.Table(stack, "Table", {
    partitionKey: {
      name: "id",
      type: aws_dynamodb.AttributeType.STRING,
    },
  })
);

test("get item", () =>
  appsyncTestCase(
    reflect(
      async (
        context: AppsyncContext<{ id: string }>
      ): Promise<Item | undefined> => {
        return table.getItem({
          key: {
            id: {
              S: context.arguments.id,
            },
          },
        });
      }
    )
  ));

test("get item and set consistentRead:true", () =>
  appsyncTestCase(
    reflect(
      async (
        context: AppsyncContext<{ id: string }>
      ): Promise<Item | undefined> => {
        return table.getItem({
          key: {
            id: {
              S: context.arguments.id,
            },
          },
          consistentRead: true,
        });
      }
    )
  ));

test("put item", () =>
  appsyncTestCase(
    reflect(
      async (
        context: AppsyncContext<{ id: string; name: number }>
      ): Promise<Item | undefined> => {
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
  ));

test("update item", () =>
  appsyncTestCase(
    reflect(
      async (
        context: AppsyncContext<{ id: string }>
      ): Promise<Item | undefined> => {
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
      }
    )
  ));

test("delete item", () =>
  appsyncTestCase(
    reflect(
      async (
        context: AppsyncContext<{ id: string }>
      ): Promise<Item | undefined> => {
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
      }
    )
  ));

test("query", () =>
  appsyncTestCase(
    reflect(
      async (
        context: AppsyncContext<{ id: string; sort: number }>
      ): Promise<Item[]> => {
        return (
          await table.query({
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
          })
        ).items;
      }
    )
  ));
