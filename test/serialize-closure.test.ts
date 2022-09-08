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
  const closure = serializeClosure(f, options);
  expect(closure).toMatchSnapshot();
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
      useESBuild: false,
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
      useESBuild: false,
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
