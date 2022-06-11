/**
 * Error to throw during synth failures
 */
export class SynthError extends Error {
  constructor(readonly code: ErrorCode, message: string) {
    super(formatErrorMessage(code, message));
  }
}
const baseUrl = process.env.FUNCTIONLESS_LOCAL
  ? `http://localhost:3000`
  : `https://functionless.org`;

export const formatErrorMessage = (code: ErrorCode, messageText?: string) => `${
  messageText ?? code.messageText
}

${formatErrorUrl(code)}`;

const formatErrorUrl = (code: ErrorCode) => {
  return `${baseUrl}/docs/error-codes#${code.messageText
    .toLowerCase()
    .replace(/\s/g, "-")}`;
};

export interface ErrorCode {
  code: number;
  messageText: string;
}

export namespace ErrorCodes {
  /**
   * The computations that [Amazon States Language](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html)
   * can do is restricted by JSON Path and the limited [Intrinsic Functions](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-intrinsic-functions.html). Currently, arithmetic expressions are not supported.
   * ```ts
   * // ok
   * new StepFunction(scope, id, () => 1 + 2);
   *
   * // illegal!
   * new StepFunction(scope, id, (input: { num: number }) => input.number + 1);
   * ```
   *
   * To workaround, use a Lambda Function to implement the arithmetic expression. Be aware that this comes with added cost and operational risk.
   *
   * ```ts
   * const add = new Function(scope, "add", (input: { a: number, b: number }) => input.a + input.b);
   *
   * new StepFunction(scope, id, async (input: { num: number }) => {
   *   await add({a: input.number, b: 1});
   * });
   * ```
   */
  export const Cannot_perform_arithmetic_on_variables_in_Step_Function: ErrorCode =
    {
      code: 100,
      messageText: "Cannot perform arithmetic on variables in Step Function",
    };

  /**
   * During CDK synth a function was encountered which was not compiled by the Functionless compiler plugin.
   * This suggests that the plugin was not correctly configured for this project.
   *
   * Ensure you follow the instructions at https://functionless.org/docs/getting-started.
   */
  export const FunctionDecl_not_compiled_by_Functionless: ErrorCode = {
    code: 101,
    messageText: "Function not compiled by Functionless plugin",
  };
}
