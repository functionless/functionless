import "jest";
import fs from "fs";
import path from "path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import AWS from "aws-sdk";
import { v4 } from "uuid";
import { AnyFunction } from "../src";

import { isNode } from "../src/guards";
import {
  serializeClosure,
  SerializeClosureProps,
  serializeCodeWithSourceMap,
} from "../src/serialize-closure";

// set to false to inspect generated js files in .test/
const cleanup = true;

const tmpDir = path.join(__dirname, ".test");
beforeAll(async () => {
  let exists = true;
  try {
    await fs.promises.access(tmpDir);
  } catch {
    exists = false;
  }
  if (exists) {
    await rmrf(tmpDir);
  }
  await fs.promises.mkdir(tmpDir);
});

afterAll(async () => {
  if (cleanup) {
    await rmrf(tmpDir);
  }
});
async function rmrf(file: string) {
  const stat = await fs.promises.stat(file);
  if (stat.isDirectory()) {
    await Promise.all(
      (await fs.promises.readdir(file)).map((f) => rmrf(path.join(file, f)))
    );
    await fs.promises.rmdir(file);
  } else {
    await fs.promises.rm(file);
  }
}

async function expectClosure<F extends AnyFunction>(
  f: F,
  options?: SerializeClosureProps
): Promise<F> {
  const closure = serializeCodeWithSourceMap(serializeClosure(f, options));
  // expect(closure).toMatchSnapshot();
  const jsFile = path.join(tmpDir, `${v4()}.js`);
  await fs.promises.writeFile(jsFile, closure);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(jsFile).handler as F;
}

test("all observers of a free variable share the same reference", async () => {
  let i = 0;

  function up() {
    i += 2;
  }

  function down() {
    i -= 1;
  }

  const closure = await expectClosure(() => {
    up();
    down();
    return i;
  });

  expect(closure()).toEqual(1);
});

test("all observers of a free variable share the same reference even when two instances", async () => {
  const closures = [0, 0].map(() => {
    let i = 0;

    function up() {
      i += 2;
    }

    function down() {
      i -= 1;
    }

    return () => {
      up();
      down();
      return i;
    };
  });

  const closure = await expectClosure(() => {
    return closures.map((closure) => closure());
  });

  expect(closure()).toEqual([1, 1]);
});

test("serialize an imported module", async () => {
  const closure = await expectClosure(isNode);

  expect(closure({ kind: 1 })).toEqual(true);
});

test("serialize a class declaration", async () => {
  let i = 0;
  class Foo {
    public method() {
      i++;
      return i;
    }
  }

  const closure = await expectClosure(() => {
    const foo = new Foo();

    foo.method();
    foo.method();
    return i;
  });

  expect(closure()).toEqual(2);
});

test("serialize a class declaration with constructor", async () => {
  let i = 0;
  class Foo {
    constructor() {
      i += 1;
    }

    public method() {
      i++;
      return i;
    }
  }

  const closure = await expectClosure(() => {
    const foo = new Foo();

    foo.method();
    foo.method();
    return i;
  });

  expect(closure()).toEqual(3);
});

test("serialize a monkey-patched static class method", async () => {
  let i = 0;
  class Foo {
    public static method() {
      i += 1;
    }
  }

  Foo.method = function () {
    i += 2;
  };

  const closure = await expectClosure(() => {
    Foo.method();
    Foo.method();
    return i;
  });

  expect(closure()).toEqual(4);
});

test("serialize a monkey-patched static class arrow function", async () => {
  let i = 0;
  class Foo {
    public static method = () => {
      i += 1;
    };
  }

  Foo.method = function () {
    i += 2;
  };

  const closure = await expectClosure(() => {
    Foo.method();
    Foo.method();
    return i;
  });

  expect(closure()).toEqual(4);
});

test("serialize a monkey-patched static class property", async () => {
  class Foo {
    public static prop = 1;
  }

  Foo.prop = 2;

  const closure = await expectClosure(() => {
    return Foo.prop;
  });

  expect(closure()).toEqual(2);
});

