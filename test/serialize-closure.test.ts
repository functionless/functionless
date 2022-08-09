import "jest";

import { serializeClosure } from "../src/serialize-closure";

test("serialize a closure", () => {
  let i = 0;
  const closure = serializeClosure(() => {
    i += 1;
    return i;
  });

  expect(closure).toEqual(`const v0 = () => { 0 += 1; return 0; };
exports.handler = v0;
`);
});
