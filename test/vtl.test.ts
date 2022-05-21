import "jest";
import { $util } from "../src";
import { AppsyncContext } from "../src";
import { reflect } from "../src/reflect";
import { returnExpr, appsyncTestCase } from "./util";

const payload = `{
  "version": "2018-05-29",
  "payload": null
}`;

test("empty function returning an argument", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ a: string }>) => {
      return context.arguments.a;
    }),
    payload,
    "#return($context.arguments.a)"
  );
});

test("return literal object with values", () => {
  appsyncTestCase(
    reflect(
      (context: AppsyncContext<{ arg: string; obj: Record<string, any> }>) => {
        const arg = context.arguments.arg;
        const obj = context.arguments.obj;
        return {
          null: null,
          undefined: undefined,
          string: "hello",
          number: 1,
          ["list"]: ["hello"],
          obj: {
            key: "value",
          },
          arg,
          ...obj,
        };
      }
    ),
    payload,
    `#set($context.stash.arg = $context.arguments.arg)
#set($context.stash.obj = $context.arguments.obj)
#set($v1 = {})
$util.qr($v1.put('null', $null))
$util.qr($v1.put('undefined', $null))
$util.qr($v1.put('string', 'hello'))
$util.qr($v1.put('number', 1))
$util.qr($v1.put('list', ['hello']))
#set($v2 = {})
$util.qr($v2.put('key', 'value'))
$util.qr($v1.put('obj', $v2))
$util.qr($v1.put('arg', $context.stash.arg))
$util.qr($v1.putAll($context.stash.obj))
#return($v1)`
  );
});

test("computed property names", () => {
  appsyncTestCase(
    reflect(
      (context: AppsyncContext<{ arg: string; obj: Record<string, any> }>) => {
        const name = context.arguments.arg;
        const value = name + "_test";
        return {
          [name]: context.arguments.arg,
          [value]: context.arguments.arg,
        };
      }
    ),
    payload,
    `#set($context.stash.name = $context.arguments.arg)
#set($context.stash.value = $context.stash.name + '_test')
#set($v1 = {})
$util.qr($v1.put($context.stash.name, $context.arguments.arg))
$util.qr($v1.put($context.stash.value, $context.arguments.arg))
#return($v1)`
  );
});

test("null and undefined", () => {
  appsyncTestCase(
    reflect(
      (_context: AppsyncContext<{ arg: string; obj: Record<string, any> }>) => {
        return {
          name: null,
          value: undefined,
        };
      }
    ),
    payload,
    `#set($v1 = {})
$util.qr($v1.put('name', $null))
$util.qr($v1.put('value', $null))
#return($v1)`
  );
});

test("call function and return its value", () => {
  appsyncTestCase(
    reflect(() => {
      return $util.autoId();
    }),
    payload,
    "#return($util.autoId())"
  );
});

test("call function, assign to variable and return variable reference", () => {
  appsyncTestCase(
    reflect(() => {
      const id = $util.autoId();
      return id;
    }),
    payload,
    `#set($context.stash.id = $util.autoId())
#return($context.stash.id)`
  );
});

test("return in-line spread object", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ obj: { key: string } }>) => {
      return {
        id: $util.autoId(),
        ...context.arguments.obj,
      };
    }),
    payload,
    `#set($v1 = {})
$util.qr($v1.put('id', $util.autoId()))
$util.qr($v1.putAll($context.arguments.obj))
#return($v1)`
  );
});

test("return in-line list literal", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ a: string; b: string }>) => {
      return [context.arguments.a, context.arguments.b];
    }),
    payload,
    "#return([$context.arguments.a, $context.arguments.b])"
  );
});

test("return list literal variable", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ a: string; b: string }>) => {
      const list = [context.arguments.a, context.arguments.b];
      return list;
    }),
    payload,
    `#set($context.stash.list = [$context.arguments.a, $context.arguments.b])
#return($context.stash.list)`
  );
});

test("return list element", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ a: string; b: string }>) => {
      const list = [context.arguments.a, context.arguments.b];
      return list[0];
    }),
    payload,
    `#set($context.stash.list = [$context.arguments.a, $context.arguments.b])
#return($context.stash.list[0])`
  );
});

test("push element to array is renamed to add", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      context.arguments.list.push("hello");
      return context.arguments.list;
    }),
    payload,
    `$util.qr($context.arguments.list.addAll(['hello']))
#return($context.arguments.list)`
  );
});

// TODO https://github.com/sam-goodwin/functionless/issues/8
// test("push multiple args is expanded to multiple add calls", () => {
//   const template = reflect((context: AppsyncContext<{ list: string[] }>) => {
//     list.push("hello", "world");
//     return list;
//   });