test("serialize a monkey-patched class method", async () => {
  let i = 0;
  class Foo {
    public method() {
      i += 1;
    }
  }

  Foo.prototype.method = function () {
    i += 2;
  };

  const closure = await expectClosure(() => {
    const foo = new Foo();

    foo.method();
    foo.method();
    return i;
  });

  expect(closure()).toEqual(4);
});

test("serialize a monkey-patched class method that has been re-set", async () => {
  let i = 0;
  class Foo {
    public method() {
      i += 1;
    }
  }

  const method = Foo.prototype.method;

  Foo.prototype.method = function () {
    i += 2;
  };

  const closure = () => {
    const foo = new Foo();

    foo.method();

    Foo.prototype.method = method;

    foo.method();
    return i;
  };

  const serialized = await expectClosure(closure);

  expect(closure()).toEqual(3);
  expect(serialized()).toEqual(3);
});

test("serialize a monkey-patched class getter", async () => {
  let i = 0;
  class Foo {
    public get method() {
      return (i += 1);
    }
  }

  Object.defineProperty(Foo.prototype, "method", {
    get() {
      return (i += 2);
    },
  });

  const closure = await expectClosure(() => {
    const foo = new Foo();

    foo.method;
    foo.method;
    return i;
  });

  expect(closure()).toEqual(4); // equals 2 if monkey patch not applied
});

test("serialize a monkey-patched class setter", async () => {
  let i = 0;
  class Foo {
    public set method(val: number) {
      i += val;
    }
  }

  Object.defineProperty(Foo.prototype, "method", {
    set(val: number) {
      i += val + 1;
    },
  });

  const closure = await expectClosure(() => {
    const foo = new Foo();

    foo.method = 1;
    foo.method = 1;
    return i;
  });

  expect(closure()).toEqual(4); // equals 2 if monkey patch not applied
});

test("serialize a monkey-patched class getter and setter", async () => {
  let i = 0;
  class Foo {
    public set method(val: number) {
      i += val;
    }
    public get method() {
      return i;
    }
  }

  Object.defineProperty(Foo.prototype, "method", {
    set(val: number) {
      i += val + 1;
    },
    get() {
      return i + 1;
    },
  });

  const closure = await expectClosure(() => {
    const foo = new Foo();

    foo.method = 1;
    foo.method = 1;
    return foo.method;
  });

  expect(closure()).toEqual(5); // equals 2 if monkey patch not applied
});

test("serialize a monkey-patched class getter while setter remains unchanged", async () => {
  let i = 0;
  class Foo {
    public set method(val: number) {
      i += val;
    }
    public get method() {
      return i;
    }
  }

  Object.defineProperty(Foo.prototype, "method", {
    set: Object.getOwnPropertyDescriptor(Foo.prototype, "method")?.set!,
    get() {
      return i + 1;
    },
  });

  const closure = await expectClosure(() => {
    const foo = new Foo();

    foo.method = 1;
    foo.method = 1;
    return foo.method;
  });

  expect(closure()).toEqual(3);
});

test("serialize a class hierarchy", async () => {
  let i = 0;
  class Foo {
    public method() {
      return (i += 1);
    }
  }

  class Bar extends Foo {
    public method() {
      return super.method() + 1;
    }
  }

  const closure = await expectClosure(() => {
    const bar = new Bar();

    return [bar.method(), i];
  });

  expect(closure()).toEqual([2, 1]);
});

test("serialize a class mix-in", async () => {
  let i = 0;
  const mixin = () =>
    class Foo {
      public method() {
        return (i += 1);
      }
    };

  class Bar extends mixin() {
    public method() {
      return super.method() + 1;
    }
  }

  const closure = await expectClosure(() => {
    const bar = new Bar();

    return [bar.method(), i];
  });

  expect(closure()).toEqual([2, 1]);
});

test("avoid name collision with a closure's lexical scope", async () => {
  let v0 = 0;
  class v1 {
    public foo() {
      return (v0 += 1);
    }
  }
  class v2 extends v1 {}

  const closure = await expectClosure(() => {
    const v3 = new v2();
    return v3.foo();
  });

  expect(closure()).toEqual(1);
});

