import { App, aws_dynamodb, Stack } from "aws-cdk-lib";
import "jest";
import { Table, $util, AppsyncContext, ITable, AnyTable } from "../src";
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

const fromTableSortKey = Table.fromTable<Item, "id", "name">(
  new aws_dynamodb.Table(stack, "FromTableSortKey", {
    partitionKey: {
      name: "id",
      type: aws_dynamodb.AttributeType.STRING,
    },
    sortKey: {
      name: "name",
      type: aws_dynamodb.AttributeType.NUMBER,
    },
  })
);

const newTableSortKey = new Table<Item, "id", "name">(
  stack,
  "NewTableSortKey",
  {
    partitionKey: {
      name: "id",
      type: aws_dynamodb.AttributeType.STRING,
    },
    sortKey: {
      name: "name",
      type: aws_dynamodb.AttributeType.NUMBER,
    },
  }
);

/**
 * Enclose calls to $AWS.DynamoDB in a function so that they never run.
 *
 * The contents of this function are for type-level tests only.
 *
 * We use @ts-expect-error to validate that types are inferred properly.
 */
export async function typeCheck() {
  let t1: Table<any, any, any> | undefined;
  let t2: Table<Item, "id"> | undefined;
  let t3: Table<Record<string, any>, string, string | undefined> | undefined;

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
  await newTable.get.attributes({
    // @ts-expect-error - missing id prop
    Key: {},
  });
  await newTable.put.attributes({
    id: {
      S: "",
    },
    name: {
      N: `1`,
    },
    // // @ts-expect-error - this test broke because `PutItem.attributes<I extends FormatObject<Item, JsonFormat.AttributeValue>>`
    nonExistent: {
      S: "",
    },
  });
  await newTable.delete.attributes({
    // @ts-expect-error - missing id prop
    Key: {},
  });
  await newTable.update.attributes({
    // @ts-expect-error - missing id prop
    Key: {},
    UpdateExpression: "",
  });

  // Test2: type checking should work for ITable
  // @ts-expect-error - missing id prop
  await fromTable.get({});
  await fromTable.put.attributes({
    id: {
      S: "",
    },
    name: {
      N: `1`,
    },
    // // @ts-expect-error - this test broke because `PutItem.attributes<I extends FormatObject<Item, JsonFormat.AttributeValue>>`
    nonExistent: {
      S: "",
    },
  });
  await fromTable.delete({
    // @ts-expect-error - missing id prop
    Key: {},
  });
  await fromTable.update({
    // @ts-expect-error - missing id prop
    Key: {},
    UpdateExpression: "",
  });
}

/**
 * Enclose calls to $AWS.DynamoDB in a function so that they never run.
 *
 * The contents of this function are for type-level tests only.
 *
 * We use @ts-expect-error to validate that types are inferred properly.
 */
export async function typeCheckSortKey() {
  let t1: Table<any, any, any> | undefined;
  let t2: Table<Item, "id", "name"> | undefined;
  let t3: Table<Record<string, any>, string, string | undefined> | undefined;

  t1 = t2;
  t1 = t3;

  // type checks because Table<any, any, any> short circuits
  t2 = t1;
  // @ts-expect-error - Table<Record<string | number | symbol, any>, string | number | symbol, string | number | symbol | undefined> | undefined' is not assignable to type 'Table<Item, "id", undefined> | undefined
  t2 = t3;

  t3 = t1;
  t3 = t2;

  let t4: ITable<any, any, any> | undefined;
  let t5: ITable<Item, "id", "name"> | undefined;
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
  // @ts-expect-error - missing id prop
  await newTable.get.attributes({});
  await newTable.put.attributes({
    id: {
      S: "",
    },
    name: {
      N: `1`,
    },
    // // @ts-expect-error - this test broke because `PutItem.attributes<I extends FormatObject<Item, JsonFormat.AttributeValue>>`
    nonExistent: {
      S: "",
    },
  });

  await newTable.delete.attributes({
    // @ts-expect-error - missing id prop
    Key: {},
  });
  await newTable.delete.attributes({
    Table: newTable,
    // @ts-expect-error - missing id prop
    Key: {},
    UpdateExpression: "",
  });

  // Test2: type checking should work for ITable
  // @ts-expect-error - missing id prop
  await fromTable.get.attributes({});

  await fromTable.put.attributes({
    id: {
      S: "",
    },
    name: {
      N: `1`,
    },
    // // @ts-expect-error - this test broke because `PutItem.attributes<I extends FormatObject<Item, JsonFormat.AttributeValue>>`
    nonExistent: {
      S: "",
    },
  });
  await fromTable.delete.attributes({
    // @ts-expect-error - missing id prop
    Key: {},
  });
  await fromTable.delete.attributes({
    // @ts-expect-error - missing id prop
    Key: {},
    UpdateExpression: "",
  });
}

