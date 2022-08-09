import "jest";

import { serializeClosure } from "../src/serialize-closure";

test("serialize a closure", () => {
  let i = 0;
  const closure = serializeClosure(() => {
    i += 1;
    return i;
  });

  expect(closure).toEqual("");
});