test("avoid collision with a locally scoped variable", async () => {
  const one = 1;
  const closure = await expectClosure(() => {
    // capture the v0 free variable
    let free = one;
    // shadow the v0 free variable
    const v1 = 2;
    return v1 + free;
  });

  expect(closure()).toEqual(3);
});

test("avoid collision with a locally scoped object binding variable", async () => {
  const one = 1;
  const closure = await expectClosure(() => {
    // capture the v0 free variable
    let free = one;
    // shadow the v0 free variable
    const { v1 } = { v1: 2 };
    return v1 + free;
  });

  expect(closure()).toEqual(3);
});

test("avoid collision with a locally scoped object binding variable with renamed property", async () => {
  const one = 1;
  const closure = await expectClosure(() => {
    // capture the v0 free variable
    let free = one;
    // shadow the v0 free variable
    const { v2: v1 } = { v2: 2 };
    return v1 + free;
  });

  expect(closure()).toEqual(3);
});

test("avoid collision with a locally scoped array binding", async () => {
  const one = 1;
  const closure = await expectClosure(() => {
    // capture the v0 free variable
    let free = one;
    // shadow the v0 free variable
    const [v1] = [2];
    return v1 + free;
  });

  expect(closure()).toEqual(3);
});

test("avoid collision with a locally scoped array binding with nested object binding", async () => {
  const one = 1;
  const closure = await expectClosure(() => {
    // capture the v0 free variable
    let free = one;
    // shadow the v0 free variable
    const [{ v1 }] = [{ v1: 2 }];
    return v1 + free;
  });

  expect(closure()).toEqual(3);
});

test("avoid collision with a locally scoped function", async () => {
  const one = 1;
  const closure = await expectClosure(() => {
    // capture the v0 free variable
    let free = one;
    // shadow the v0 free variable
    function v1() {
      return 2;
    }
    return v1() + free;
  });

  expect(closure()).toEqual(3);
});

test("avoid collision with a locally scoped class", async () => {
  const one = 1;
  const closure = await expectClosure(() => {
    // capture the v0 free variable
    let free = one;
    // shadow the v0 free variable
    class v1 {
      foo = 2;
    }
    return new v1().foo + free;
  });

  expect(closure()).toEqual(3);
});

test("avoid collision with a parameter declaration", async () => {
  const one = 1;
  const closure = await expectClosure((v1: number) => {
    // capture the v0 free variable
    let free = one;
    return v1 + free;
  });

  expect(closure(2)).toEqual(3);
});

test("avoid collision with a parameter object binding", async () => {
  const one = 1;
  const closure = await expectClosure(({ v1 }: { v1: number }) => {
    // capture the v0 free variable
    let free = one;
    return v1 + free;
  });

  expect(closure({ v1: 2 })).toEqual(3);
});

test("avoid collision with a parameter object binding renamed", async () => {
  const one = 1;
  const closure = await expectClosure(({ v2: v1 }: { v2: number }) => {
    // capture the v0 free variable
    let free = one;
    return v1 + free;
  });

  expect(closure({ v2: 2 })).toEqual(3);
});

test("avoid collision with a parameter array binding", async () => {
  const one = 1;
  const closure = await expectClosure(([v1]: [number]) => {
    // capture the v0 free variable
    let free = one;
    return v1 + free;
  });

  expect(closure([2])).toEqual(3);
});

test("avoid collision with a parameter with object binding nested in array binding", async () => {
  const one = 1;
  const closure = await expectClosure(([{ v1 }]: [{ v1: number }]) => {
    // capture the v0 free variable
    let free = one;
    return v1 + free;
  });

  expect(closure([{ v1: 2 }])).toEqual(3);
});

test("instantiating the AWS SDK", async () => {
  const closure = await expectClosure(() => {
    const client = new AWS.DynamoDB();

    return client.config.endpoint;
  });

  expect(closure()).toEqual("dynamodb.undefined.amazonaws.com");
});

