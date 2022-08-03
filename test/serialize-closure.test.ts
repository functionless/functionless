import "jest";
import { serializeClosure } from "../src/serialize-closure";

test("reference to imported function", () => {
  serializeClosure(() => {
    return serializeClosure;
  });
});
