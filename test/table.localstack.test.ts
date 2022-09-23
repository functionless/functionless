import path from "path";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { aws_dynamodb, Duration } from "aws-cdk-lib";
import AWS from "aws-sdk";
import {
  $util,
  AppsyncResolver,
  ExpressStepFunction,
  Function,
  FunctionProps,
  Table,
} from "../src";
import {
  RuntimeTestClients,
  runtimeTestExecutionContext,
  runtimeTestSuite,
} from "./runtime";

// inject the localstack client config into the lambda clients
// without this configuration, the functions will try to hit AWS proper
const localstackClientConfig: FunctionProps = {
  timeout: Duration.seconds(20),
  clientConfigRetriever:
    runtimeTestExecutionContext.deployTarget === "AWS"
      ? undefined
      : () => ({
          endpoint: `http://${process.env.LOCALSTACK_HOSTNAME}:4566`,
        }),
};

interface BaseItem<Type extends string, Version extends number> {
  type: Type;
  version: Version;
  pk: `${Type}|${Version}|${string}`;
  sk: string;
}

type Item = Item1v1 | Item1v2 | Item2;

interface Item1v1 extends BaseItem<"Item1", 1> {
  data1: {
    key: string;
  };
}
interface Item1v2 extends BaseItem<"Item1", 2> {
  data: {
    key: string;
  };
}

interface Item2 extends BaseItem<"Item2", 1> {
  data2: {
    key: string;
  };
}

