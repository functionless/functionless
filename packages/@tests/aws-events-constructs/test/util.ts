import { AnyFunction, reflect } from "@functionless/ast";
import {
  EventTransformFunction,
  FunctionlessEventPattern,
  synthesizeEventBridgeTargets,
  synthesizeEventPattern,
  synthesizePatternDocument,
} from "@functionless/aws-events-constructs";
import { Event } from "@functionless/aws-events";
import { aws_events, Stack } from "aws-cdk-lib";

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});

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

export function ebEventTargetTestCase<T extends Event>(
  decl: EventTransformFunction<T>,
  targetInput: aws_events.RuleTargetInput
) {
  const result = synthesizeEventBridgeTargets(reflect(decl) as any);

  const rule = new aws_events.Rule(stack, "testrule");

  // input template can contain tokens, lets fix that.

  const {
    inputTemplate: recievedTemplate,
    input: recievedInput,
    ...recieved
  } = result.bind(rule);
  const {
    inputTemplate: expectedTemplate,
    input: expectedInput,
    ...expected
  } = targetInput.bind(rule);

  expect({
    ...recieved,
    inputTemplate: stack.resolve(recievedTemplate),
    input: stack.resolve(recievedInput),
  }).toEqual({
    ...expected,
    inputTemplate: stack.resolve(expectedTemplate),
    input: stack.resolve(expectedInput),
  });
}

export function ebEventTargetTestCaseError<T extends Event>(
  decl: EventTransformFunction<T>,
  message?: string
) {
  expect(() => synthesizeEventBridgeTargets(reflect(decl) as any)).toThrow(
    message
  );
}
