import path from "path";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import AWSAppSyncClient from "aws-appsync";
import { aws_dynamodb, aws_iam, Duration, RemovalPolicy } from "aws-cdk-lib";
import AWS from "aws-sdk";
import "cross-fetch/polyfill";
import gql from "graphql-tag";
import { $util, AppsyncResolver } from "@functionless/aws-appsync-constructs";
import { Table } from "@functionless/aws-dynamodb-constructs";
import { ExpressStepFunction } from "@functionless/aws-stepfunctions-constructs";
import { Function, FunctionProps } from "@functionless/aws-lambda-constructs";
import {
  getTestRole,
  RuntimeTestClients,
  runtimeTestExecutionContext,
  runtimeTestSuite,
} from "@functionless/test";

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
        removalPolicy: RemovalPolicy.DESTROY,
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

          // no-op for type-level checking
          () => {
            query.LastEvaluatedKey?.pk;
            // @ts-expect-error
            query.LastEvaluatedKey?.pk.S;
          };

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
          batchWrite.UnprocessedItems;

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
        removalPolicy: RemovalPolicy.DESTROY,
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

  test(
    "Step Function all DynamoDB AttributeValue APIs",
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
        removalPolicy: RemovalPolicy.DESTROY,
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

      if (!response.Payload) {
        throw new Error("response.Payload is undefined");
      }

      expect(JSON.parse(response?.Payload as any)).toEqual([
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

  type GraphItem = Person;
  interface TableItem<Type extends string> {
    pk: `${Type}|${string}`;
  }
  interface Person extends TableItem<"Person"> {
    id: string;
    name: string;
  }

  test(
    "GraphQL Appsync Resolvers",
    (scope: any, role: aws_iam.IRole) => {
      const table = new Table<GraphItem, "pk">(scope, "JsonSecret", {
        partitionKey: {
          name: "pk",
          type: aws_dynamodb.AttributeType.STRING,
        },
        removalPolicy: RemovalPolicy.DESTROY,
      });

      const api = new appsync.GraphqlApi(scope, "Api", {
        schema: appsync.Schema.fromAsset(
          path.join(__dirname, "table.runtime.gql")
        ),
        name: "test-api",
        authorizationConfig: {
          defaultAuthorization: {
            authorizationType: appsync.AuthorizationType.IAM,
          },
        },
        logConfig: {
          fieldLogLevel: appsync.FieldLogLevel.ALL,
        },
      });

      api.grantQuery(role);
      api.grantMutation(role);
      table.resource.grantReadWriteData(role);

      new AppsyncResolver<{ id: string }, Person | undefined>(
        api,
        "getPerson",
        {
          typeName: "Query",
          fieldName: "getPerson",
        },
        async ($context) =>
          table.appsync.get({
            key: {
              pk: {
                S: `Person|${$context.arguments.id}`,
              },
            },
          })
      );
      new AppsyncResolver<{ ids: string[] }, Person[]>(
        api,
        "getPeopleBatch",
        {
          typeName: "Query",
          fieldName: "getPeopleBatch",
        },
        async ($context) => {
          const response = await table.appsync.batchGet({
            keys: $context.arguments.ids.map((id) => ({
              pk: {
                S: `Person|${id}`,
              },
            })),
          });
          return response.items;
        }
      );

      new AppsyncResolver<{ ids: string[] }, Person[]>(
        api,
        "getPeopleAtomic",
        {
          typeName: "Query",
          fieldName: "getPeopleAtomic",
        },
        async ($context) => {
          const response = await table.appsync.transactGet(
            $context.arguments.ids.map((id) => ({
              key: {
                pk: {
                  S: `Person|${id}`,
                },
              },
            }))
          );
          return response.items ?? [];
        }
      );

      new AppsyncResolver<
        {
          name: string;
        },
        Person
      >(
        api,
        "addPerson",
        {
          typeName: "Mutation",
          fieldName: "addPerson",
        },
        async ($context) => {
          const id = $util.autoId();
          return table.appsync.put({
            key: {
              pk: {
                S: `Person|${id}`,
              },
            },
            attributeValues: {
              id: {
                S: id,
              },
              name: {
                S: $context.arguments.name,
              },
            },
          });
        }
      );

      new AppsyncResolver<
        {
          names: string[];
        },
        Person[] | null
      >(
        api,
        "addPeopleAtomic",
        {
          typeName: "Mutation",
          fieldName: "addPeopleAtomic",
        },
        async ($context) => {
          const response = await table.appsync.transactWrite(
            $context.arguments.names.map((name) => {
              const id = $util.autoId();
              return {
                operation: "PutItem",
                key: {
                  pk: {
                    S: `Person|${id}`,
                  },
                },
                attributeValues: {
                  id: {
                    S: id,
                  },
                  name: {
                    S: name,
                  },
                },
              };
            })
          );

          const get = await table.appsync.transactGet(
            response.keys!.map((key) => ({
              key: $util.dynamodb.toMapValues(key),
            }))
          );

          return get.items;
        }
      );

      new AppsyncResolver<
        {
          names: string[];
        },
        Person[] | null
      >(
        api,
        "addPeopleBatch",
        {
          typeName: "Mutation",
          fieldName: "addPeopleBatch",
        },
        async ($context) => {
          const response = await table.appsync.batchPut(
            $context.arguments.names.map((name) => {
              const id = $util.autoId();
              return {
                pk: {
                  S: `Person|${id}`,
                },
                id: {
                  S: id,
                },
                name: {
                  S: name,
                },
              };
            })
          );

          return response.items;
        }
      );

      new AppsyncResolver<
        {
          id: string;
        },
        Person | undefined
      >(
        api,
        "deletePerson",
        {
          typeName: "Mutation",
          fieldName: "deletePerson",
        },
        async ($context) => {
          return table.appsync.delete({
            key: {
              pk: {
                S: `Person|${$context.arguments.id}`,
              },
            },
          });
        }
      );

      new AppsyncResolver<
        {
          ids: string[];
        },
        Person[] | null
      >(
        api,
        "deletePeopleAtomic",
        {
          typeName: "Mutation",
          fieldName: "deletePeopleAtomic",
        },
        async ($context) => {
          const get = await table.appsync.transactGet(
            $context.arguments.ids.map((id) => ({
              key: {
                pk: {
                  S: `Person|${id}`,
                },
              },
            })) ?? []
          );

          await table.appsync.transactWrite(
            $context.arguments.ids.map((id) => ({
              operation: "DeleteItem",
              key: {
                pk: {
                  S: `Person|${id}`,
                },
              },
            }))
          );

          return get.items;
        }
      );

      new AppsyncResolver<
        {
          ids: string[];
        },
        (Person | null)[]
      >(
        api,
        "deletePeopleBatch",
        {
          typeName: "Mutation",
          fieldName: "deletePeopleBatch",
        },
        async ($context) => {
          const get = await table.appsync.batchGet({
            keys: $context.arguments.ids.map((id) => ({
              pk: {
                S: `Person|${id}`,
              },
            })),
          });

          await table.appsync.batchDelete(
            $context.arguments.ids.map((id) => ({
              pk: {
                S: `Person|${id}`,
              },
            }))
          );

          return get.items;
        }
      );

      return {
        outputs: {
          graphqlUrl: api.graphqlUrl,
          roleArn: role.roleArn,
          tableName: table.tableName,
        },
      };
    },
    async (
      {
        graphqlUrl,
        roleArn,
        tableName,
      }: {
        graphqlUrl: string;
        roleArn: string;
        tableName: string;
      },
      clients: RuntimeTestClients
    ) => {
      await (async function clearTable() {
        let response: AWS.DynamoDB.ScanOutput;
        do {
          response = await clients.dynamoDB
            .scan({
              TableName: tableName,
              AttributesToGet: ["pk"],
            })
            .promise();
          if (response.Items?.length) {
            await clients.dynamoDB
              .batchWriteItem({
                RequestItems: {
                  [tableName]: response.Items.map((item) => ({
                    DeleteRequest: {
                      Key: item,
                    },
                  })),
                },
              })
              .promise();
          }
        } while (response.Items?.length);
      })();

      const role = await getTestRole(roleArn);

      const client = new AWSAppSyncClient({
        url: graphqlUrl,
        region: "us-east-1",
        auth: {
          type: "AWS_IAM",
          credentials: {
            accessKeyId: role?.Credentials?.AccessKeyId!,
            secretAccessKey: role?.Credentials?.SecretAccessKey!,
            sessionToken: role?.Credentials?.SessionToken!,
          },
        },
        disableOffline: true,
      });

      const addPerson = gql`
        mutation {
          addPerson(name: "sam") {
            pk
            id
            name
          }
        }
      `;
      const addPersonResponse: { data: { addPerson: Person } } =
        await client.mutate({
          mutation: addPerson,
        });

      expect(addPersonResponse.data.addPerson.pk).toEqual(
        `Person|${addPersonResponse.data.addPerson.id}`
      );
      expect(addPersonResponse.data.addPerson.name).toEqual("sam");

      const addPeopleBatch = gql`
        mutation {
          addPeopleBatch(names: ["sam1", "sam2"]) {
            pk
            id
            name
          }
        }
      `;

      const addPeopleBatchResponse: { data: { addPeopleBatch: Person[] } } =
        await client.mutate({
          mutation: addPeopleBatch,
        });
      addPeopleBatchResponse.data.addPeopleBatch.forEach((person, i) => {
        expect(person.pk).toEqual(`Person|${person.id}`);
        expect(person.name).toEqual(`sam${i + 1}`);
      });

      const addPeopleAtomic = gql`
        mutation {
          addPeopleAtomic(names: ["tyler1", "tyler2"]) {
            pk
            id
            name
          }
        }
      `;

      const addPeopleAtomicResponse: { data: { addPeopleAtomic: Person[] } } =
        await client.mutate({
          mutation: addPeopleAtomic,
        });
      addPeopleAtomicResponse.data.addPeopleAtomic.forEach((person, i) => {
        expect(person.pk).toEqual(`Person|${person.id}`);
        expect(person.name).toEqual(`tyler${i + 1}`);
      });

      const getPerson = gql`
        query getPerson($id: ID!) {
          getPerson(id: $id) {
            pk
            id
            name
          }
        }
      `;

      const getPersonResponse: { data: { getPerson: Person } } =
        await client.query({
          query: getPerson,
          variables: {
            id: addPersonResponse.data.addPerson.id,
          },
        });
      expect(getPersonResponse.data.getPerson).toEqual(
        addPersonResponse.data.addPerson
      );

      const getPeopleAtomic = gql`
        query getPeopleAtomic($ids: [ID!]!) {
          getPeopleAtomic(ids: $ids) {
            pk
            id
            name
          }
        }
      `;

      const getPeopleAtomicResponse: { data: { getPeopleAtomic: Person[] } } =
        await client.query({
          query: getPeopleAtomic,
          variables: {
            ids: [
              addPeopleAtomicResponse.data.addPeopleAtomic[0]?.id,
              addPeopleAtomicResponse.data.addPeopleAtomic[1]?.id,
            ],
          },
        });
      expect(getPeopleAtomicResponse.data.getPeopleAtomic).toEqual(
        addPeopleAtomicResponse.data.addPeopleAtomic
      );

      const getPeopleBatch = gql`
        query getPeopleBatch($ids: [ID!]!) {
          getPeopleBatch(ids: $ids) {
            pk
            id
            name
          }
        }
      `;

      const getPeopleBatchResponse: { data: { getPeopleBatch: Person[] } } =
        await client.query({
          query: getPeopleBatch,
          variables: {
            ids: [
              addPeopleBatchResponse.data.addPeopleBatch[0]?.id,
              addPeopleBatchResponse.data.addPeopleBatch[1]?.id,
            ],
          },
        });
      expect(getPeopleBatchResponse.data.getPeopleBatch).toEqual(
        addPeopleBatchResponse.data.addPeopleBatch
      );

      const deletePerson = gql`
        mutation deletePerson($id: ID!) {
          deletePerson(id: $id) {
            pk
            id
            name
          }
        }
      `;

      const deletePersonResponse: { data: { deletePerson: Person } } =
        await client.mutate({
          mutation: deletePerson,
          variables: {
            id: getPersonResponse.data.getPerson.id,
          },
        });

      expect(deletePersonResponse.data.deletePerson).toEqual(
        getPersonResponse.data.getPerson
      );

      const deletePeopleAtomic = gql`
        mutation deletePeopleAtomic($ids: [ID!]!) {
          deletePeopleAtomic(ids: $ids) {
            pk
            id
            name
          }
        }
      `;

      const deletePeopleAtomicResponse: {
        data: { deletePeopleAtomic: Person[] };
      } = await client.mutate({
        mutation: deletePeopleAtomic,
        variables: {
          ids: [
            getPeopleAtomicResponse.data.getPeopleAtomic[0]?.id,
            getPeopleAtomicResponse.data.getPeopleAtomic[1]?.id,
          ],
        },
      });

      expect(deletePeopleAtomicResponse.data.deletePeopleAtomic).toEqual(
        getPeopleAtomicResponse.data.getPeopleAtomic
      );

      const deletePeopleBatch = gql`
        mutation deletePeopleBatch($ids: [ID!]!) {
          deletePeopleBatch(ids: $ids) {
            pk
            id
            name
          }
        }
      `;

      const deletePeopleBatchResponse: {
        data: { deletePeopleBatch: Person[] };
      } = await client.mutate({
        mutation: deletePeopleBatch,
        variables: {
          ids: [
            getPeopleBatchResponse.data.getPeopleBatch[0]?.id,
            getPeopleBatchResponse.data.getPeopleBatch[1]?.id,
          ],
        },
      });

      expect(deletePeopleBatchResponse.data.deletePeopleBatch).toEqual(
        getPeopleBatchResponse.data.getPeopleBatch
      );
    }
  );
});
