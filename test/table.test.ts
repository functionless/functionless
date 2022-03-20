import { App, aws_dynamodb, Stack } from "aws-cdk-lib";
import "jest";
import { $util, AppsyncContext, reflect } from "../src";
import { Table } from "../src";
import { VTL } from "../src/vtl";
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
    reflect((context: AppsyncContext<{ id: string }>): Item | undefined => {
      return table.getItem({
        key: {
          id: {
            S: context.arguments.id,
          },
        },
      });
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {})
#set($v2 = {})
#set($v3 = {})
$util.qr($v3.put('S', $context.arguments.id))
$util.qr($v2.put('id', $v3))
$util.qr($v1.put('key', $v2))
#set($v4 = {\"operation\": \"GetItem\", \"version\": \"2018-05-29\"})
$util.qr($v4.put('key', $v1.get('key')))
#if($v1.containsKey('consistentRead'))
$util.qr($v4.put('consistentRead', $v1.get('consistentRead')))
#end
$util.toJson($v4)`,
    // function's response mapping template
    `#set( $context.stash.return__flag = true )
#set( $context.stash.return__val = $context.result )
{}`,
    // response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end`
  ));

test("get item and set consistentRead:true", () =>
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
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {})
#set($v2 = {})
#set($v3 = {})
$util.qr($v3.put('S', $context.arguments.id))
$util.qr($v2.put('id', $v3))
$util.qr($v1.put('key', $v2))
$util.qr($v1.put('consistentRead', true))
#set($v4 = {\"operation\": \"GetItem\", \"version\": \"2018-05-29\"})
$util.qr($v4.put('key', $v1.get('key')))
#if($v1.containsKey('consistentRead'))
$util.qr($v4.put('consistentRead', $v1.get('consistentRead')))
#end
$util.toJson($v4)`,
    // function's response mapping template
    `#set( $context.stash.return__flag = true )
#set( $context.stash.return__val = $context.result )
{}`,
    // pipeline's response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end`
  ));

test("put item", () =>
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
    ),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {})
#set($v2 = {})
#set($v3 = {})
$util.qr($v3.put('S', $context.arguments.id))
$util.qr($v2.put('id', $v3))
$util.qr($v1.put('key', $v2))
#set($v4 = {})
#set($v5 = {})
$util.qr($v5.put('N', \"\${context.arguments.name}\"))
$util.qr($v4.put('name', $v5))
$util.qr($v1.put('attributeValues', $v4))
#set($v6 = {})
$util.qr($v6.put('expression', '#name = :val'))
#set($v7 = {})
$util.qr($v7.put('#name', 'name'))
$util.qr($v6.put('expressionNames', $v7))
#set($v8 = {})
#set($v9 = {})
$util.qr($v9.put('S', $context.arguments.id))
$util.qr($v8.put(':val', $v9))
$util.qr($v6.put('expressionValues', $v8))
$util.qr($v1.put('condition', $v6))
#set($v10 = {\"operation\": \"PutItem\", \"version\": \"2018-05-29\"})
$util.qr($v10.put('key', $v1.get('key')))
$util.qr($v10.put('attributeValues', $v1.get('attributeValues')))
#if($v1.containsKey('condition'))
$util.qr($v10.put('condition', $v1.get('condition')))
#end
#if($v1.containsKey('_version'))
$util.qr($v10.put('_version', $v1.get('_version')))
#end
$util.toJson($v10)`,
    // function's response mapping template
    `#set( $context.stash.return__flag = true )
#set( $context.stash.return__val = $context.result )
{}`,
    // pipeline's response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end`
  ));

test("update item", () =>
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
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {})
#set($v2 = {})
#set($v3 = {})
$util.qr($v3.put('S', $context.arguments.id))
$util.qr($v2.put('id', $v3))
$util.qr($v1.put('key', $v2))
#set($v4 = {})
$util.qr($v4.put('expression', '#name = #name + 1'))
#set($v5 = {})
$util.qr($v5.put('#name', 'name'))
$util.qr($v4.put('expressionNames', $v5))
$util.qr($v1.put('update', $v4))
#set($v6 = {\"operation\": \"UpdateItem\", \"version\": \"2018-05-29\"})
$util.qr($v6.put('key', $v1.get('key')))
$util.qr($v6.put('update', $v1.get('update')))
#if($v1.containsKey('condition'))
$util.qr($v6.put('condition', $v1.get('condition')))
#end
#if($v1.containsKey('_version'))
$util.qr($v6.put('_version', $v1.get('_version')))
#end
$util.toJson($v6)`,
    // function's response mapping template
    `#set( $context.stash.return__flag = true )
#set( $context.stash.return__val = $context.result )
{}`,
    // pipeline's response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end`
  ));

test("delete item", () =>
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
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {})
#set($v2 = {})
#set($v3 = {})
$util.qr($v3.put('S', $context.arguments.id))
$util.qr($v2.put('id', $v3))
$util.qr($v1.put('key', $v2))
#set($v4 = {})
$util.qr($v4.put('expression', '#name = #name + 1'))
#set($v5 = {})
$util.qr($v5.put('#name', 'name'))
$util.qr($v4.put('expressionNames', $v5))
$util.qr($v1.put('condition', $v4))
#set($v6 = {\"operation\": \"DeleteItem\", \"version\": \"2018-05-29\"})
$util.qr($v6.put('key', $v1.get('key')))
#if($v1.containsKey('condition'))
$util.qr($v6.put('condition', $v1.get('condition')))
#end
#if($v1.containsKey('_version'))
$util.qr($v6.put('_version', $v1.get('_version')))
#end
$util.toJson($v6)`,
    // function's response mapping template
    `#set( $context.stash.return__flag = true )
#set( $context.stash.return__val = $context.result )
{}`,
    // pipeline's response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end`
  ));

test("query", () =>
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
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {})
#set($v2 = {})
$util.qr($v2.put('expression', 'id = :id and #name = :val'))
#set($v3 = {})
$util.qr($v3.put('#name', 'name'))
$util.qr($v2.put('expressionNames', $v3))
#set($v4 = {})
$util.qr($v4.put(':id', $util.dynamodb.toDynamoDB($context.arguments.id)))
$util.qr($v4.put(':val', $util.dynamodb.toDynamoDB($context.arguments.sort)))
$util.qr($v2.put('expressionValues', $v4))
$util.qr($v1.put('query', $v2))
#set($v5 = {\"operation\": \"Query\", \"version\": \"2018-05-29\"})
$util.qr($v5.put('key', $v1.get('key')))
$util.qr($v5.put('query', $v1.get('query')))
#if($v1.containsKey('index'))
$util.qr($v5.put('index', $v1.get('index')))
#end
#if($v1.containsKey('nextToken'))
$util.qr($v5.put('nextToken', $v1.get('nextToken')))
#end
#if($v1.containsKey('limit'))
$util.qr($v5.put('limit', $v1.get('limit')))
#end
#if($v1.containsKey('scanIndexForward'))
$util.qr($v5.put('scanIndexForward', $v1.get('scanIndexForward')))
#end
#if($v1.containsKey('consistentRead'))
$util.qr($v5.put('consistentRead', $v1.get('consistentRead')))
#end
#if($v1.containsKey('select'))
$util.qr($v5.put('select', $v1.get('select')))
#end
$util.toJson($v5)`,
    // function's response mapping template
    `#set( $context.stash.return__flag = true )
#set( $context.stash.return__val = $context.result.items )
{}`,
    // pipeline's response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end`
  ));