runtimeTestSuite("tableStack", (t: any) => {
  // const test: (
  //   name: string,
  //   body: (
  //     scope: Construct,
  //     role: Role
  //   ) => {
  //     outputs: {
  //       tableArn: string;
  //       functionArn: string;
  //     };
  //   }
  //   // for some reason, adding this variable breaks types of Table
  //   // after: any
  // ) => void = t;

  const test = t;

  test(
    "Lambda all DynamoDB APIs",
    (scope: any, role: any) => {
      const table = new Table<Item, "pk", "sk">(scope, "JsonSecret", {
        partitionKey: {
          name: "pk",
          type: aws_dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: "sk",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });

      const func = new Function(
        scope,
        "Func",
        {
          ...localstackClientConfig,
        },
        async ([item1, item2]: [Item1v1, Item2]) => {
          // clean the table
          while (true) {
            const items = await table.scan({
              ConsistentRead: true,
            });
            if (items.Items?.length) {
              await table.batchWrite({
                RequestItems: items.Items.map((item) => ({
                  DeleteRequest: {
                    Key: {
                      pk: item.pk,
                      sk: item.sk,
                    },
                  },
                })),
              });
            } else {
              break;
            }
          }

          await table.put({
            Item: item1,
          });

          const gotItem = await table.get({
            Key: {
              pk: item1.pk,
              sk: item1.sk,
            },
          });

          const query = await table.query({
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: {
              ":pk": item1.pk,
            },
            ConsistentRead: true,
          });

          const scan = await table.scan({
            ConsistentRead: true,
          });

          const batch = await table.batchGet({
            Keys: [
              {
                pk: item1.pk,
                sk: item1.sk,
              },
            ],
          });

          const updated = await table.update({
            Key: {
              pk: item1.pk,
              sk: item1.sk,
            },
            UpdateExpression: "SET data1 = :data",
            ExpressionAttributeValues: {
              ":data": {
                key: "value2",
              },
            },
            ReturnValues: "ALL_OLD",
          });

          const deleted = await table.delete({
            Key: {
              pk: item1.pk,
              sk: item1.sk,
            },
            ReturnValues: "ALL_OLD",
          });

          await table.put({
            Item: item2,
          });

          let batchWrite = await table.batchWrite({
            RequestItems: [
              {
                DeleteRequest: {
                  Key: {
                    pk: item2.pk,
                    sk: item2.sk,
                  },
                },
              },
              {
                PutRequest: {
                  Item: {
                    ...item2,
                    pk: "Item2|1|pk2-modified",
                  },
                },
              },
            ],
          });

          while (batchWrite.UnprocessedItems) {
            batchWrite = await table.batchWrite({
              RequestItems: batchWrite.UnprocessedItems,
            });
          }

          const item2Modified = await table.get({
            Key: {
              pk: "Item2|1|pk2-modified",
              sk: item2.sk,
            },
          });

          await table.transactWrite({
            TransactItems: [
              {
                Put: {
                  Item: item1,
                },
              },
              {
                Put: {
                  Item: item2,
                },
              },
            ],
          });

          const transactGet = await table.transactGet({
            TransactItems: [
              {
                Get: {
                  Key: {
                    pk: item1.pk,
                    sk: item1.sk,
                  },
                },
              },
              {
                Get: {
                  Key: {
                    pk: item2.pk,
                    sk: item2.sk,
                  },
                },
              },
            ],
          });

          return [
            gotItem.Item ?? null,
            ...(scan.Items ?? []),
            ...(query.Items ?? []),
            ...(batch.Items ?? []),
            updated.Attributes ?? null,
            deleted.Attributes ?? null,
            item2Modified.Item,
            ...(transactGet.Items ?? []),
          ];
        }
      );
      func.resource.grantInvoke(role);
      table.resource.grantFullAccess(role);
      return {
        outputs: {
          tableArn: table.resource.tableArn,
          functionArn: func.resource.functionArn,
        },
      };
    },
    async (context: any, clients: RuntimeTestClients) => {
      const item1: Item1v1 = {
        type: "Item1",
        version: 1,
        pk: "Item1|1|pk1",
        sk: "sk2",
        data1: {
          key: "value",
        },
      };

      const item2: Item2 = {
        type: "Item2",
        version: 1,
        pk: "Item2|1|pk2",
        sk: "sk2",
        data2: {
          key: "value2",
        },
      };

      const response = await clients.lambda
        .invoke({
          FunctionName: context.functionArn,
          Payload: JSON.stringify([item1, item2]),
        })
        .promise();

      expect(JSON.parse(response.Payload as string)).toEqual([
        item1,
        item1,
        item1,
        item1,
        item1,
        {
          ...item1,
          data1: {
            key: "value2",
          },
        },
        {
          ...item2,
          pk: "Item2|1|pk2-modified",
        },
        item1,
        item2,
      ]);
    }
  );

  test(
    "Step Function all DynamoDB APIs",
    (scope: any, role: any) => {
      const table = new Table<Item, "pk", "sk">(scope, "JsonSecret", {
        partitionKey: {
          name: "pk",
          type: aws_dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: "sk",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });

      const func = new ExpressStepFunction(
        scope,
        "Func",
        {
          ...localstackClientConfig,
        },
        async ([item1, item2]: [Item1v1, Item2]) => {
          // clean the table
          while (true) {
            const items = await table.attributes.scan({
              ConsistentRead: true,
            });
            if (items.Items?.length) {
              await table.attributes.batchWrite({
                RequestItems: items.Items.map((item) => ({
                  DeleteRequest: {
                    Key: {
                      pk: item.pk,
                      sk: item.sk,
                    },
                  },
                })),
              });
            } else {
              break;
            }
          }

          const item1Attributes = {
            type: {
              S: item1.type,
            },
            pk: {
              S: item1.pk,
            },
            sk: {
              S: item1.sk,
            },
            version: {
              N: `1`,
            },
            data1: {
              M: {
                key: {
                  S: item1.data1.key,
                },
              },
            },
          } as const;

          await table.attributes.put({
            Item: item1Attributes,
          });

          const gotItem = await table.attributes.get({
            Key: {
              pk: {
                S: item1.pk,
              },
              sk: {
                S: item1.sk,
              },
            },
          });

          const query = await table.attributes.query({
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: {
              ":pk": {
                S: item1.pk,
              },
            },
            ConsistentRead: true,
          });

          const scan = await table.attributes.scan({
            ConsistentRead: true,
          });

          const batch = await table.attributes.batchGet({
            Keys: [
              {
                pk: {
                  S: item1.pk,
                },
                sk: {
                  S: item1.sk,
                },
              },
            ],
          });

          const updated = await table.attributes.update({
            Key: {
              pk: {
                S: item1.pk,
              },
              sk: {
                S: item1.sk,
              },
            },
            UpdateExpression: "SET data1 = :data",
            ExpressionAttributeValues: {
              ":data": {
                M: {
                  key: {
                    S: "value2",
                  },
                },
              },
            },
            ReturnValues: "ALL_OLD",
          });

          const deleted = await table.attributes.delete({
            Key: {
              pk: {
                S: item1.pk,
              },
              sk: {
                S: item1.sk,
              },
            },
            ReturnValues: "ALL_OLD",
          });

          const item2Attributes = {
            type: {
              S: item2.type,
            },
            pk: {
              S: item2.pk,
            },
            sk: {
              S: item2.sk,
            },
            data2: {
              M: {
                key: {
                  S: item2.data2.key,
                },
              },
            },
            version: {
              N: `${item2.version}`,
            },
          } as const;

          await table.attributes.put({
            Item: item2Attributes,
          });

          let batchWrite = await table.attributes.batchWrite({
            RequestItems: [
              {
                DeleteRequest: {
                  Key: {
                    pk: {
                      S: item2.pk,
                    },
                    sk: {
                      S: item2.sk,
                    },
                  },
                },
              },
              {
                PutRequest: {
                  Item: {
                    pk: {
                      S: "Item2|1|pk2-modified",
                    },
                    sk: {
                      S: item2.sk,
                    },
                    type: {
                      S: item2.type,
                    },
                    version: {
                      N: `${item2.version}`,
                    },
                    data2: {
                      M: {
                        key: {
                          S: item2.data2.key,
                        },
                      },
                    },
                  },
                },
              },
            ],
          });

          while (
            batchWrite.UnprocessedItems &&
            batchWrite.UnprocessedItems.length > 0
          ) {
            batchWrite = await table.attributes.batchWrite({
              RequestItems: batchWrite.UnprocessedItems,
            });
          }

          const item2Modified = await table.attributes.get({
            Key: {
              pk: {
                S: "Item2|1|pk2-modified",
              },
              sk: {
                S: item2.sk,
              },
            },
          });

          await table.attributes.transactWrite({
            TransactItems: [
              {
                Put: {
                  Item: item1Attributes,
                },
              },
              {
                Put: {
                  Item: item2Attributes,
                },
              },
            ],
          });

          const transactGet = await table.attributes.transactGet({
            TransactItems: [
              {
                Get: {
                  Key: {
                    pk: item1Attributes.pk,
                    sk: item1Attributes.sk,
                  },
                },
              },
              {
                Get: {
                  Key: {
                    pk: item2Attributes.pk,
                    sk: item2Attributes.sk,
                  },
                },
              },
            ],
          });

          return [
            gotItem.Item ?? null,
            scan.Items?.[0] ?? null,
            query.Items?.[0] ?? null,
            batch.Items?.[0] ?? null,
            updated.Attributes ?? null,
            deleted.Attributes ?? null,
            item2Modified.Item ?? null,
            transactGet.Items[0] ?? null,
            transactGet.Items[1] ?? null,
          ];
        }
      );
      func.resource.grantStartSyncExecution(role);
      table.resource.grantFullAccess(role);
      return {
        outputs: {
          tableArn: table.resource.tableArn,
          stateMachineArn: func.resource.stateMachineArn,
        },
      };
    },
    async (context: any, clients: RuntimeTestClients) => {
      const item1: Item1v1 = {
        type: "Item1",
        version: 1,
        pk: "Item1|1|pk1",
        sk: "sk2",
        data1: {
          key: "value",
        },
      };

      const item2: Item2 = {
        type: "Item2",
        version: 1,
        pk: "Item2|1|pk2",
        sk: "sk2",
        data2: {
          key: "value2",
        },
      };

      const response = await clients.stepFunctions
        .startSyncExecution({
          stateMachineArn: context.stateMachineArn,
          input: JSON.stringify([item1, item2]),
        })
        .promise();

      if (!response.output) {
        throw new Error("response.output is undefined");
      }

      expect(JSON.parse(response.output)).toEqual([
        AWS.DynamoDB.Converter.marshall(item1),
        AWS.DynamoDB.Converter.marshall(item1),
        AWS.DynamoDB.Converter.marshall(item1),
        AWS.DynamoDB.Converter.marshall(item1),
        AWS.DynamoDB.Converter.marshall(item1),
        {
          ...AWS.DynamoDB.Converter.marshall(item1),
          data1: {
            M: {
              key: {
                S: "value2",
              },
            },
          },
        },
        {
          ...AWS.DynamoDB.Converter.marshall(item2),
          pk: {
            S: "Item2|1|pk2-modified",
          },
        },
        AWS.DynamoDB.Converter.marshall(item1),
        AWS.DynamoDB.Converter.marshall(item2),
      ]);
    }
  );

  // test("appsync resolvers", (scope: any, role: any) => {
  //   const table = new Table<Item, "pk", "sk">(scope, "JsonSecret", {
  //     partitionKey: {
  //       name: "pk",
  //       type: aws_dynamodb.AttributeType.STRING,
  //     },
  //     sortKey: {
  //       name: "sk",
  //       type: aws_dynamodb.AttributeType.STRING,
  //     },
  //   });

  //   const api = new appsync.GraphqlApi(scope, "Api", {
  //     schema: appsync.Schema.fromAsset(
  //       path.join(__dirname, "table.runtime.gql")
  //     ),
  //     name: "test-api",
  //   });

  //   new AppsyncResolver<
  //     {
  //       items: Item[];
  //     },
  //     Item[]
  //   >(
  //     api,
  //     "update",
  //     {
  //       typeName: "Mutation",
  //       fieldName: "update",
  //     },
  //     async ($context) => {
  //       await table.appsync.transactWrite(
  //         $context.arguments.items.map((item) => {
  //           const { pk, sk, ...attributes } = item;
  //           return {
  //             operation: "PutItem",
  //             key: {
  //               pk: {
  //                 S: pk,
  //               },
  //               sk: {
  //                 S: sk,
  //               },
  //             },
  //             attributeValues: $util.dynamodb.toMapValues(attributes),
  //           };
  //         })
  //       );

  //       return $context.arguments.items;
  //     }
  //   );
  // });
});
