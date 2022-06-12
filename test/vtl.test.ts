import "jest";
import { $util, AppsyncContext, ResolverFunction } from "../src";
import { reflect } from "../src/reflect";
import { appsyncTestCase } from "./util";

test("empty function returning an argument", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ a: string }>) => {
      return context.arguments.a;
    })
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
    )
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
    )
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
    )
  );
});

test("call function and return its value", () => {
  appsyncTestCase(
    reflect(() => {
      return $util.autoId();
    })
  );
});

test("call function, assign to variable and return variable reference", () => {
  appsyncTestCase(
    reflect(() => {
      const id = $util.autoId();
      return id;
    })
  );
});

test("return in-line spread object", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ obj: { key: string } }>) => {
      return {
        id: $util.autoId(),
        ...context.arguments.obj,
      };
    })
  );
});

test("return in-line list literal", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ a: string; b: string }>) => {
      return [context.arguments.a, context.arguments.b];
    })
  );
});

test("return list literal variable", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ a: string; b: string }>) => {
      const list = [context.arguments.a, context.arguments.b];
      return list;
    })
  );
});

test("return list element", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ a: string; b: string }>) => {
      const list = [context.arguments.a, context.arguments.b];
      return list[0];
    })
  );
});

test("push element to array is renamed to add", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      context.arguments.list.push("hello");
      return context.arguments.list;
    })
  );
});

// TODO https://github.com/functionless/functionless/issues/8
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
    })
  );
});

test("return conditional expression", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list.length > 0 ? true : false;
    })
  );
});

test("property assignment of conditional expression", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return {
        prop: context.arguments.list.length > 0 ? true : false,
      };
    })
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
    })
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
    })
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
    })
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
    })
  );
});

test("template expression", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ a: string }>) => {
      const local = context.arguments.a;
      return `head ${context.arguments.a} ${local}${context.arguments.a}`;
    })
  );
});

test("conditional expression in template expression", () => {
  appsyncTestCase(
    reflect((context: AppsyncContext<{ a: string }>) => {
      return `head ${
        context.arguments.a === "hello" ? "world" : context.arguments.a
      }`;
    })
  );
});

test("map over list", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list.map((item) => {
        return `hello ${item}`;
      });
    })
  ));

test("map over list with in-line return", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list.map((item) => `hello ${item}`);
    })
  ));

test("chain map over list", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list
        .map((item) => `hello ${item}`)
        .map((item) => `hello ${item}`);
    })
  ));

test("chain map over list multiple array", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list
        .map((item, _i, _arr) => `hello ${item}`)
        .map((item, _i, _arr) => `hello ${item}`);
    })
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
    })
  ));

test("forEach over list", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list.forEach((item) => {
        $util.error(item);
      });
    })
  ));

test("reduce over list with initial value", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list.reduce((newList: string[], item) => {
        return [...newList, item];
      }, []);
    })
  ));

test("reduce over list without initial value", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list.reduce((str: string, item) => {
        return `${str}${item}`;
      });
    })
  ));

test("map and reduce over list with initial value", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list
        .map((item) => `hello ${item}`)
        .reduce((newList: string[], item) => {
          return [...newList, item];
        }, []);
    })
  ));

test("map and reduce with array over list with initial value", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ list: string[] }>) => {
      return context.arguments.list
        .map((item) => `hello ${item}`)
        .reduce((newList: string[], item, _i, _arr) => {
          return [...newList, item];
        }, []);
    })
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
    })
  ));

test("$util.time.nowISO8601", () =>
  appsyncTestCase(
    reflect(() => {
      return $util.time.nowISO8601();
    })
  ));

test("BinaryExpr and UnaryExpr are evaluated to temporary variables", () =>
  appsyncTestCase(
    reflect(() => {
      return {
        x: -1,
        y: -(1 + 1),
        z: !(true && false),
      };
    })
  ));

test("binary expr in", () => {
  appsyncTestCase(
    reflect<
      ResolverFunction<{ key: string } | { key2: string }, { out: string }, any>
    >(($context) => {
      if ("key" in $context.arguments) {
        return { out: $context.arguments.key };
      }
      return { out: $context.arguments.key2 };
    }),
    {
      executeTemplates: [
        {
          index: 1,
          context: { arguments: { key: "hi" }, source: {} },
          match: { out: "hi" },
        },
        {
          index: 1,
          context: { arguments: { key2: "hello" }, source: {} },
          match: { out: "hello" },
        },
      ],
    }
  );
});

test("binary expr in array", () => {
  appsyncTestCase(
    reflect<ResolverFunction<{ arr: string[] }, { out: string }, any>>(
      ($context) => {
        if (1 in $context.arguments.arr) {
          return { out: $context.arguments.arr[1] };
        }
        return { out: $context.arguments.arr[0] };
      }
    ),
    {
      executeTemplates: [
        {
          index: 1,
          context: { arguments: { arr: ["1", "2"] }, source: {} },
          match: { out: "2" },
        },
        {
          index: 1,
          context: { arguments: { arr: ["1"] }, source: {} },
          match: { out: "1" },
        },
      ],
    }
  );
});

test("binary expr == in if statement", () => {
  appsyncTestCase(
    reflect<ResolverFunction<{ key: string }, { out: string }, any>>(
      ($context) => {
        if ($context.arguments.key == "hello") {
          return { out: "ohh hi" };
        }
        return { out: "wot" };
      }
    ),
    {
      executeTemplates: [
        {
          index: 1,
          context: { arguments: { key: "hello" }, source: {} },
          match: { out: "ohh hi" },
        },
        {
          index: 1,
          context: { arguments: { key: "giddyup" }, source: {} },
          match: { out: "wot" },
        },
      ],
    }
  );
});

test("binary expr =", () => {
  appsyncTestCase(
    reflect<ResolverFunction<{ key: string }, { out: string }, any>>(
      ($context) => {
        if ($context.arguments.key == "help me") {
          $context.arguments.key = "hello";
        }
        if ($context.arguments.key == "hello") {
          return { out: "ohh hi" };
        }
        return { out: "wot" };
      }
    ),
    {
      executeTemplates: [
        {
          index: 1,
          context: { arguments: { key: "hello" }, source: {} },
          match: { out: "ohh hi" },
        },
        {
          index: 1,
          context: { arguments: { key: "giddyup" }, source: {} },
          match: { out: "wot" },
        },
        {
          index: 1,
          context: { arguments: { key: "help me" }, source: {} },
          match: { out: "ohh hi" },
        },
      ],
    }
  );
});

// https://github.com/functionless/functionless/issues/232
test.skip("binary expr +=", () => {
  appsyncTestCase(
    reflect<ResolverFunction<{ key: string }, { out: number }, any>>(
      ($context) => {
        var n = 0;
        if ($context.arguments.key == "hello") {
          n += 1;
        }
        return { out: n };
      }
    ),
    {
      executeTemplates: [
        {
          index: 1,
          context: { arguments: { key: "hello" }, source: {} },
          match: { out: 1 },
        },
        {
          index: 1,
          context: { arguments: { key: "giddyup" }, source: {} },
          match: { out: 0 },
        },
      ],
    }
  );
});