test.skip("instantiating the AWS SDK without esbuild", async () => {
  const closure = await expectClosure(
    () => {
      const client = new AWS.DynamoDB();
      return client.config.endpoint;
    },
    {
      requireModules: false,
    }
  );
  expect(closure()).toEqual("dynamodb.undefined.amazonaws.com");
});

test("instantiating the AWS SDK v3", async () => {
  const closure = await expectClosure(() => {
    const client = new DynamoDBClient({});

    return client.config.serviceId;
  });

  expect(closure()).toEqual("DynamoDB");
});

test.skip("instantiating the AWS SDK v3 without esbuild", async () => {
  const closure = await expectClosure(
    () => {
      const client = new DynamoDBClient({});

      return client.config.serviceId;
    },
    {
      requireModules: false,
    }
  );

  expect(closure()).toEqual("DynamoDB");
});

test("serialize a bound function", async () => {
  const func = function foo(this: { prop: string }) {
    return this.prop;
  };

  const bound = func.bind({
    prop: "hello",
  });

  const closure = await expectClosure(() => {
    return bound();
  });

  expect(closure()).toEqual("hello");
});

test("serialize a proxy", async () => {
  const proxy = new Proxy(
    {
      value: "hello",
    },
    {
      get: (self, name) => {
        return `${self[name as keyof typeof self]} world`;
      },
    }
  );

  const closure = await expectClosure(() => {
    return proxy.value;
  });

  expect(closure()).toEqual("hello world");
});

test("thrown errors map back to source", async () => {
  const closure = await expectClosure(() => {
    throw new Error("oops");
  });

  let failed = false;
  try {
    closure();
  } catch (err) {
    failed = true;
    console.log((err as Error).stack);
  }
  if (!failed) {
    fail("expected a thrown erro");
  }
});

test("serialize a class value", async () => {
  class Foo {
    constructor(readonly value: string) {}
    public method() {
      return `hello ${this.value}`;
    }
  }
  const foo = new Foo("world");

  const closure = await expectClosure(() => foo.method());

  expect(closure()).toEqual("hello world");
});

test("serialize a class method calling super", async () => {
  class Foo {
    constructor(readonly value: string) {}
    public method() {
      return `hello ${this.value}`;
    }
  }
  class Bar extends Foo {
    public method() {
      return `${super.method()}!`;
    }
  }
  const foo = new Bar("world");

  const closure = await expectClosure(() => foo.method());

  expect(closure()).toEqual("hello world!");
});

test("serialize a this reference in an object literal", async () => {
  const obj = {
    prop: "prop",
    get() {
      return this.prop;
    },
  };

  const closure = await expectClosure(() => obj.get());

  expect(closure()).toEqual("prop");
});