//   const vtl = new VTL();
//   vtl.eval(template.body);
//   const actual = vtl.toVTL();
//   const expected = `$util.qr($context.arguments.list.addAll(['hello']))
//   $util.qr($context.arguments.list.addAll(['world']))
// ${returnExpr("$context.arguments.list")}`;
//   expect(actual).toEqual(expected);
// });

test("if statement", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      if (context.arguments.list.length > 0) {
        return true;
      } else {
        return false;
      }
    }),
    payload,
    `#if($context.arguments.list.length > 0)
${returnExpr("true")}
#else
${returnExpr("false")}
#end`
  );
});

test("return conditional expression", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list.length > 0 ? true : false;
    }),
    payload,
    `#if($context.arguments.list.length > 0)
#set($v1 = true)
#else
#set($v1 = false)
#end
#return($v1)`
  );
});

test("property assignment of conditional expression", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return {
        prop: context.arguments.list.length > 0 ? true : false,
      };
    }),
    payload,
    `#set($v1 = {})
#if($context.arguments.list.length > 0)
#set($v2 = true)
#else
#set($v2 = false)
#end
$util.qr($v1.put('prop', $v2))
#return($v1)`
  );
});

test("for-of loop", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      const newList = [];
      for (const item of context.arguments.list) {
        newList.push(item);
      }
      return newList;
    }),
    payload,
    `#set($context.stash.newList = [])
#foreach($item in $context.arguments.list)
$util.qr($context.stash.newList.addAll([$item]))
#end
#return($context.stash.newList)`
  );
});

test("break from for-loop", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      const newList = [];
      for (const item of context.arguments.list) {
        if (item === "hello") {
          break;
        }
        newList.push(item);
      }
      return newList;
    }),
    payload,
    `#set($context.stash.newList = [])
#foreach($item in $context.arguments.list)
#if($item == 'hello')
#break
#end
$util.qr($context.stash.newList.addAll([$item]))
#end
#return($context.stash.newList)`
  );
});

test("local variable inside for-of loop is declared as a local variable", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      const newList = [];
      for (const item of context.arguments.list) {
        const i = item;
        newList.push(i);
      }
      return newList;
    }),
    payload,
    `#set($context.stash.newList = [])
#foreach($item in $context.arguments.list)
#set($i = $item)
$util.qr($context.stash.newList.addAll([$i]))
#end
#return($context.stash.newList)`
  );
});

test("for-in loop and element access", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ record: Record<string, any> }>) => {
      const newList = [];
      for (const key in context.arguments.record) {
        newList.push(context.arguments.record[key]);
      }
      return newList;
    }),
    payload,
    `#set($context.stash.newList = [])
#foreach($key in $context.arguments.record.keySet())
$util.qr($context.stash.newList.addAll([$context.arguments.record[$key]]))
#end
#return($context.stash.newList)`
  );
});

test("template expression", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ a: string }>) => {
      const local = context.arguments.a;
      return `head ${context.arguments.a} ${local}${context.arguments.a}`;
    }),
    payload,
    `#set($context.stash.local = $context.arguments.a)
#return("head \${context.arguments.a} \${context.stash.local}\${context.arguments.a}")`
  );
});

test("conditional expression in template expression", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ a: string }>) => {
      return `head ${
        context.arguments.a === "hello" ? "world" : context.arguments.a
      }`;
    }),
    payload,
    `#if($context.arguments.a == 'hello')
#set($v1 = 'world')
#else
#set($v1 = $context.arguments.a)
#end
#return("head \${v1}")`
  );
});

test("map over list", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list.map((item) => {
        return `hello ${item}`;
      });
    }),
    payload,
    `#set($v1 = [])
#foreach($item in $context.arguments.list)
#set($v2 = \"hello \${item}\")
$util.qr($v1.add($v2))
#end
#return($v1)`
  ));

test("map over list with in-line return", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list.map((item) => `hello ${item}`);
    }),
    payload,
    `#set($v1 = [])
#foreach($item in $context.arguments.list)
#set($v2 = \"hello \${item}\")
$util.qr($v1.add($v2))
#end
#return($v1)`
  ));

test("chain map over list", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list
        .map((item) => `hello ${item}`)
        .map((item) => `hello ${item}`);
    }),
    payload,
    `#set($v1 = [])
#foreach($item in $context.arguments.list)
#set($item = "hello \${item}")
#set($v2 = "hello \${item}")
$util.qr($v1.add($v2))
#end
#return($v1)`
  ));

test("chain map over list multiple array", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list
        .map((item, _i, _arr) => `hello ${item}`)
        .map((item, _i, _arr) => `hello ${item}`);
    }),
    payload,
    `#set($v1 = [])
#set($v2 = [])
#foreach($item in $context.arguments.list)
#set($_i = $foreach.index)
#set($_arr = $context.arguments.list)
#set($v3 = "hello \${item}")
$util.qr($v2.add($v3))
#end
#foreach($item in $v2)
#set($_i = $foreach.index)
#set($_arr = $v2)
#set($v4 = "hello \${item}")
$util.qr($v1.add($v4))
#end
#return($v1)`
  ));

