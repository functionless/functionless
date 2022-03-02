import { App, aws_lambda, Stack } from "aws-cdk-lib";
import "jest";
import { ExpressStepFunction, Function } from "../src";

interface Person {
  id: string;
  name: string;
}

const app = new App({
  autoSynth: false,
});
const stack = new Stack(app, "stack");

const getPerson = new Function<(id: string) => Person | undefined>(
  new aws_lambda.Function(stack, "Func", {
    code: aws_lambda.Code.fromInline(
      "exports.handle = function() { return null }"
    ),
    handler: "index.handle",
    runtime: aws_lambda.Runtime.NODEJS_14_X,
  })
);

test("test", () => {
  const fn = new ExpressStepFunction((id: string): Person | undefined => {
    const person = getPerson(id);
    return person;
  });

  fn.createStateMachine(stack, "test1");
});