test("broad spectrum syntax test", async () => {
  const closure = await expectClosure(async () => {
    const arrowExpr = (a: string, ...b: string[]) => [a, ...b];
    const arrowBlockExpr = (a: string, ...b: string[]) => {
      return [a, ...b];
    };
    function funcDecl(a: string, ...b: string[]) {
      return [a, ...b];
    }
    const funcExpr = function funcExpr(a: string, ...b: string[]) {
      return [a, ...b];
    };
    const anonFuncExpr = function (a: string, ...b: string[]) {
      return [a, ...b];
    };

    let getterSetterVal: string;
    const obj = {
      prop: "prop",
      getProp() {
        return this.prop + " 1";
      },
      get getterSetter(): string {
        return getterSetterVal;
      },
      set getterSetter(val: string) {
        getterSetterVal = val;
      },
    };

    // destructuring
    const {
      a,
      b: c,
      d: [e],
      f = "f",
    } = {
      a: "a",
      b: "b",
      d: ["e"],
    };

    obj.getterSetter = "getterSetter";

    class Foo {
      static VAL = "VAL";
      static {
        Foo.VAL = "VAL 1";
        this.VAL = `${this.VAL} 2`;
      }
      readonly val: string;
      constructor(readonly prop: string, val: string) {
        this.val = val;
      }
      public method() {
        return `${this.prop} ${this.val} ${Foo.VAL}`;
      }

      public async asyncMethod() {
        const result = await new Promise<string>((resolve) =>
          resolve("asyncResult")
        );
        return result;
      }

      public *generatorMethod(): any {
        yield "yielded item";
        yield* generatorFuncDecl();
        yield* generatorFuncExpr();
        yield* anonGeneratorFuncExpr();
      }
    }

    function* generatorFuncDecl() {
      yield "yielded in function decl";
    }

    const generatorFuncExpr = function* generatorFuncExpr() {
      yield "yielded in function expr";
    };

    const anonGeneratorFuncExpr = function* () {
      yield "yielded in anonymous function expr";
    };

    class Bar extends Foo {
      constructor() {
        super("bar prop", "bar val");
      }

      public method() {
        return `bar ${super.method()}`;
      }
    }

    const foo = new Foo("foo prop", "foo val");
    const bar = new Bar();
    const generator = foo.generatorMethod();

    function ifTest(condition: 0 | 1 | 2) {
      if (condition === 0) {
        return "if";
      } else if (condition === 1) {
        return "else if";
      } else {
        return "else";
      }
    }

    const whileStmts = [];
    while (whileStmts.length === 0) {
      whileStmts.push("while block");
    }

    while (whileStmts.length === 1) whileStmts.push("while stmt");

    const doWhileStmts = [];
    do {
      doWhileStmts.push("do while block");
    } while (doWhileStmts.length === 0);

    do doWhileStmts.push("do while stmt");
    while (doWhileStmts.length === 1);

    const whileTrue = [];
    while (true) {
      whileTrue.push(`while true ${whileTrue.length}`);
      if (whileTrue.length === 1) {
        continue;
      }
      break;
    }

    const tryCatchErr = [];
    try {
      tryCatchErr.push("try");
      throw new Error("catch");
    } catch (err: any) {
      tryCatchErr.push(err.message);
    } finally {
      tryCatchErr.push("finally");
    }

    const tryCatch = [];
    try {
      tryCatch.push("try 2");
      throw new Error("");
    } catch {
      tryCatch.push("catch 2");
    } finally {
      tryCatch.push("finally 2");
    }

    const tryNoFinally = [];
    try {
      tryNoFinally.push("try 3");
      throw new Error("");
    } catch {
      tryNoFinally.push("catch 3");
    }

    const tryNoCatch: string[] = [];
    try {
      (() => {
        try {
          tryNoCatch.push("try 4");
          throw new Error("");
        } finally {
          tryNoCatch.push("finally 4");
        }
      })();
    } catch {}

    const deleteObj: any = {
      notDeleted: "value",
      prop: "prop",
      "spaces prop": "spaces prop",
      [Symbol.for("prop")]: "symbol prop",
    };
    delete deleteObj.prop;
    delete deleteObj["spaces prop"];
    delete deleteObj[Symbol.for("prop")];

    const regex = /a.*/g;

    let unicode;
    {
      var HECOMḚṮH = 42;
      const _ = "___";
      const $ = "$$";
      const ƒ = {
        π: Math.PI,
        ø: [],
        Ø: NaN,
        e: 2.7182818284590452353602874713527,
        root2: 2.7182818284590452353602874713527,
        α: 2.5029,
        δ: 4.6692,
        ζ: 1.2020569,
        φ: 1.61803398874,
        γ: 1.30357,
        K: 2.685452001,
        oo: 9999999999e999 * 9999999999e9999,
        A: 1.2824271291,
        C10: 0.12345678910111213141516171819202122232425252728293031323334353637,
        c: 299792458,
      };
      unicode = { ƒ, out: `${HECOMḚṮH}${_}${$}` };
    }

    var homecometh = { H̹̙̦̮͉̩̗̗ͧ̇̏̊̾Eͨ͆͒̆ͮ̃͏̷̮̣̫̤̣Cͯ̂͐͏̨̛͔̦̟͈̻O̜͎͍͙͚̬̝̣̽ͮ͐͗̀ͤ̍̀͢M̴̡̲̭͍͇̼̟̯̦̉̒͠Ḛ̛̙̞̪̗ͥͤͩ̾͑̔͐ͅṮ̴̷̷̗̼͍̿̿̓̽͐H̙̙̔̄͜: 42 };

    const parens = (2 + 3) * 2;

    function tag(strings: TemplateStringsArray, ...args: number[]) {
      // hi is tag function
      return `tag ${strings.map((str, i) => `${str} ${args[i]}`).join("|")}`;
    }

    const noSubstitutionTemplateLiteral = `hello world`;

    // eslint-disable-next-line no-debugger
    debugger;

    return [
      ...arrowExpr("a", "b", "c"),
      ...arrowBlockExpr("A", "B", "C"),
      ...funcDecl("d", "e", "f"),
      ...funcExpr("g", "h", "i"),
      ...anonFuncExpr("j", "k", "l"),
      obj.prop,
      obj.getProp(),
      obj.getterSetter,
      a,
      c,
      e,
      f,
      (() => {
        return "foo";
      })(),
      (function () {
        return "bar";
      })(),
      (function baz() {
        return "baz";
      })(),
      foo.method(),
      bar.method(),
      await foo.asyncMethod(),
      generator.next().value,
      generator.next().value,
      generator.next().value,
      generator.next().value,
      ifTest(0),
      ifTest(1),
      ifTest(2),
      ...whileStmts,
      ...doWhileStmts,
      ...whileTrue,
      ...tryCatchErr,
      ...tryCatch,
      ...tryNoFinally,
      ...tryNoCatch,
      deleteObj,
      regex.test("abc"),
      unicode,
      homecometh,
      parens,
      tag`${1} + ${2} + ${3}`,
      noSubstitutionTemplateLiteral,
      typeof "hello world",
      void 0,
    ];
  });

  expect(await closure()).toEqual([
    "a",
    "b",
    "c",
    "A",
    "B",
    "C",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "prop",
    "prop 1",
    "getterSetter",
    "a",
    "b",
    "e",
    "f",
    "foo",
    "bar",
    "baz",
    "foo prop foo val VAL 1 2",
    "bar bar prop bar val VAL 1 2",
    "asyncResult",
    "yielded item",
    "yielded in function decl",
    "yielded in function expr",
    "yielded in anonymous function expr",
    "if",
    "else if",
    "else",
    "while block",
    "while stmt",
    "do while block",
    "do while stmt",
    "while true 0",
    "while true 1",
    "try",
    "catch",
    "finally",
    "try 2",
    "catch 2",
    "finally 2",
    "try 3",
    "catch 3",
    "try 4",
    "finally 4",
    {
      notDeleted: "value",
    },
    true,
    {
      out: "42___$$",
      ƒ: {
        A: 1.2824271291,
        C10: 0.12345678910111213,
        K: 2.685452001,
        c: 299792458,
        e: 2.718281828459045,
        oo: Infinity,
        root2: 2.718281828459045,
        Ø: NaN,
        ø: [],
        α: 2.5029,
        γ: 1.30357,
        δ: 4.6692,
        ζ: 1.2020569,
        π: 3.141592653589793,
        φ: 1.61803398874,
      },
    },
    { H̹̙̦̮͉̩̗̗ͧ̇̏̊̾Eͨ͆͒̆ͮ̃͏̷̮̣̫̤̣Cͯ̂͐͏̨̛͔̦̟͈̻O̜͎͍͙͚̬̝̣̽ͮ͐͗̀ͤ̍̀͢M̴̡̲̭͍͇̼̟̯̦̉̒͠Ḛ̛̙̞̪̗ͥͤͩ̾͑̔͐ͅṮ̴̷̷̗̼͍̿̿̓̽͐H̙̙̔̄͜: 42 },
    10,
    "tag  1| +  2| +  3| undefined",
    "hello world",
    "string",
    void 0,
  ]);
});
