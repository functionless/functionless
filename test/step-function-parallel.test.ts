import "jest";
import { $SFN, ExpressStepFunction } from "../src";
import { initStepFunctionApp } from "./util";

/**
 * Was forced to split out step-function.test.ts because V8 was crashing ...
 */

test('return $SFN.parallel(() => "hello", () => "world"))', () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", () => {
    return $SFN.parallel(
      () => "hello",
      () => "world"
    );
  }).definition;

  expect(definition).toEqual({});
});
