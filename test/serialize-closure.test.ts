import "jest";

import { isNode } from "../src/guards";
import { serializeClosure } from "../src/serialize-closure";

test("all observers of a free variable share the same reference", () => {
  let i = 0;

  function up() {
    i += 1;
  }

  function down() {
    i -= 1;
  }

  const closure = serializeClosure(() => {
    up();
    down();
    return i;
  });

  expect(closure).toEqual(`var v3 = 0;
const v2 = function up() { v3 += 1; };
var v1 = v2;
const v5 = function down() { v3 -= 1; };
var v4 = v5;
const v0 = () => { v1(); v4(); return v3; };
exports.handler = v0;
`);
});

test("serialize an imported module", () => {
  const closure = serializeClosure(isNode);

  expect(closure)
    .toEqual(`const v0 = function isNode(a) { return typeof a?.kind === \"number\"; };
exports.handler = v0;
`);
});

test("serialize a class declaration", () => {
  let i = 0;
  class Foo {
    public method() {
      i++;
      return i;
    }
  }

  const closure = serializeClosure(() => {
    const foo = new Foo();

    foo.method();
    foo.method();
    return i;
  });

  expect(closure).toEqual(`var v3 = 0;
const v2 = class Foo {
    method() { v3++; return v3; }
};
var v1 = v2;
const v0 = () => { const foo = v1(); foo.method(); foo.method(); return v3; };
exports.handler = v0;
`);
});
