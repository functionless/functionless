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
#set($v4 = {\"operation\": \"GetItem\", \"version\": \"2018-05-20\"})
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
#set($v4 = {\"operation\": \"GetItem\", \"version\": \"2018-05-20\"})
$util.qr($v4.put('key', $v1.get('key')))
#if($v1.containsKey('consistentRead'))
$util.qr($v4.put('consistentRead', $v1.get('consistentRead')))
#end
${returnExpr("$util.toJson($v4)")}`
  ));
