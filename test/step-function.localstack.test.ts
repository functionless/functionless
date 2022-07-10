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
    "duplicate nodes",
    (parent) => {
      return new StepFunction(parent, "sfn2", async () => {
        "hello world";
        "hello world";
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
    "call $SFN wait",
    (parent) => {
      return new StepFunction(parent, "sfn2", async () => {
        $SFN.waitFor(1);
      });
    },
    null
  );

  test(
    "call $SFN map",
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
    "call $SFN map with constant array",
    (parent) => {
      return new StepFunction(parent, "sfn2", async () => {
        return $SFN.map([1, 2, 3], (n) => {
          return `n${n}`;
        });
      });
    },
    ["n1", "n2", "n3"]
  );

  test(
    "call $SFN forEach",
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
    "call $SFN parallel",
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
    "conditionals",
    (parent) => {
      const func = new Function<undefined, boolean>(
        parent,
        "func",
        async () => {
          return true;
        }
      );
      return new StepFunction(parent, "sfn2", async (input) => {
        if (input.a) {
          if (await func()) {
            return input.b;
          }
        }
        return "noop";
      });
    },
    "hello",
    { a: true, b: "hello" }
  );

  // Cannot return in a for loop
  // https://github.com/functionless/functionless/issues/319
  test.skip(
    "for map conditional",
    (parent) => {
      const func = new Function<undefined, number[]>(
        parent,
        "func",
        async () => {
          return [1, 2, 3];
        }
      );
      return new StepFunction(parent, "sfn2", async (input) => {
        let a = "x";
        const b = ["b"].map((v) => {
          for (const i of [1, 2, 3]) {
            if (i === 3) {
              return `${v}${a}${i}`;
            }
          }
          return "boo";
        });
        const c = ["c"].map((v) => {
          for (const i of input.arr) {
            if (i === 3) {
              return `${v}${a}${i}`;
            }
          }
          return "boo";
        });
        const d = Promise.all(
          ["d"].map(async (v) => {
            for (const i of await func()) {
              if (i === 3) {
                return `${v}${a}${i}`;
              }
            }
            return "boo";
          })
        );
        // must be an array
        // for (const i in input.ob) {
        //   a = i as any;
        // }
        return `${b}${c}${d}`;
      });
    },
    "bx3cx3dx3",
    { arr: [1, 2, 3] }
  );

  // uhh, so the best we can do is test that this doesn't fail
  // Return from for loop - https://github.com/functionless/functionless/issues/319
  // Assign to mutable variables from for loop - https://github.com/functionless/functionless/issues/318
  test(
    "for loops",
    (parent) => {
      const func = new Function<undefined, number[]>(
        parent,
        "func",
        async () => {
          return [1, 2, 3];
        }
      );
      return new StepFunction(parent, "sfn2", async (input) => {
        let a = "x";
        for (const i of [1, 2, 3]) {
          a = `${a}${i}`;
        }
        for (const i of input.arr) {
          a = `${a}${i}`;
        }
        for (const i of await func()) {
          a = `${a}${i}`;
        }
        // must be an array
        // for (const i in input.ob) {
        //   a = i as any;
        // }
        return `madeit`;
      });
    },
    "madeit",
    { arr: [1, 2, 3] }
  );

  // Support mutable variables in For and Map: https://github.com/functionless/functionless/issues/318
  test.skip(
    "map with dynamic for loops",
    (parent) => {
      const func = new Function<undefined, number[]>(
        parent,
        "func",
        async () => {
          return [1, 2, 3];
        }
      );
      return new StepFunction(parent, "sfn2", async (input) => {
        const l = (await func()).map((x) => `n${x}`);
        const l2 = input.arr.map((x) => `n${x}`);
        let a = "";
        for (const x of l) {
          a = `${a}${x}`;
        }
        for (const x of l2) {
          a = `${a}${x}`;
        }
        return a;
      });
    },
    "123123",
    { arr: [1, 2, 3] }
  );

  test(
    "map",
    (parent) => {
      const func = new Function<undefined, number[]>(
        parent,
        "func",
        async () => {
          return [1, 2, 3];
        }
      );
      return new StepFunction(parent, "sfn2", async (input) => {
        const l = (await func()).map((x) => `n${x}`);
        const l2 = input.arr.map((x) => `n${x}`);
        return `${l[0]}${l[1]}${l[2]}${l2[0]}${l2[1]}${l2[2]}`;
      });
    },
    "n1n2n3n1n2n3",
    { arr: [1, 2, 3] }
  );

  test(
    "map uses input",
    (parent) => {
      const func = new Function<undefined, number[]>(
        parent,
        "func",
        async () => {
          return [1, 2, 3];
        }
      );
      return new StepFunction(parent, "sfn2", async (input) => {
        const l = (await func()).map((x) => `${input.prefix}${x}`);
        const l2 = input.arr.map((x) => `${input.prefix}${x}`);
        return `${l[0]}${l[1]}${l[2]}${l2[0]}${l2[1]}${l2[2]}`;
      });
    },
    "n1n2n3n1n2n3",
    { arr: [1, 2, 3], prefix: "n" }
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

  test(
    "binaryOps comparison",
    (parent) => {
      return new StepFunction(parent, "sfn2", async (input) => {
        return {
          constantStringEquals: "a" === "a", // true
          constantToVarStringEquals: input.v === "val", // true
          varToConstantStringEquals: "val2" === input.v, // false
          varToVarStringEquals: input.v === input.v, // true
          constantStringNotEquals: "a" !== "a", // false
          constantToVarStringNotEquals: input.v !== "val", // false
          varToConstantStringNotEquals: "val2" !== input.v, // true
          varToVarStringNotEquals: input.v !== input.v, // false
          constantStringLess: "a" < "a", // false
          constantToVarStringLess: input.v < "val2", // true
          varToConstantStringLess: "val2" < input.v, // false
          varToVarStringLess: input.v < input.v, // false
          constantStringLessEquals: "a" <= "a", // true
          constantToVarStringLessEquals: input.v <= "val2", // true
          varToConstantStringLessEquals: "val2" <= input.v, // false
          varToVarStringLessEquals: input.v <= input.v, // true
          constantStringGreater: "a" > "a", // false
          constantToVarStringGreater: input.v > "val2", // false
          varToConstantStringGreater: "val2" > input.v, // true
          varToVarStringGreaterE: input.v > input.v, // false
          constantStringGreaterEquals: "a" >= "a", // true
          constantToVarStringGreaterEquals: input.v >= "val2", // false
          varToConstantStringGreaterEquals: "val2" >= input.v, // true
          varToVarStringGreaterEquals: input.v >= input.v, // true
          constantNumberEquals: 1 === 1, // true
          constantToVarNumberEquals: input.n === 2, // false
          varToConstantNumberEquals: 3 === input.n, // false
          varToVarNumberEquals: input.n === input.n, // true
          constantNumberNotEquals: 1 !== 1, // false
          constantToVarNumberNotEquals: input.n !== 2, // true
          varToConstantNumberNotEquals: 3 !== input.n, // true
          varToVarNumberNotEquals: input.n !== input.n, // false
          constantNumberLess: 1 < 1, // false
          constantToVarNumberLess: input.n < 3, // true
          varToConstantNumberLess: 3 < input.n, // false
          varToVarNumberLess: input.n < input.n, // false
          constantNumberLessEquals: 1 <= 1, // true
          constantToVarNumberLessEquals: input.n <= 3, // true
          varToConstantNumberLessEquals: 3 <= input.n, // false
          varToVarNumberLessEquals: input.n <= input.n, // true
          constantNumberGreater: 1 > 1, // false
          constantToVarNumberGreater: input.n > 3, // false
          varToConstantNumberGreater: 3 > input.n, // true
          varToVarNumberGreaterE: input.n > input.n, // false
          constantNumberGreaterEquals: 1 >= 1, // true
          constantToVarNumberGreaterEquals: input.n >= 3, // false
          varToConstantNumberGreaterEquals: 3 >= input.n, // true
          varToVarNumberGreaterEquals: input.n >= input.n, // true
          constantBooleanEquals: true === true, // true
          constantToVarBooleanEquals: input.a === true, // true
          varToConstantBooleanEquals: false === input.a, // false
          varToVarBooleanEquals: input.a === input.a, // true
          constantBooleanNotEquals: true !== true, // false
          constantToVarBooleanNotEquals: input.a !== true, // false
          varToConstantBooleanNotEquals: false !== input.a, // true
          varToVarBooleanNotEquals: input.a !== input.a, // false
          constantNullEquals: null === null, // true
          constantToVarNullEquals: input.nv === null, // true
          varToConstantNullEquals: input.v === input.nv, // false
          varToVarNullEquals: input.nv === input.nv, // true
          constantNullNotEquals: null !== null, // false
          constantToVarNullNotEquals: input.nv !== null, // false
          varToConstantNullNotEquals: input.v !== input.nv, // true
          varToVarNullNotEquals: input.nv !== input.nv, // false
          constantInConstant: "a" in { a: "val" }, // true
          constantInVar: "a" in input.obj, // true
          constantNotInVar: "b" in input.obj, // false
          // varInVar: input.v in input.obj, // false - unsupported
          // varInConstant: input.v in { a: "val" }, // false - unsupported
        };
      });
    },
    {
      constantStringEquals: true,
      constantToVarStringEquals: true,
      varToConstantStringEquals: false,
      varToVarStringEquals: true,
      constantStringNotEquals: false,
      constantToVarStringNotEquals: false,
      varToConstantStringNotEquals: true,
      varToVarStringNotEquals: false,
      constantStringLess: false,
      constantToVarStringLess: true,
      varToConstantStringLess: false,
      varToVarStringLess: false,
      constantStringLessEquals: true,
      constantToVarStringLessEquals: true,
      varToConstantStringLessEquals: false,
      varToVarStringLessEquals: true,
      constantStringGreater: false,
      constantToVarStringGreater: false,
      varToConstantStringGreater: true,
      varToVarStringGreaterE: false,
      constantStringGreaterEquals: true,
      constantToVarStringGreaterEquals: false,
      varToConstantStringGreaterEquals: true,
      varToVarStringGreaterEquals: true,
      constantNumberEquals: true,
      constantToVarNumberEquals: false,
      varToConstantNumberEquals: false,
      varToVarNumberEquals: true,
      constantNumberNotEquals: false,
      constantToVarNumberNotEquals: true,
      varToConstantNumberNotEquals: true,
      varToVarNumberNotEquals: false,
      constantNumberLess: false,
      constantToVarNumberLess: true,
      varToConstantNumberLess: false,
      varToVarNumberLess: false,
      constantNumberLessEquals: true,
      constantToVarNumberLessEquals: true,
      varToConstantNumberLessEquals: false,
      varToVarNumberLessEquals: true,
      constantNumberGreater: false,
      constantToVarNumberGreater: false,
      varToConstantNumberGreater: true,
      varToVarNumberGreaterE: false,
      constantNumberGreaterEquals: true,
      constantToVarNumberGreaterEquals: false,
      varToConstantNumberGreaterEquals: true,
      varToVarNumberGreaterEquals: true,
      constantBooleanEquals: true,
      constantToVarBooleanEquals: true,
      varToConstantBooleanEquals: false,
      varToVarBooleanEquals: true,
      constantBooleanNotEquals: false,
      constantToVarBooleanNotEquals: false,
      varToConstantBooleanNotEquals: true,
      varToVarBooleanNotEquals: false,
      constantNullEquals: true,
      constantToVarNullEquals: true,
      varToConstantNullEquals: false,
      varToVarNullEquals: true,
      constantNullNotEquals: false,
      constantToVarNullNotEquals: false,
      varToConstantNullNotEquals: true,
      varToVarNullNotEquals: false,
      constantInConstant: true,
      constantInVar: true,
      // varInVar: false,
      // varInConstant: false,
      constantNotInVar: false,
    },
    { a: true, n: 1, v: "val", nv: null, obj: { a: "x" } }
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

  test(
    "typeof",
    (parent) => {
      return new StepFunction(parent, "fn", async (input) => {
        return {
          isString: typeof input.str === "string",
          stringType: typeof input.str,
          isBool: typeof input.bool === "boolean",
          booleanType: typeof input.bool,
          isNumber: typeof input.num === "number",
          numberType: typeof input.num,
          isObject: typeof input.obj === "object",
          objectType: typeof input.obj,
          arrType: typeof input.arr,
          //bigintType: typeof BigInt(0),
        };
      });
    },
    {
      isString: true,
      stringType: "string",
      isBool: true,
      booleanType: "boolean",
      isNumber: true,
      numberType: "number",
      isObject: true,
      objectType: "object",
      arrType: "object",
      // bigintType: "number",
    },
    { str: "hi", bool: true, num: 1, obj: {}, arr: [] }
  );
});
