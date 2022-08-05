import "jest";
// import { serializeClosure } from "../src/serialize-closure";

test("reference to imported function", () => {
  expect(1).toEqual(1);
  // serializeClosure(() => {
  //   return serializeClosure;
  // });
});
