import { AnyFunction } from "@functionless/ast";
import {
  FunctionlessEventPattern,
  synthesizeEventPattern,
  synthesizePatternDocument,
} from "@functionless/aws-events-constructs";

export function ebEventPatternTestCase(
  decl: AnyFunction,
  expected: FunctionlessEventPattern
) {
  const document = synthesizePatternDocument(decl);
  const result = synthesizeEventPattern(document);

  expect(result).toEqual(expected);
}

export function ebEventPatternTestCaseError(
  decl: AnyFunction,
  message?: string
) {
  expect(() => {
    const document = synthesizePatternDocument(decl);
    synthesizeEventPattern(document);
  }).toThrow(message);
}
