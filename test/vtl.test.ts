import "jest";
import { $util } from "../lib";
import { FunctionDecl } from "../src/declaration";
import { reflect } from "../src/reflect";
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
$util.qr($v1.put('list', ['hello']))
#set($v2 = {})
$util.qr($v2.put('key', 'value'))
$util.qr($v1.put('obj', $v2))
$util.qr($v1.put('arg', $context.arguments.arg))
#foreach( $v3 in $context.arguments.obj.keySet() )
$util.qr($v1.put($v3, $context.arguments.obj.get($v3)))
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
    returnExpr("[$context.arguments.a, $context.arguments.b]")
  );
});

test("return list literal variable", () => {
  testCase(
    reflect((a: string, b: string) => {
      const list = [a, b];
      return list;
    }),
    `#set($context.stash.list = [$context.arguments.a, $context.arguments.b])
${returnExpr("$context.stash.list")}`
  );
});

test("return list element", () => {
  testCase(
    reflect((a: string, b: string) => {
      const list = [a, b];
      return list[0];
    }),
    `#set($context.stash.list = [$context.arguments.a, $context.arguments.b])
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
    `#if($context.arguments.list.length > 0)
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
    `#if($context.arguments.list.length > 0)
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
#if($context.arguments.list.length > 0)
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
    `#set($context.stash.newList = [])
#foreach($item in $context.arguments.list)
$util.qr($context.stash.newList.add($item))
#end
${returnExpr("$context.stash.newList")}`
  );
});

test("break from for-loop", () => {
  testCase(
    reflect((list: string[]) => {
      const newList = [];
      for (const item of list) {
        if (item === "hello") {
          break;
        }
        newList.push(item);
      }
      return newList;
    }),
    `#set($context.stash.newList = [])
#foreach($item in $context.arguments.list)
#if($item == 'hello')
#break
#end
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
    `#set($context.stash.newList = [])
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
    `#set($context.stash.newList = [])
#foreach($key in $context.arguments.record.keySet())
$util.qr($context.stash.newList.add($context.arguments.record[$key]))
#end
${returnExpr("$context.stash.newList")}`
  );
});

test("template expression", () => {
  testCase(
    reflect((a: string) => {
      const local = a;
      return `head ${a} ${local}${a}`;
    }),
    `#set($context.stash.local = $context.arguments.a)
${returnExpr(
  `"head \${context.arguments.a} \${context.stash.local}\${context.arguments.a}"`
)}`
  );
});

test("conditional expression in template expression", () => {
  testCase(
    reflect((a: string) => {
      return `head ${a === "hello" ? "world" : a}`;
    }),
    `#if($context.arguments.a == 'hello')
#set($v1 = 'world')
#else
#set($v1 = $context.arguments.a)
#end
${returnExpr(`"head \${v1}"`)}`
  );
});

test("map over list", () =>
  testCase(
    reflect((list: string[]) => {
      return list.map((item) => {
        return `hello ${item}`;
      });
    }),
    `#set($v1 = [])
#foreach($item in $context.arguments.list)
#set($v2 = \"hello \${item}\")
$util.qr($v1.add($v2))
${returnExpr(`$v1`)}`
  ));