test("chain map over list complex", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list
        .map((item, i, arr) => {
          const x = i + 1;
          return `hello ${item} ${x} ${arr.length}`;
        })
        .map((item2, ii) => `hello ${item2} ${ii}`);
    }),
    payload,
    `#set($v1 = [])
#foreach($item in $context.arguments.list)
#set($i = $foreach.index)
#set($arr = $context.arguments.list)
#set($x = $i + 1)
#set($item2 = "hello \${item} \${x} \${arr.length}")
#set($ii = $foreach.index)
#set($v2 = "hello \${item2} \${ii}")
$util.qr($v1.add($v2))
#end
#return($v1)`
  ));

test("forEach over list", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list.forEach((item) => {
        $util.error(item);
      });
    }),
    payload,
    `#foreach($item in $context.arguments.list)
$util.qr($util.error($item))
#end
#return($null)`
  ));

test("reduce over list with initial value", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list.reduce((newList: string[], item) => {
        return [...newList, item];
      }, []);
    }),
    payload,
    `#set($v1 = [])
#foreach($item in $context.arguments.list)
#set($newList = $v1)
#set($v3 = [])
$util.qr($v3.addAll($newList))
$util.qr($v3.add($item))
#set($v2 = $v3)
#set($v1 = $v2)
#end
#return($v1)`
  ));

test("reduce over list without initial value", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list.reduce((str: string, item) => {
        return `${str}${item}`;
      });
    }),
    payload,
    `#if($context.arguments.list.isEmpty())
$util.error('Reduce of empty array with no initial value')
#end
#foreach($item in $context.arguments.list)
#if($foreach.index == 0)
#set($v1 = $item)
#else
#set($str = $v1)
#set($v2 = \"\${str}\${item}\")
#set($v1 = $v2)
#end
#end
#return($v1)`
  ));

test("map and reduce over list with initial value", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list
        .map((item) => `hello ${item}`)
        .reduce((newList: string[], item) => {
          return [...newList, item];
        }, []);
    }),
    payload,
    `#set($v1 = [])
#foreach($item in $context.arguments.list)
#set($item = "hello \${item}")
#set($newList = $v1)
#set($v3 = [])
$util.qr($v3.addAll($newList))
$util.qr($v3.add($item))
#set($v2 = $v3)
#set($v1 = $v2)
#end
#return($v1)`
  ));

test("map and reduce with array over list with initial value", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list
        .map((item) => `hello ${item}`)
        .reduce((newList: string[], item, _i, _arr) => {
          return [...newList, item];
        }, []);
    }),
    payload,
    `#set($v2 = [])
#foreach($item in $context.arguments.list)
#set($v3 = "hello \${item}")
$util.qr($v2.add($v3))
#end
#set($v1 = [])
#foreach($item in $v2)
#set($_i = $foreach.index)
#set($_arr = $v2)
#set($newList = $v1)
#set($v5 = [])
$util.qr($v5.addAll($newList))
$util.qr($v5.add($item))
#set($v4 = $v5)
#set($v1 = $v4)
#end
#return($v1)`
  ));

test("map and reduce and map and reduce over list with initial value", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list
        .map((item) => `hello ${item}`)
        .reduce((newList: string[], item) => {
          return [...newList, item];
        }, [])
        .map((item) => `hello ${item}`)
        .reduce((newList: string[], item) => {
          return [...newList, item];
        }, []);
    }),
    payload,
    `#set($v2 = [])
#foreach($item in $context.arguments.list)
#set($item = "hello \${item}")
#set($newList = $v2)
#set($v4 = [])
$util.qr($v4.addAll($newList))
$util.qr($v4.add($item))
#set($v3 = $v4)
#set($v2 = $v3)
#end
#set($v1 = [])
#foreach($item in $v2)
#set($item = "hello \${item}")
#set($newList = $v1)
#set($v6 = [])
$util.qr($v6.addAll($newList))
$util.qr($v6.add($item))
#set($v5 = $v6)
#set($v1 = $v5)
#end
#return($v1)`
  ));

test("$util.time.nowISO8601", () =>
  appsyncTestCase(
    reflect(() => {
      return $util.time.nowISO8601();
    }),
    payload,
    "#return($util.time.nowISO8601())"
  ));

test("putting a BinaryExpr into an object creates a temp variable", () =>
  appsyncTestCase(
    reflect(() => {
      return { x: 1 + 1 };
    }),
    payload,
    `#set($v1 = {})
#set($v2 = 1 + 1)
$util.qr($v1.put('x', $v2))
#return($v1)`
  ));
