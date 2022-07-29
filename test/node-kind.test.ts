import "jest";

import { NodeKind } from "../src/node-kind";

describe("no duplicate ids", () => {
  const seen = new Map<NodeKind, string[]>();
  Object.entries(NodeKind).forEach(([name, code]) => {
    if (typeof code === "number") {
      if (!seen.has(code)) {
        seen.set(code, [name]);
      } else {
        seen.get(code)!.push(name);
      }
    }
  });

  for (const [code, names] of seen) {
    test(`NodeKind(${code})`, () => {
      if (names.length > 1) {
        fail(
          `NodeKind(${code}) is used more than once by [${names.join(", ")}]`
        );
      }
    });
  }
});
