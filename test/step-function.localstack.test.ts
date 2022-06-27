import { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StepFunction, Function, $AWS } from "../src";
import { localstackTestSuite } from "./localstack";
import { testStepFunction } from "./runtime-util";
import { normalizeCDKJson } from "./util";

interface TestExpressStepFunctionBase {
  <
    I extends Record<string, any>,
    O,
    // Forces typescript to infer O from the Function and not from the expect argument.
    OO extends O | { errorMessage: string; errorType: string },
    Outputs extends Record<string, string> = Record<string, string>
  >(
    name: string,
    sfn: (
      parent: Construct
    ) => StepFunction<I, O> | { sfn: StepFunction<I, O>; outputs: Outputs },
    expected: OO extends void
      ? null
      : OO | ((context: Outputs) => OO extends void ? null : O),
    payload?: I | ((context: Outputs) => I)
  ): void;
}

interface TestExpressStepFunctionResource extends TestExpressStepFunctionBase {
  skip: TestExpressStepFunctionBase;
  only: TestExpressStepFunctionBase;
}

localstackTestSuite("sfnStack", (testResource, _stack, _app) => {
  const _testSfn: (
    f: typeof testResource | typeof testResource.only
  ) => TestExpressStepFunctionBase = (f) => (name, sfn, expected, payload) => {
    f(
      name,
      (parent) => {
        const res = sfn(parent);
        const [funcRes, outputs] =
          res instanceof StepFunction ? [res, {}] : [res.sfn, res.outputs];
        return {
          outputs: {
            function: funcRes.resource.stateMachineArn,
            ...outputs,
          },
          extra: {
            definition: JSON.stringify(funcRes.definition),
          },
        };
      },
      async (context, extra) => {
        const exp =
          // @ts-ignore
          typeof expected === "function" ? expected(context) : expected;
        // @ts-ignore
        const pay = typeof payload === "function" ? payload(context) : payload;
        expect(
          normalizeCDKJson(JSON.parse(extra!.definition))
        ).toMatchSnapshot();
        await testStepFunction(context.function, pay, exp);
      }
    );
  };

  const test = _testSfn(testResource) as TestExpressStepFunctionResource;

  test.skip = (name, _func, _expected, _payload?) =>
    testResource.skip(
      name,
      () => {},
      async () => {}
    );

  // eslint-disable-next-line no-only-tests/no-only-tests
  test.only = _testSfn(testResource.only);

  test(
    "simple",
    (parent) => {
      return new StepFunction(parent, "sfn2", async () => {
        return "hello world";
      });
    },
    "hello world"
  );

  test(
    "call lambda",
    (parent) => {
      const func = new Function<undefined, string>(
        parent,
        "func",
        {
          timeout: Duration.seconds(20),
        },
        async (_event) => {
          return "hello world";
        }
      );
      return new StepFunction(parent, "sfn2", async () => {
        return func();
      });
    },
    "hello world"
  );

  test(
    "call lambda with string reference",
    (parent) => {
      const func = new Function<string, { str: string }>(
        parent,
        "func",
        {
          timeout: Duration.seconds(20),
        },
        async (event) => {
          return { str: event };
        }
      );
      return new StepFunction<{ str: string }, string>(
        parent,
        "sfn2",
        async (event) => {
          return (await func(event.str)).str;
        }
      );
    },
    "hello world",
    { str: "hello world" }
  );

  test(
    "call lambda with string parameter",
    (parent) => {
      const func = new Function<string, { str: string }>(
        parent,
        "func",
        {
          timeout: Duration.seconds(20),
        },
        async (event) => {
          return { str: event };
        }
      );
      return new StepFunction(parent, "sfn2", async () => {
        return (await func("hello world")).str;
      });
    },
    "hello world"
  );

  test(
    "call lambda with object literal parameter",
    (parent) => {
      const func = new Function<{ str: string }, { str: string }>(
        parent,
        "func",
        {
          timeout: Duration.seconds(20),
        },
        async (event) => {
          return event;
        }
      );
      return new StepFunction(parent, "sfn2", async () => {
        return (await func({ str: "hello world" })).str;
      });
    },
    "hello world"
  );

  test(
    "call lambda with object reference parameter",
    (parent) => {
      const func = new Function<{ str: string }, { str: string }>(
        parent,
        "func",
        {
          timeout: Duration.seconds(20),
        },
        async (event) => {
          return event;
        }
      );
      return new StepFunction(parent, "sfn2", async () => {
        const obj = { str: "hello world" };
        return (await func(obj)).str;
      });
    },
    "hello world"
  );

  test(
    "call lambda $AWS invoke",
    (parent) => {
      const func = new Function<{ str: string }, { str: string }>(
        parent,
        "func",
        {
          timeout: Duration.seconds(20),
        },
        async (event) => {
          return event;
        }
      );
      return new StepFunction(parent, "sfn2", async () => {
        const obj = { str: "hello world" };
        return (
          await $AWS.Lambda.Invoke({
            Function: func,
            Payload: obj,
          })
        ).Payload.str;
      });
    },
    "hello world"
  );
});
