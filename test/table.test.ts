import "jest";
import { reflect } from "../src";
import { Table } from "../src";
import { returnExpr, testCase } from "./util";

interface Item {
  id: string;
  name: number;
}

const table = new Table<Item, "id">(null as any);

test("get item", () =>
  testCase(
    reflect((id: string): Item | undefined => {
      return table.getItem({
        key: {
          id: {
            S: id,
          },
        },
      });
    }),
    `#set($v1 = {})
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
${returnExpr("$util.toJson($v4)")}`
  ));

test("get item and set consistentRead:true", () =>
  testCase(
    reflect((id: string): Item | undefined => {
      return table.getItem({
        key: {
          id: {
            S: id,
          },
        },
        consistentRead: true,
      });
    }),
    `#set($v1 = {})
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
${returnExpr("$util.toJson($v4)")}`
  ));

test("put item", () =>
  testCase(
    reflect((id: string, name: number): Item | undefined => {
      return table.putItem({
        key: {
          id: {
            S: id,
          },
        },
        attributeValues: {
          name: {
            N: `${name}`,
          },
        },
        condition: {
          expression: "#name = :val",
          expressionNames: {
            "#name": "name",
          },
          expressionValues: {
            ":val": {
              S: id,
            },
          },
        },
      });
    }),
    `#set($v1 = {})
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
#set($context.stash.return__val = $util.toJson($v10))
#set($context.stash.return__flag = true)
#return($context.stash.return__val)`
  ));

test("update item", () =>
  testCase(
    reflect((id: string): Item | undefined => {
      return table.updateItem({
        key: {
          id: {
            S: id,
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
    `#set($v1 = {})
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
${returnExpr("$util.toJson($v6)")}`
  ));

test("delete item", () =>
  testCase(
    reflect((id: string): Item | undefined => {
      return table.deleteItem({
        key: {
          id: {
            S: id,
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
    `#set($v1 = {})
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
${returnExpr("$util.toJson($v6)")}`
  ));
