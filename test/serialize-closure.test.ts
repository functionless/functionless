import "jest";
import fs from "fs";
import path from "path";
import { v4 } from "uuid";
import { AnyFunction } from "../src";

import { isNode } from "../src/guards";
import { serializeClosure } from "../src/serialize-closure";

const tmpDir = path.join(__dirname, ".test");
beforeAll(async () => {
  await fs.promises.mkdir(tmpDir);
});

const cleanup = true;

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
