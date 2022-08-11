import "jest";
import fs from "fs";
import path from "path";
import { v4 } from "uuid";
import { AnyFunction } from "../src";

import { isNode } from "../src/guards";
import { serializeClosure } from "../src/serialize-closure";

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

async function expectClosure<F extends AnyFunction>(f: F): Promise<F> {
  const closure = serializeClosure(f);
  expect(closure).toMatchSnapshot();
  const jsFile = path.join(tmpDir, `${v4()}.js`);
  await fs.promises.writeFile(jsFile, closure);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(jsFile).handler as F;
}

test("all observers of a free variable share the same reference", async () => {
  let i = 0;

  function up() {
    i += 1;
  }

  function down() {
    i -= 1;
  }

  const closure = await expectClosure(() => {
    up();
    down();
    return i;
  });

  expect(closure()).toEqual(0);
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
