import { App, aws_dynamodb, Stack } from "aws-cdk-lib";
import "jest";
import {
  Table,
  $util,
  AppsyncContext,
  reflect,
  $AWS,
  ITable,
  AnyTable,
} from "../src";
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

/**
 * Enclose calls to $AWS.DynamoDB in a function so that they never run.
 *
 * The contents of this function are for type-level tests only.
 *
 * We use @ts-expect-error to validate that types are inferred properly.
 */
export function typeCheck() {
  let t1: Table<any, any, any> | undefined;
  let t2: Table<Item, "id"> | undefined;
  let t3:
    | Table<
        Record<string | number | symbol, any>,
        string | number | symbol,
        string | number | symbol | undefined
      >
    | undefined;

  t1 = t2;
  t1 = t3;

  // type checks because Table<any, any, any> short circuits
  t2 = t1;
  // @ts-expect-error - Table<Record<string | number | symbol, any>, string | number | symbol, string | number | symbol | undefined> | undefined' is not assignable to type 'Table<Item, "id", undefined> | undefined
  t2 = t3;

  t3 = t1;
  t3 = t2;

  let t4: ITable<any, any, any> | undefined;
  let t5: ITable<Item, "id"> | undefined;
  let t6: AnyTable | undefined;

  t4 = t1;
  t4 = t2;
  t4 = t3;
  t4 = t5;
  t4 = t6;

  // type checks because Table<any, any, any> short circuits
  t5 = t2;
  // @ts-expect-error - Table<Record<string | number | symbol, any>, string | number | symbol, string | number | symbol | undefined> | undefined' is not assignable to type 'ITable<Item, "id", undefined> | undefined
  t5 = t3;
  // type checks because ITable<any, any, any> short circuits
  t5 = t4;
  // @ts-expect-error - 'AnyTable | undefined' is not assignable to type 'ITable<Item, "id", undefined> | undefined'
  t5 = t6;

  t6 = t1;
  t6 = t2;
  t6 = t3;
  t6 = t4;
  t6 = t5;

  // Test1: type checking should work for Table
  $AWS.DynamoDB.GetItem({
    TableName: newTable,
    // @ts-expect-error - missing id prop
    Key: {},
  });
  $AWS.DynamoDB.PutItem({
    TableName: newTable,
    Item: {
      id: {
        S: "",
      },
      name: {
        N: `1`,
      },
      // @ts-expect-error
      nonExistent: {
        S: "",
      },
    },
  });
  $AWS.DynamoDB.DeleteItem({
    TableName: newTable,
    // @ts-expect-error - missing id prop
    Key: {},
  });
  $AWS.DynamoDB.UpdateItem({
    TableName: newTable,
    // @ts-expect-error - missing id prop
    Key: {},
    UpdateExpression: "",
  });

  // Test2: type checking should work for ITable
  $AWS.DynamoDB.GetItem({
    TableName: fromTable,
    // @ts-expect-error - missing id prop
    Key: {},
  });
  $AWS.DynamoDB.PutItem({
    TableName: fromTable,
    Item: {
      id: {
        S: "",
      },
      name: {
        N: `1`,
      },
      // @ts-expect-error
      nonExistent: {
        S: "",
      },
    },
  });
  $AWS.DynamoDB.DeleteItem({
    TableName: fromTable,
    // @ts-expect-error - missing id prop
    Key: {},
  });
  $AWS.DynamoDB.UpdateItem({
    TableName: fromTable,
    // @ts-expect-error - missing id prop
    Key: {},
    UpdateExpression: "",
  });
}

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
