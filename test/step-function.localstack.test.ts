import { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StepFunction, Function, $AWS, $SFN } from "../src";
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

  test("call lambda with array parameter", (parent) => {
    const func = new Function<number[], number>(
      parent,
      "func",
      {
        timeout: Duration.seconds(20),
      },
      async (event) => {
        return event.length;
      }
    );
    return new StepFunction(parent, "sfn2", async () => {
      return func([1, 2]);
    });
  }, 2);

  test("call lambda with array ref", (parent) => {
    const func = new Function<number[], number>(
      parent,
      "func",
      {
        timeout: Duration.seconds(20),
      },
      async (event) => {
        return event.length;
      }
    );
    return new StepFunction(parent, "sfn2", async () => {
      const arr = [1, 2, 3];
      return func(arr);
    });
  }, 3);

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

  test(
    "call lambda $SFN wait",
    (parent) => {
      return new StepFunction(parent, "sfn2", async () => {
        $SFN.waitFor(1);
      });
    },
    null
  );

  test(
    "call lambda $SFN map",
    (parent) => {
      return new StepFunction(parent, "sfn2", async (input) => {
        return $SFN.map(input.arr, (n) => {
          return n;
        });
      });
    },
    [1, 2],
    { arr: [1, 2] }
  );

  test(
    "call lambda $SFN forEach",
    (parent) => {
      const func = new Function<number, void>(
        parent,
        "func",
        {
          timeout: Duration.seconds(20),
        },
        async (event) => {
          console.log(event);
        }
      );
      return new StepFunction(parent, "sfn2", async (input) => {
        await $SFN.forEach(input.arr, (n) => func(n));
      });
    },
    null,
    { arr: [1, 2] }
  );

  test(
    "call lambda $SFN parallel",
    (parent) => {
      return new StepFunction(parent, "sfn2", async () => {
        return $SFN.parallel(
          () => 1,
          () => 2
        );
      });
    },
    [1, 2]
  );

  test(
    "binaryOps logic",
    (parent) => {
      return new StepFunction(parent, "sfn2", async (input) => {
        const c = input.a && input.b;
        return {
          andVar: c,
          and: input.a && input.b,
          or: input.a || input.b,
          nullCoal: input.v ?? input.nv,
          invNullCoal: input.nv ?? input.v,
          nullNull: input.nv ?? null,
          nullVal: null ?? input.v,
        };
      });
    },
    {
      andVar: false,
      and: false,
      or: true,
      nullCoal: "val",
      invNullCoal: "val",
      nullNull: null,
      nullVal: "val",
    },
    { a: true, b: false, v: "val", nv: undefined }
  );

  // localstack sends and empty object to lambda instead of boolean/numbers
  // https://github.com/localstack/localstack/issues/6362
  test.skip(
    "binaryOps logic with calls passed boolean",
    (parent) => {
      const func = new Function<boolean, boolean>(
        parent,
        "func",
        {
          timeout: Duration.seconds(20),
        },
        async (event) => {
          console.log(typeof event);
          console.log(event);
          return !event;
        }
      );
      return new StepFunction(parent, "sfn2", async () => {
        return {
          and: true && (await func(false)),
          or: false || (await func(false)),
        };
      });
    },
    {
      and: true,
      or: true,
    }
  );

  test(
    "binaryOps logic with calls",
    (parent) => {
      const func = new Function<undefined, boolean>(
        parent,
        "func",
        {
          timeout: Duration.seconds(20),
        },
        async () => {
          return true;
        }
      );
      return new StepFunction(parent, "sfn2", async () => {
        return {
          and: true && (await func()),
          or: false || (await func()),
        };
      });
    },
    {
      and: true,
      or: true,
    }
  );

  test(
    "overlapping variable with input",
    (parent) => {
      return new StepFunction(parent, "sfn2", async (input) => {
        const a = "2";
        return { a: input.a, b: a };
      });
    },
    { a: "1", b: "2" },
    { a: "1" }
  );

  // breaking test, will fix
  // b = a incorrectly uses output path
  // { Pass, { result.$: "$.a" }, resultPath: "$.b", outputPath: "$.result" }
  // this won't work for multiple reasons, output path will write over the entire state
  test(
    "assignment",
    (parent) => {
      return new StepFunction(parent, "sfn2", async () => {
        let a: any = "2";
        const b = a;
        a = null;
        const c = a;
        a = 1;
        const d = a;
        a = [1, 2];
        const e = a;
        a = { x: "val" };
        return { a, b, c, d, e };
      });
    },
    { a: { x: "val" }, b: "2", c: null, d: 1, e: [1, 2] }
  );

  test(
    "templates",
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
      return new StepFunction<
        { obj: { str: string; str2?: string; items: number[] } },
        string
      >(parent, "fn", async (input) => {
        const partOfTheTemplateString = `hello ${input.obj.str2 ?? "default"}`;

        const result = await func(
          `${input.obj.str} ${"hello"} ${partOfTheTemplateString} ${
            input.obj.items[0]
          }`
        );

        return `the result: ${result.str}`;
      });
    },
    "the result: hullo hello hello default 1",
    { obj: { str: "hullo", items: [1] } }
  );

  test(
    "templates simple",
    (parent) => {
      return new StepFunction(parent, "fn", async (input) => {
        const x = input.str;
        return `${x}`;
      });
    },
    "hi",
    { str: "hi" }
  );
});