test.each([fromTable, newTable])("get item", (table) => {
  appsyncTestCase(
    async (
      context: AppsyncContext<{ id: string }>
    ): Promise<Item | undefined> => {
      return table.get.appsync({
        key: {
          id: {
            S: context.arguments.id,
          },
        },
      });
    }
  );
});

test.each([fromTableSortKey, newTableSortKey])("get item", (table) => {
  appsyncTestCase(async (context: AppsyncContext<{ id: string }>) => {
    return table.get.appsync({
      key: {
        id: {
          S: context.arguments.id,
        },
        name: {
          N: "1",
        },
      },
    });
  });
});

test.each([fromTable, newTable])(
  "get item and set consistentRead:true",
  (table) => {
    appsyncTestCase(
      async (
        context: AppsyncContext<{ id: string }>
      ): Promise<Item | undefined> => {
        return table.get.appsync({
          key: {
            id: {
              S: context.arguments.id,
            },
          },
          consistentRead: true,
        });
      }
    );
  }
);

test.each([fromTableSortKey, newTableSortKey])(
  "get item and set consistentRead:true",
  (table) => {
    appsyncTestCase(async (context: AppsyncContext<{ id: string }>) => {
      return table.get.appsync({
        key: {
          id: {
            S: context.arguments.id,
          },
          name: {
            N: "1",
          },
        },
        consistentRead: true,
      });
    });
  }
);

test.each([fromTable, newTable])("put item", (table) => {
  appsyncTestCase(
    async (
      context: AppsyncContext<{ id: string; name: number }>
    ): Promise<Item | undefined> => {
      return table.put.appsync({
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
  );
});

test.each([fromTableSortKey, newTableSortKey])("put item", (table) => {
  appsyncTestCase(
    async (context: AppsyncContext<{ id: string; name: number }>) => {
      return table.put.appsync({
        key: {
          id: {
            S: context.arguments.id,
          },
          name: {
            N: "1",
          },
        },
        attributeValues: {},
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
  );
});

test.each([fromTable, newTable])("update item", (table) => {
  appsyncTestCase(
    async (
      context: AppsyncContext<{ id: string }>
    ): Promise<Item | undefined> => {
      return table.update.appsync({
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
  );
});

test.each([fromTableSortKey, newTableSortKey])("update item", (table) => {
  appsyncTestCase(async (context: AppsyncContext<{ id: string }>) => {
    return table.update.appsync({
      key: {
        id: {
          S: context.arguments.id,
        },
        name: {
          N: "1",
        },
      },
      update: {
        expression: "#name = #name + 1",
        expressionNames: {
          "#name": "name",
        },
      },
    });
  });
});

test.each([fromTableSortKey, newTableSortKey])("update item", (table) => {
  appsyncTestCase(
    async (
      context: AppsyncContext<{ id: string }>
    ): Promise<Item | undefined> => {
      return table.update.appsync({
        key: {
          id: {
            S: context.arguments.id,
          },
          name: {
            N: "1",
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
  );
});

test.each([fromTable, newTable])("delete item", (table) => {
  appsyncTestCase(
    async (
      context: AppsyncContext<{ id: string }>
    ): Promise<Item | undefined> => {
      return table.delete.appsync({
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
  );
});

test.each([fromTableSortKey, newTableSortKey])("delete item", (table) => {
  appsyncTestCase(async (context: AppsyncContext<{ id: string }>) => {
    return table.delete.appsync({
      key: {
        id: {
          S: context.arguments.id,
        },
        name: {
          N: "1",
        },
      },
      condition: {
        expression: "#name = #name + 1",
        expressionNames: {
          "#name": "name",
        },
      },
    });
  });
});

test.each([fromTable, newTable])("query", (table) => {
  appsyncTestCase(
    async (
      context: AppsyncContext<{ id: string; sort: number }>
    ): Promise<Item[]> => {
      return (
        await table.query.appsync({
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
  );
});

test.each([fromTableSortKey, newTableSortKey])("query", (table) => {
  appsyncTestCase(
    async (context: AppsyncContext<{ id: string; sort: number }>) => {
      return (
        await table.query.appsync({
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
  );
});
