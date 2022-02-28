import "jest";
import { $util } from "../lib";
import { FunctionDecl, reflect } from "../src/expression";
import { VTL } from "../src/vtl";

// generates boilerplate for the circuit-breaker logic for implementing early return
function returnExpr(varName: string) {
  return `#set($context.stash.return__val = ${varName})
#set($context.stash.return__flag = true)
#return($context.stash.return__val)`;
}

function testCase(decl: FunctionDecl, expected: string) {
  const vtl = new VTL();
  vtl.eval(decl.body);
  const actual = vtl.toVTL();
  expect(actual).toEqual(expected);
}

test("empty function returning an argument", () => {
  testCase(
    reflect((a: string) => {
      return a;
    }),
    returnExpr("$context.arguments.a")
  );
});

test("return literal object with values", () => {
  testCase(
    reflect((arg: string, obj: Record<string, any>) => {
      return {
        null: null,
        undefined: undefined,
        string: "hello",
        number: 1,
        list: ["hello"],
        obj: {
          key: "value",
        },
        arg,
        ...obj,
      };
    }),
    `#set($v1 = {})
$util.qr($v1.put('null', $null))
$util.qr($v1.put('undefined', $null))
$util.qr($v1.put('string', 'hello'))
$util.qr($v1.put('number', 1))
#set($v2 = ['hello'])
$util.qr($v1.put('list', $v2))
#set($v3 = {})
$util.qr($v3.put('key', 'value'))
$util.qr($v1.put('obj', $v3))
$util.qr($v1.put('arg', $context.arguments.arg))
#foreach( $v4 in $context.arguments.obj.keySet() )
$util.qr($v1.put($v4, $context.arguments.obj.get($v4)))
#end
${returnExpr("$v1")}`
  );
});

test("call function and return its value", () => {
  testCase(
    reflect(() => {
      return $util.autoId();
    }),
    returnExpr("$util.autoId()")
  );
});

test("call function, assign to variable and return variable reference", () => {
  testCase(
    reflect(() => {
      const id = $util.autoId();
      return id;
    }),
    `#set($context.stash.id = $util.autoId())
${returnExpr("$context.stash.id")}`
  );
});

test("return in-line spread object", () => {
  testCase(
    reflect((obj: { key: string }) => {
      return {
        id: $util.autoId(),
        ...obj,
      };
    }),
    `#set($v1 = {})
$util.qr($v1.put('id', $util.autoId()))
#foreach( $v2 in $context.arguments.obj.keySet() )
$util.qr($v1.put($v2, $context.arguments.obj.get($v2)))
#end
${returnExpr("$v1")}`
  );
});

test("return in-line list literal", () => {
  testCase(
    reflect((a: string, b: string) => {
      return [a, b];
    }),
    `#set($v1 = [$context.arguments.a, $context.arguments.b])
${returnExpr("$v1")}`
  );
});

test("return list literal variable", () => {
  testCase(
    reflect((a: string, b: string) => {
      const list = [a, b];
      return list;
    }),
    `#set($v1 = [$context.arguments.a, $context.arguments.b])
#set($context.stash.list = $v1)
${returnExpr("$context.stash.list")}`
  );
});

test("return list element", () => {
  testCase(
    reflect((a: string, b: string) => {
      const list = [a, b];
      return list[0];
    }),
    `#set($v1 = [$context.arguments.a, $context.arguments.b])
#set($context.stash.list = $v1)
${returnExpr("$context.stash.list[0]")}`
  );
});

test("push element to array is renamed to add", () => {
  testCase(
    reflect((list: string[]) => {
      list.push("hello");
      return list;
    }),
    `$util.qr($context.arguments.list.add('hello'))
${returnExpr("$context.arguments.list")}`
  );
});

// TODO
// test("push multiple args is expanded to multiple add calls", () => {
//   const template = reflect((list: string[]) => {
//     list.push("hello", "world");
//     return list;
//   });

//   const vtl = new VTL();
//   vtl.eval(template.body);
//   const actual = vtl.toVTL();
//   const expected = `$util.qr($context.arguments.list.add('hello'))
//   $util.qr($context.arguments.list.add('world'))
// ${returnExpr("$context.arguments.list")}`;
//   expect(actual).toEqual(expected);
// });

test("if statement", () => {
  testCase(
    reflect((list: string[]) => {
      if (list.length > 0) {
        return true;
      } else {
        return false;
      }
    }),
    `#set($v1 = $context.arguments.list.length > 0)
#if($v1)
${returnExpr("true")}
#else
${returnExpr("false")}
#end`
  );
});

test("return conditional expression", () => {
  testCase(
    reflect((list: string[]) => {
      return list.length > 0 ? true : false;
    }),
    `#set($v2 = $context.arguments.list.length > 0)
#if($v2)
#set($v1 = true)
#else
#set($v1 = false)
#end
${returnExpr("$v1")}`
  );
});

test("property assignment of conditional expression", () => {
  testCase(
    reflect((list: string[]) => {
      return {
        prop: list.length > 0 ? true : false,
      };
    }),
    `#set($v1 = {})
#set($v3 = $context.arguments.list.length > 0)
#if($v3)
#set($v2 = true)
#else
#set($v2 = false)
#end
$util.qr($v1.put('prop', $v2))
${returnExpr("$v1")}`
  );
});

test("for-of loop", () => {
  testCase(
    reflect((list: string[]) => {
      const newList = [];
      for (const item of list) {
        newList.push(item);
      }
      return newList;
    }),
    `#set($v1 = [])
#set($context.stash.newList = $v1)
#foreach($item in $context.arguments.list)
$util.qr($context.stash.newList.add($item))
#end
${returnExpr("$context.stash.newList")}`
  );
});

test("local variable inside for-of loop is declared as a local variable", () => {
  testCase(
    reflect((list: string[]) => {
      const newList = [];
      for (const item of list) {
        const i = item;
        newList.push(i);
      }
      return newList;
    }),
    `#set($v1 = [])
#set($context.stash.newList = $v1)
#foreach($item in $context.arguments.list)
#set($i = $item)
$util.qr($context.stash.newList.add($i))
#end
${returnExpr("$context.stash.newList")}`
  );
});

test("for-in loop and element access", () => {
  testCase(
    reflect((record: Record<string, any>) => {
      const newList = [];
      for (const key in record) {
        newList.push(record[key]);
      }
      return newList;
    }),
    `#set($v1 = [])
#set($context.stash.newList = $v1)
#foreach($key in $context.arguments.record.keySet())
$util.qr($context.stash.newList.add($context.arguments.record[$key]))
#end
${returnExpr("$context.stash.newList")}`
  );
});
