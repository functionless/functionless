import { Duration, aws_dynamodb } from "aws-cdk-lib";
import { AttributeType } from "aws-cdk-lib/aws-dynamodb";
// eslint-disable-next-line import/no-extraneous-dependencies
import { StepFunctions } from "aws-sdk";
import { Construct } from "constructs";
import {
  StepFunction,
  Function,
  $AWS,
  $SFN,
  Table,
  FunctionProps,
  Queue,
} from "../src";
import { makeIntegration } from "../src/integration";
import { localstackTestSuite } from "./localstack";
import { localSQS, testStepFunction } from "./runtime-util";
import { normalizeCDKJson } from "./util";

// inject the localstack client config into the lambda clients
// without this configuration, the functions will try to hit AWS proper
const localstackClientConfig: FunctionProps = {
  timeout: Duration.seconds(20),
  clientConfigRetriever: () => ({
    endpoint: `http://${process.env.LOCALSTACK_HOSTNAME}:4566`,
  }),
};

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
      :
          | OO
          | ((
              context: Outputs,
              result: StepFunctions.DescribeExecutionOutput
            ) => OO extends void ? null : O),
    payload?: I | ((context: Outputs) => I),
    executionName?: string
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
        const pay =
          typeof payload === "function"
            ? (<globalThis.Function>payload)(context)
            : payload;

        expect(
          normalizeCDKJson(JSON.parse(extra?.definition!))
        ).toMatchSnapshot();
        const result = await testStepFunction(context.function, pay);

        const exp =
          typeof expected === "function"
            ? (<globalThis.Function>expected)(context, result)
            : expected;

        if (result.status === "FAILED") {
          throw new Error(`Machine failed with output: ${result.output}`);
        }

        expect(result.output ? JSON.parse(result.output) : undefined).toEqual(
          exp
        );
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
    "step function props are passed through to the resource",
    (parent) => {
      return new StepFunction(
        parent,
        "sfn2",
        { stateMachineName: "magicMachine" },
        async (_, context) => {
          return context.StateMachine.Name;
        }
      );
    },
    "magicMachine"
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
    "$AWS.SDK.DynamoDB.describeTable",
    (parent) => {
      const table = new Table<{ id: string }, "id">(parent, "myTable", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });

      return {
        sfn: new StepFunction<{}, string | undefined>(
          parent,
          "fn",
          async () => {
            const tableInfo = await $AWS.SDK.DynamoDB.describeTable(
              {
                TableName: table.tableName,
              },
              {
                iam: {
                  resources: [table.tableArn],
                },
              }
            );

            return tableInfo.Table?.TableArn;
          }
        ),
        outputs: { tableArn: table.tableArn },
      };
    },
    ({ tableArn }) => tableArn
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

  test(
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
        const d = await Promise.all(
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
        return `${b.join("")}${c.join("")}${d.join("")}`;
      });
    },
    "bx3cx3dx3",
    { arr: [1, 2, 3] }
  );

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

  test(
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
    "n1n2n3n1n2n3",
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
        let a = "";
        const l = (await func()).map((x) => `n${x}`);
        const l2 = input.arr.map((x, i, [head]) => `n${i}${x}${head}`);
        input.arr.map((x) => {
          a = `${a}a${x}`;
          return a;
        });
        return `${l[0]}${l[1]}${l[2]}${l2[0]}${l2[1]}${l2[2]}${a}`;
      });
    },
    "n1n2n3n011n121n231a1a2a3",
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
    "foreach",
    (parent) => {
      return new StepFunction(parent, "sfn2", async (input) => {
        let a = "";
        input.arr.forEach((x) => {
          a = `${a}a${x}`;
          return a;
        });
        return a;
      });
    },
    "a1a2a3",
    { arr: [1, 2, 3] }
  );

  test(
    "filter",
    (parent) => {
      return new StepFunction(parent, "sfn2", async ({ arr, key }) => {
        const arr1 = arr
          .filter(({ value }) => value <= 3)
          .filter(({ value }) => value <= key)
          .filter((item) => {
            const { key: itemKey } = item;
            $SFN.waitFor(1);
            return itemKey === `hi${key}`;
          });

        const arr2 = [4, 3, 2, 1].filter(
          (x, index, [first]) => x <= index || first === x
        );

        return { arr1, arr2 };
      });
    },
    {
      arr1: [
        { value: 1, key: "hi2" },
        { value: 2, key: "hi2" },
      ],
      arr2: [4, 2, 1],
    },
    {
      arr: [
        { value: 1, key: "hi" },
        { value: 1, key: "hi2" },
        { value: 2, key: "hi" },
        { value: 2, key: "hi2" },
        { value: 3, key: "hi" },
        { value: 3, key: "hi2" },
        { value: 4 },
        { value: 1, key: "hi" },
      ],
      key: 2,
    }
  );

  test(
    "binaryOps logic",
    (parent) => {
      return new StepFunction(parent, "sfn2", async (input) => {
        const c = input.a && input.b;
        let x = "";
        let notNullishCoalAssign = "a";
        let nullishCoalAssign = null;
        let truthyAndAssign = "a";
        let falsyAndAssign = "";
        let truthyOrAssign = "a";
        let falsyOrAssign = "";

        notNullishCoalAssign ??= "b"; // "a"
        nullishCoalAssign ??= "b"; // "b"
        truthyAndAssign &&= "b"; // "b"
        falsyAndAssign &&= "b"; // ""
        truthyOrAssign ||= "b"; // "a"
        falsyOrAssign ||= "b"; // "b"

        let y = "";

        if ((y = `${y}1`) && ((y = `${y}2`), false) && (y = `${y}3`)) {
          y = `${y}4`;
        }

        if (((y = `${y}5`), false) || ((y = `${y}6`), true) || (y = `${y}7`)) {
          y = `${y}8`;
        }

        return {
          andVar: c,
          and: input.a && input.b,
          or: input.a || input.b,
          invNullCoal: input.nv ?? ((x = `${x}1`), input.v),
          nullCoal: input.v ?? ((x = `${x}2`), input.nv),
          nullNull: input.nv ?? null,
          nullVal: null ?? input.v,
          falsyChainOr:
            input.b ||
            input.z ||
            ((x = `${x}3`), true) ||
            ((x = `${x}4`), false) ||
            input.v, // sets x+=1 returns true
          truthyChainOr: input.b || ((x = `${x}5`), false) || input.arr, // sets x+=3 returns v
          falsyChainAnd: input.z && ((x = `${x}6`), true), // returns zero
          truthyChainAnd:
            input.a && input.v && ((x = `${x}7`), true) && input.v, // sets x+=5, returns v
          x,
          y,
          notNullishCoalAssign,
          nullishCoalAssign,
          truthyAndAssign,
          falsyAndAssign,
          truthyOrAssign,
          falsyOrAssign,
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
      falsyChainOr: true,
      truthyChainOr: ["1", "2"],
      falsyChainAnd: 0,
      truthyChainAnd: "val",
      x: "1357",
      notNullishCoalAssign: "a",
      nullishCoalAssign: "b",
      truthyAndAssign: "b",
      falsyAndAssign: "",
      truthyOrAssign: "a",
      falsyOrAssign: "b",
      y: "12568",
    },
    { a: true, b: false, v: "val", nv: undefined, z: 0, arr: ["1", "2"] }
  );

  test(
    "binary and unary comparison",
    (parent) => {
      return new StepFunction(parent, "sfn2", async (input) => {
        const obj = { nv: null } as { und?: string; nv: null; v: string };
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
          constantNot: !false,
          varNot: !input.a,
          varNotPresentTrue: !input.nv,
          varNotNullFalse: !input.n,
          // @ts-ignore
          varNotPresentFalse: !input.x,
          // varInVar: input.v in input.obj, // false - unsupported
          // varInConstant: input.v in { a: "val" }, // false - unsupported
          // undefined and null literals
          varEqualEqualsUndefined: input.v === undefined, // false
          varEqualsUndefined: input.v == undefined, // false
          varNotEqualEqualsUndefined: input.v !== undefined, // true
          varNotEqualsUndefined: input.v != undefined, // true
          nullEqualEqualsUndefined: input.nv === undefined, // false
          nullEqualsUndefined: input.nv == undefined, // false - incorrect - https://github.com/functionless/functionless/issues/445
          nullNotEqualEqualsUndefined: input.nv === undefined, // false
          nullNotEqualsUndefined: input.nv == undefined, // false - incorrect -https://github.com/functionless/functionless/issues/445
          undefinedVarEqualEqualsUndefined: input.und === undefined, // true
          undefinedVarEqualsUndefined: input.und == undefined, // true
          undefinedVarNotEqualEqualsUndefined: input.und !== undefined, // false
          undefinedVarNotEqualsUndefined: input.und != undefined, // false
          varEqualEqualsUndefinedVar: input.v === undefined, // false
          varEqualsUndefinedVar: input.v == undefined, // false
          // null
          undefinedVarEqualEqualsNull: input.und === null, // false
          undefinedVarEqualsNull: input.und == null, // false - incorrect -https://github.com/functionless/functionless/issues/445
          undefinedVarNotEqualEqualsNull: input.und !== null, // true
          undefinedVarNotEqualsNull: input.und != null, // true - incorrect -https://github.com/functionless/functionless/issues/445
          // string
          undefinedVarEqualEqualsString: input.und === "hello", // false
          undefinedVarEqualsString: input.und == "hello", // false
          undefinedVarNotEqualEqualsString: input.und !== "hello", // true
          undefinedVarNotEqualsString: input.und != "hello", // true
          nullVarEqualEqualsString: input.nv === "hello", // false
          nullVarEqualsString: input.nv == "hello", // false
          nullVarNotEqualEqualsString: input.nv !== "hello", // true
          nullVarNotEqualsString: input.nv != "hello", // true
          // number
          undefinedVarEqualEqualsNumber: input.undN === 1, // false
          undefinedVarEqualsNumber: input.undN == 1, // false
          undefinedVarNotEqualEqualsNumber: input.undN !== 1, // true
          undefinedVarNotEqualsNumber: input.undN != 1, // true
          nullVarEqualEqualsNumber: input.nv === 1, // false
          nullVarEqualsNumber: input.nv == 1, // false
          nullVarNotEqualEqualsNumber: input.nv !== 1, // true
          nullVarNotEqualsNumber: input.nv != 1, // true
          // undefined variables
          varNotEqualEqualsUndefinedVar: input.v !== obj.und, // true
          varNotEqualsUndefinedVar: input.v != obj.und, // true
          nullEqualEqualsUndefinedVar: input.nv === obj.und, // false
          nullEqualsUndefinedVar: input.nv == obj.und, // false - incorrect - https://github.com/functionless/functionless/issues/445
          nullNotEqualEqualsUndefinedVar: input.nv === obj.und, // false
          nullNotEqualsUndefinedVar: input.nv == obj.und, // false - incorrect -https://github.com/functionless/functionless/issues/445
          undefinedVarEqualEqualsUndefinedVar: input.und === obj.und, // true
          undefinedVarEqualsUndefinedVar: input.und == obj.und, // true
          undefinedVarNotEqualEqualsUndefinedVar: input.und !== obj.und, // false
          undefinedVarNotEqualsUndefinedVar: input.und != obj.und, // false
          // null variable
          undefinedVarEqualEqualsNullVar: input.und === obj.nv, // false
          undefinedVarEqualsNullVar: input.und == obj.nv, // false - incorrect -https://github.com/functionless/functionless/issues/445
          undefinedVarNotEqualEqualsNullVar: input.und !== obj.nv, // true
          undefinedVarNotEqualsNullVar: input.und != obj.nv, // true - incorrect -https://github.com/functionless/functionless/issues/445
          // string var
          undefinedVarEqualEqualsStringVar: input.und === input.v, // false
          undefinedVarEqualsStringVar: input.und == input.v, // false
          undefinedVarNotEqualEqualsStringVar: input.und !== input.v, // true
          undefinedVarNotEqualsStringVar: input.und != input.v, // true
          nullVarEqualEqualsStringVar: input.nv === input.v, // false
          nullVarEqualsStringVar: input.nv == input.v, // false
          nullVarNotEqualEqualsStringVar: input.nv !== input.v, // true
          nullVarNotEqualsStringVar: input.nv != input.v, // true
          // number var
          undefinedVarEqualEqualsNumberVar: input.undN === input.n, // false
          undefinedVarEqualsNumberVar: input.undN == input.n, // false
          undefinedVarNotEqualEqualsNumberVar: input.undN !== input.n, // true
          undefinedVarNotEqualsNumberVar: input.undN != input.n, // true
          nullVarEqualEqualsNumberVar: input.nv === input.n, // false
          nullVarEqualsNumberVar: input.nv == input.n, // false
          nullVarNotEqualEqualsNumberVar: input.nv !== input.n, // true
          nullVarNotEqualsNumberVar: input.nv != input.n, // true
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
      constantNot: true,
      varNot: false,
      varNotPresentTrue: true,
      varNotNullFalse: false,
      // @ts-ignore
      varNotPresentFalse: true,
      // undefined and null literals
      varEqualEqualsUndefined: false,
      varEqualsUndefined: false,
      varNotEqualEqualsUndefined: true,
      varNotEqualsUndefined: true,
      nullEqualEqualsUndefined: false,
      nullEqualsUndefined: false,
      nullNotEqualEqualsUndefined: false,
      nullNotEqualsUndefined: false,
      undefinedVarEqualEqualsUndefined: true,
      undefinedVarEqualsUndefined: true,
      undefinedVarNotEqualEqualsUndefined: false,
      undefinedVarNotEqualsUndefined: false,
      varEqualEqualsUndefinedVar: false,
      varEqualsUndefinedVar: false,
      // null
      undefinedVarEqualEqualsNull: false,
      undefinedVarEqualsNull: false,
      undefinedVarNotEqualEqualsNull: true,
      undefinedVarNotEqualsNull: true,
      // string
      undefinedVarEqualEqualsString: false,
      undefinedVarEqualsString: false,
      undefinedVarNotEqualEqualsString: true,
      undefinedVarNotEqualsString: true,
      nullVarEqualEqualsString: false,
      nullVarEqualsString: false,
      nullVarNotEqualEqualsString: true,
      nullVarNotEqualsString: true,
      // number
      undefinedVarEqualEqualsNumber: false,
      undefinedVarEqualsNumber: false,
      undefinedVarNotEqualEqualsNumber: true,
      undefinedVarNotEqualsNumber: true,
      nullVarEqualEqualsNumber: false,
      nullVarEqualsNumber: false,
      nullVarNotEqualEqualsNumber: true,
      nullVarNotEqualsNumber: true,
      // undefined variables
      varNotEqualEqualsUndefinedVar: true,
      varNotEqualsUndefinedVar: true,
      nullEqualEqualsUndefinedVar: false,
      nullEqualsUndefinedVar: false,
      nullNotEqualEqualsUndefinedVar: false,
      nullNotEqualsUndefinedVar: false,
      undefinedVarEqualEqualsUndefinedVar: true,
      undefinedVarEqualsUndefinedVar: true,
      undefinedVarNotEqualEqualsUndefinedVar: false,
      undefinedVarNotEqualsUndefinedVar: false,
      // null variable
      undefinedVarEqualEqualsNullVar: false,
      undefinedVarEqualsNullVar: false,
      undefinedVarNotEqualEqualsNullVar: true,
      undefinedVarNotEqualsNullVar: true,
      // string var
      undefinedVarEqualEqualsStringVar: false,
      undefinedVarEqualsStringVar: false,
      undefinedVarNotEqualEqualsStringVar: true,
      undefinedVarNotEqualsStringVar: true,
      nullVarEqualEqualsStringVar: false,
      nullVarEqualsStringVar: false,
      nullVarNotEqualEqualsStringVar: true,
      nullVarNotEqualsStringVar: true,
      // number var
      undefinedVarEqualEqualsNumberVar: false,
      undefinedVarEqualsNumberVar: false,
      undefinedVarNotEqualEqualsNumberVar: true,
      undefinedVarNotEqualsNumberVar: true,
      nullVarEqualEqualsNumberVar: false,
      nullVarEqualsNumberVar: false,
      nullVarNotEqualEqualsNumberVar: true,
      nullVarNotEqualsNumberVar: true,
    },
    { a: true, n: 1, v: "val", nv: null, obj: { a: "x" } } as {
      a: boolean;
      n: number;
      v: string;
      nv: null;
      obj: { a: string };
      und?: string;
      undN?: number;
    }
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
        const f = a;
        a = { 1: "val2" };
        let z = "";
        const g = {
          a: z,
          b: (z = "a"),
          c: ((z = "b"), z),
          z,
          t: z === "b",
          o: { z },
        };
        let y = "";
        const h = [y, (y = "a"), ((y = "b"), y), y];
        let x = "0";
        const i = `hello ${x} ${(x = "1")} ${((x = "3"), "2")} ${x}`;
        return { a, b, c, d, e, f, g, h, i };
      });
    },
    {
      a: { "1": "val2" },
      b: "2",
      c: null,
      d: 1,
      e: [1, 2],
      f: { x: "val" },
      g: { a: "", b: "a", c: "b", z: "b", t: true, o: { z: "b" } },
      h: ["", "a", "b", "b"],
      i: "hello 0 1 2 3",
    }
  );

  test(
    "access",
    (parent) => {
      return new StepFunction(parent, "sfn2", async () => {
        const obj = { 1: "a", x: "b" };
        const arr = [1];
        return {
          a: obj.x,
          b: obj.x,
          // c: obj[1], -- invalid SFN - localstack hangs on error
          d: obj["1"],
          e: arr[0],
          // f: arr["0"], -- invalid SFN - localstack hangs on error
        };
      });
    },
    {
      a: "b",
      b: "b",
      // c: "a",
      d: "a",
      e: 1,
      //  f: 1
    }
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

        return `the result: ${result.str} ${input.obj.str === "hullo"}`;
      });
    },
    "the result: hullo hello hello default 1 true",
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

  test(
    "for in",
    (parent) => {
      const table = new Table<{ id: string; val: number }, "id">(
        parent,
        "table",
        {
          partitionKey: {
            name: "id",
            type: AttributeType.STRING,
          },
        }
      );
      const update = $AWS.DynamoDB.UpdateItem;
      const func = new Function(
        parent,
        "func",
        localstackClientConfig,
        async (input: { n: `${number}`; id: string }) => {
          console.log("input", input);
          await update({
            Table: table,
            Key: {
              id: {
                S: input.id,
              },
            },
            UpdateExpression: "SET val = if_not_exists(val, :start) + :inc",
            ExpressionAttributeValues: {
              ":start": { N: "0" },
              ":inc": { N: input.n },
            },
          });
        }
      );
      return new StepFunction<{ arr: number[]; id: string }, string>(
        parent,
        "fn",
        async (input) => {
          // 1, 2, 3 = 6
          for (const i in input.arr) {
            await func({ n: `${input.arr[i]!}`, id: input.id });
          }
          for (const i in input.arr) {
            let j = "1";
            for (j in input.arr) {
              await func({ n: `${input.arr[i]!}`, id: input.id }); // 1 1 1 2 2 2 3 3 3 = 18
              await func({ n: i as `${number}`, id: input.id }); // 0 0 0 1 1 1 2 2 2 = 9
              await func({ n: `${input.arr[j]!}`, id: input.id }); // 1 2 3 1 2 3 1 2 3 = 18
              await func({ n: j as `${number}`, id: input.id }); // 0 1 2 0 1 2 0 1 2 = 9
            }
            await func({ n: j as "2", id: input.id }); // 2 2 2 = 6
          }
          const item = await $AWS.DynamoDB.GetItem({
            Table: table,
            Key: {
              id: { S: input.id },
            },
            ConsistentRead: true,
          });
          return item.Item!.val.N;
        }
      );
    },
    // 6 + 54 + 6
    "66",
    { arr: [1, 2, 3], id: `key${Math.floor(Math.random() * 1000)}` }
  );

  test(
    "for of",
    (parent) => {
      const table = new Table<{ id: string; val: number }, "id">(
        parent,
        "table",
        {
          partitionKey: {
            name: "id",
            type: AttributeType.STRING,
          },
        }
      );
      const update = $AWS.DynamoDB.UpdateItem;
      const func = new Function(
        parent,
        "func",
        localstackClientConfig,
        async (input: { n: `${number}`; id: string }) => {
          console.log("input", input);
          await update({
            Table: table,
            Key: {
              id: {
                S: input.id,
              },
            },
            UpdateExpression: "SET val = if_not_exists(val, :start) + :inc",
            ExpressionAttributeValues: {
              ":start": { N: "0" },
              ":inc": { N: input.n },
            },
          });
        }
      );
      return new StepFunction<{ arr: number[]; id: string }, string>(
        parent,
        "fn",
        async (input) => {
          // 1, 2, 3 = 6
          for (const i of input.arr) {
            await func({ n: `${i}`, id: input.id });
          }
          // 2 + 3 + 4 + 3 + 4 + 5 + 4 + 5 + 6 = 36 + 6 = 42
          for (const i of input.arr) {
            let j = 1;
            for (j of input.arr) {
              await func({ n: `${i}`, id: input.id });
              await func({ n: `${j}`, id: input.id });
            }
            // 3 + 3 + 3 = 9 = 51
            await func({ n: `${j}`, id: input.id });
          }
          const item = await $AWS.DynamoDB.GetItem({
            Table: table,
            Key: {
              id: { S: input.id },
            },
            ConsistentRead: true,
          });
          return item.Item!.val.N;
        }
      );
    },
    "51",
    { arr: [1, 2, 3], id: `key${Math.floor(Math.random() * 1000)}` }
  );

  test(
    "for",
    (parent) => {
      return new StepFunction(parent, "sfn", (input) => {
        let a = "";
        for (let arr = input.arr; arr[0]; arr = arr.slice(1)) {
          a = `${a}n${arr[0]}`;
        }
        let c = "";
        for (;;) {
          if (c === "1") {
            c = `${c}1`;
            continue;
          }
          if (c === "111") {
            break;
          }
          a = `${a}c${c}`;
          c = `${c}1`;
        }
        return a;
      });
    },
    "n1n2n3cc11",
    { arr: [1, 2, 3] }
  );

  test(
    "continue break",
    (parent) => {
      const table = new Table<{ id: string; val: number }, "id">(
        parent,
        "table",
        {
          partitionKey: {
            name: "id",
            type: AttributeType.STRING,
          },
        }
      );
      return new StepFunction<{ id: string }, string>(
        parent,
        "sfn",
        async (input) => {
          let a = "";
          while (true) {
            a = `${a}1`;
            if (a !== "111") {
              if (a === "11121") {
                break;
              }
              continue;
            }
            a = `${a}2`;
          }

          for (const i of [1, 2, 3, 4]) {
            if (i === 1) {
              continue;
            }
            await $AWS.DynamoDB.UpdateItem({
              Table: table,
              Key: {
                id: {
                  S: input.id,
                },
              },
              UpdateExpression: "SET val = if_not_exists(val, :start) + :inc",
              ExpressionAttributeValues: {
                ":start": { N: "0" },
                ":inc": { N: `${i}` },
              },
            });
            if (i === 3) {
              break;
            }
          }
          const item = await $AWS.DynamoDB.GetItem({
            Table: table,
            Key: {
              id: { S: input.id },
            },
            ConsistentRead: true,
          });
          return `${a}${item.Item?.val.N}`;
        }
      );
    },
    "111215",
    { id: `key${Math.floor(Math.random() * 1000)}` }
  );

  test(
    "throw catch finally",
    (parent) => {
      const func = new Function<undefined, void>(parent, "func", async () => {
        throw new Error("wat");
      });

      return new StepFunction(parent, "sfn", async () => {
        let a = "";
        try {
          throw new Error("Error1");
        } catch {
          a = `${a}error1`;
        }
        try {
          throw new Error("Error2");
        } catch (err) {
          a = `${a}${(<Error>err).message}`;
        }
        try {
          throw Error();
        } catch {
          a = `${a}error3`;
        } finally {
          a = `${a}finally1`;
        }
        try {
          a = `${a}set`;
        } finally {
          a = `${a}finally2`;
        }
        try {
          await func();
        } catch {
          a = `${a}error4`;
        }
        try {
          await func();
        } catch (err) {
          a = `${a}${(<any>err).errorMessage}`;
        }
        try {
          for (const _ in [1]) {
            await func();
          }
        } catch (err) {
          a = `${a}for${(<any>err).errorMessage}`;
        }
        try {
          try {
            throw new Error("error5");
          } catch {
            throw new Error("error6");
          } finally {
            a = `${a}finally`;
          }
        } catch (err) {
          a = `${a}recatch${(<Error>err).message}`;
        }
        try {
          while (true) {
            await func();
          }
        } catch (err) {
          a = `${a}while${(<any>err).errorMessage}`;
        }
        try {
          do {
            await func();
          } while (true);
        } catch (err) {
          a = `${a}do${(<any>err).errorMessage}`;
        }
        try {
          await $SFN.map([1], async () => func());
        } catch (err) {
          a = `${a}sfnmap${(<any>err).errorMessage}`;
        }
        try {
          await Promise.all([1].map(async () => func()));
        } catch (err) {
          a = `${a}arrmap${(<any>err).errorMessage}`;
        }
        return a;
      });
    },
    "error1Error2error3finally1setfinally2error4watforwatfinallyrecatcherror6whilewatdowatsfnmapwatarrmapwat"
  );

  test(
    "for control and assignment",
    (parent) => {
      return new StepFunction<{ arr: number[] }, string>(
        parent,
        "fn",
        async (input) => {
          let a = "";
          for (const i in input.arr) {
            if (i === "2") {
              break;
            }
            a = `${a}n${i}`;
          }
          for (const i in input.arr) {
            if (i !== "2") {
              continue;
            }
            a = `${a}n${i}`;
          }
          for (const i of input.arr) {
            if (i === 2) {
              return a;
            }
          }
          return "woops";
        }
      );
    },
    "n0n1n2",
    { arr: [1, 2, 3] }
  );

  test(
    "join",
    (parent) => {
      return new StepFunction(parent, "sfn2", async (input) => {
        const resultArr = [
          ["a", "b", "c"].join("/"),
          input.arr.join("-"),
          input.arr.join(input.sep),
          ["d", "e", "f"].join(input.sep),
          [].join(""),
          input.arr.join(),
          ["a", { a: "a" }, ["b"], input.obj, input.arr, null].join("="),
        ];

        return resultArr.join("#");
      });
    },
    // Caveat: Unlike ECMA, we run JSON.stringify on object and arrays
    'a/b/c#1-2-3#1|2|3#d|e|f##1,2,3#a={"a":"a"}=["b"]={"b":"b"}=[1,2,3]=null',
    { arr: [1, 2, 3], sep: "|", obj: { b: "b" } }
  );

  test(
    "ternary",
    (parent) => {
      const table = new Table<{ id: string; val: number }, "id">(
        parent,
        "table",
        {
          partitionKey: {
            name: "id",
            type: AttributeType.STRING,
          },
        }
      );
      return new StepFunction(parent, "fn", async (input) => {
        // should add 1
        input.t
          ? await $AWS.DynamoDB.UpdateItem({
              Table: table,
              Key: {
                id: { S: input.id },
              },
              UpdateExpression: "SET val = if_not_exists(val, :start) + :inc",
              ExpressionAttributeValues: {
                ":start": { N: "0" },
                ":inc": { N: "1" },
              },
            })
          : null;

        // should add 3
        input.f
          ? await $AWS.DynamoDB.UpdateItem({
              Table: table,
              Key: {
                id: { S: input.id },
              },
              UpdateExpression: "SET val = if_not_exists(val, :start) + :inc",
              ExpressionAttributeValues: {
                ":start": { N: "0" },
                ":inc": { N: "2" },
              },
            })
          : await $AWS.DynamoDB.UpdateItem({
              Table: table,
              Key: {
                id: { S: input.id },
              },
              UpdateExpression: "SET val = if_not_exists(val, :start) + :inc",
              ExpressionAttributeValues: {
                ":start": { N: "0" },
                ":inc": { N: "3" },
              },
            });

        // should not execute update
        input.t
          ? null
          : await $AWS.DynamoDB.UpdateItem({
              Table: table,
              Key: {
                id: { S: input.id },
              },
              UpdateExpression: "SET val = if_not_exists(val, :start) + :inc",
              ExpressionAttributeValues: {
                ":start": { N: "0" },
                ":inc": { N: "4" },
              },
            });

        return {
          true: input.t ? "a" : "b",
          false: input.f ? "a" : "b",
          constantTrue: true ? "c" : "d",
          constantFalse: false ? "c" : "d",
          result:
            (
              await $AWS.DynamoDB.GetItem({
                Table: table,
                Key: {
                  id: { S: input.id },
                },
              })
            ).Item?.val.N ?? null,
        };
      });
    },
    {
      true: "a",
      false: "b",
      constantTrue: "c",
      constantFalse: "d",
      result: "4",
    },
    { t: true, f: false, id: `key${Math.floor(Math.random() * 1000)}` }
  );

  test(
    "json parse and stringify",
    (parent) => {
      return new StepFunction(parent, "sfn", async (input) => {
        const str = JSON.stringify(input);
        const obj = JSON.parse(str);
        return {
          str: str,
          obj: obj,
          a: obj.a,
        };
      });
    },
    {
      str: `{"a":"1","b":1,"c":{"d":"d"}}`,
      obj: { a: "1", b: 1, c: { d: "d" } },
      a: "1",
    },
    { a: "1", b: 1, c: { d: "d" } }
  );

  test(
    "context",
    (parent) => {
      return new StepFunction(parent, "sfn", async (_, context) => {
        return `name: ${context.Execution.Name}`;
      });
    },
    (_, result) => `name: ${result.name}`
  );

  /**
   * Tests that the input to the machine has been removed from the machine state before continuing.
   *
   * Why:
   * 1. if the machine leaves the input payload at the top level, a declared, but uninitialized variable that shadows would adopt the input value.
   * 2. The size of the state in a machine is limited, if the input is not used, discard it, if the input is used, it will only exist at the input parameter name.
   *
   * ```ts
   * async (input: { a: string }) => {
   *    let a;
   *    return { a: a ?? null, b: input.a };
   * }
   * ```
   *
   * ^ If the state is polluted with the input, `a` will be whatever `input.a` is, but we expect it to be undefined.
   */
  test(
    "clean state after input",
    (parent) =>
      new StepFunction(parent, "sfn", async (input) => {
        const state = dumpState<
          Partial<typeof input> & { input: typeof input }
        >();
        let a;
        return {
          stateA: state.a ?? null,
          a: input.a,
          stateInput: state.input?.a ?? null,
          initA: a ?? null,
        };
      }),
    { stateA: null, stateInput: "a", a: "a", initA: null },
    { a: "a" }
  );

  /**
   * We should see no state pollution even when the input is never used, but provided.
   */
  test(
    "no state pollution",
    (parent) =>
      new StepFunction(parent, "sfn", async () => {
        let a;
        return a ?? null;
      }),
    null,
    { a: "a" }
  );

  test(
    "destructure",
    (parent) =>
      new StepFunction(
        parent,
        "sfn",
        async ({
          a,
          bb: { value: b, [`${"a"}${"b"}`]: r },
          c = "what",
          m = c,
          arr: [d, , e, ...arrRest],
          arr2: [f = "sir"],
          value,
        }) => {
          const {
            z,
            yy: { ["value"]: w, [`${"a"}${"b"}`]: v },
            x = "what",
            rra: [s, , u, ...tserRra],
            rra2: [t = "sir"],
          } = value;

          const map = [{ aa: "a", bb: ["b"] }]
            .map(({ aa, bb: [cc] }) => `${aa}${cc}`)
            .join();

          let forV = "";
          for (const {
            h,
            j: [l],
          } of [{ h: "a", j: ["b"] }]) {
            forV = `${forV}${h}${l}`;
          }

          let tr;
          try {
            throw new Error("hi");
          } catch ({ message }) {
            tr = message;
          }

          return {
            prop: `${a}${b}${c}${d}${e}${f}${arrRest[0]}${r}${m}`,
            var: `${z}${w}${v}${x}${s}${u}${t}${tserRra[0]}`,
            map,
            forV,
            tr,
          };
        }
      ),
    {
      prop: "helloworldwhatisupsirendofarraydynamicwhat",
      var: "helloworlddynamicwhatisupsirendofarray",
      map: "ab",
      forV: "ab",
      tr: "hi",
    },
    {
      a: "hello",
      bb: { value: "world", ab: "dynamic" } as {
        value: string;
        [key: string]: string;
      },
      c: undefined,
      m: undefined,
      d: "endofobj",
      arr: ["is", "skipme", "up", "endofarray"],
      arr2: [],
      value: {
        z: "hello",
        yy: { value: "world", ab: "dynamic" } as {
          value: string;
          [key: string]: string;
        },
        x: undefined,
        rra: ["is", "skipme", "up", "endofarray"],
        rra2: [],
        k: "endofobj",
      },
    }
  );

  test(
    "shadowing maintains state",
    (parent) =>
      new StepFunction(parent, "sfn", async () => {
        const [a, b, c, d, e, f] = [1, 1, 1, 1, 1, 1];
        let res = "";
        for (const a in [2]) {
          for (const b of [3]) {
            await Promise.all(
              [4].map(async (c) => {
                if (c === 4) {
                  const d = 5;
                  for (let e = 6; e === 6; e = 7) {
                    const r = (
                      await $SFN.map([7], (f) => {
                        return `${a}${b}${c}${d}${e}${f}`;
                      })
                    )[0]!;
                    res = `${r}-${a}${b}${c}${d}${e}${f}`;
                  }
                  res = `${res}-${a}${b}${c}${d}${e}${f}`;
                }
                res = `${res}-${a}${b}${c}${d}${e}${f}`;
              })
            );
            res = `${res}-${a}${b}${c}${d}${e}${f}`;
          }
          res = `${res}-${a}${b}${c}${d}${e}${f}`;
        }
        const z = [0].map((z) => z)[0];
        return `${res}-${a}${b}${c}${d}${e}${f}-${z}`;
      }),
    "034567-034561-034511-034111-031111-011111-111111-0"
  );

  test(
    "Boolean coerce",
    (parent) =>
      new StepFunction(parent, "sfn", (input) => {
        return {
          trueString: Boolean("1"),
          trueBoolean: Boolean(true),
          trueNumber: Boolean(1),
          trueObject: Boolean({}),
          truthyVar: Boolean(input.value),
          falseString: Boolean(""),
          falseBoolean: Boolean(false),
          falseNumber: Boolean(0),
          falsyVar: Boolean(input.nv),
          empty: Boolean(),
        };
      }),
    {
      trueString: true,
      trueBoolean: true,
      trueNumber: true,
      trueObject: true,
      falseString: false,
      falseBoolean: false,
      falseNumber: false,
      empty: false,
      truthyVar: true,
      falsyVar: false,
    },
    { value: "hello", nv: "" }
  );

  test(
    "Number coerce",
    (parent) =>
      new StepFunction(parent, "sfn", (input) => {
        return {
          oneString: Number("1"),
          oneBoolean: Number(true),
          oneNumber: Number(1),
          oneVar: Number(input.one),
          zeroString: Number(""),
          zeroBoolean: Number(false),
          zeroNumber: Number(0),
          zeroVar: Number(input.zero),
          zeroNull: Number(null),
          nanObject: Number({}),
          nanString: Number("{}"),
          nanTrueString: Number("true"),
          nanVar: Number(input.nan),
          oneStringUnaryPlus: +"1",
          oneBooleanUnaryPlus: +true,
          oneNumberUnaryPlus: +1,
          oneVarUnaryPlus: +input.one,
          zeroStringUnaryPlus: +"",
          zeroBooleanUnaryPlus: +false,
          zeroNumberUnaryPlus: +0,
          zeroVarUnaryPlus: +input.zero,
          zeroNullUnaryPlus: +null,
          nanObjectUnaryPlus: +{},
          nanStringUnaryPlus: +"{}",
          nanVarUnaryPlus: +input.nan,
          empty: Number(),
        };
      }),
    {
      oneString: 1,
      oneBoolean: 1,
      oneNumber: 1,
      oneVar: 1,
      zeroString: 0,
      zeroBoolean: 0,
      zeroNumber: 0,
      zeroVar: 0,
      zeroNull: 0,
      /**
       * Functionless ASL uses null for NaN.
       */
      nanObject: null as unknown as number,
      nanString: null as unknown as number,
      nanVar: null as unknown as number,
      nanTrueString: null as unknown as number,
      oneStringUnaryPlus: 1,
      oneBooleanUnaryPlus: 1,
      oneNumberUnaryPlus: 1,
      oneVarUnaryPlus: 1,
      zeroStringUnaryPlus: 0,
      zeroBooleanUnaryPlus: 0,
      zeroNumberUnaryPlus: 0,
      zeroVarUnaryPlus: 0,
      zeroNullUnaryPlus: 0,
      nanObjectUnaryPlus: null as unknown as number,
      nanStringUnaryPlus: null as unknown as number,
      nanVarUnaryPlus: null as unknown as number,
      empty: 0,
    },
    { one: "1", zero: "0", nan: "{}" }
  );

  test(
    "String coerce",
    (parent) =>
      new StepFunction(parent, "sfn", (input) => {
        return {
          stringString: String("1"),
          stringBoolean: String(true),
          stringNumber: String(1),
          stringVar: String(input.val),
          stringStringVar: String(input.str),
          stringEmpty: String(""),
          stringObject: String({ a: "a" }),
          stringObjectWithRef: String({ a: input.val }),
          stringNull: String(null),
          empty: String(),
          // stringUndefined: String(undefined), - not supported
          stringArray: String([
            "a",
            ["b"],
            [[input.val]],
            [],
            {},
            { a: input.val },
          ]),
        };
      }),
    {
      stringString: "1",
      stringBoolean: "true",
      stringNumber: "1",
      stringVar: "1",
      stringStringVar: "blah",
      stringEmpty: "",
      stringObject: "[object Object]",
      stringObjectWithRef: "[object Object]",
      stringNull: "null",
      empty: "",
      // stringUndefined: "undefined",
      // Caveat: in ECMA, this test would output: a,b,1,,[object Object],[object Object]
      // we are stringifying instead of ToString for object and arrays because SFN does not
      // allow use to easily determine an Array from an Object and recursive to string would be expensive.
      stringArray: '["a",["b"],[[1]],[],{},{"a":1}]',
    },
    { val: 1, str: "blah" }
  );

  // UnknownEndpoint: Inaccessible host: `localhost'. This service may not be available in the `us-east-1' region
  // see https://github.com/localstack/localstack/issues/6816
  test.skip(
    "sendMessage object literal with JSON Path to SQS Queue",
    (scope) => {
      interface Message {
        orderId: string;
      }

      const queue = new Queue<Message>(scope, "Queue");

      return {
        sfn: new StepFunction(
          scope,
          "fn",
          async (input: { orderId: string }): Promise<void> => {
            await queue.sendMessage({
              Message: {
                orderId: input.orderId,
              },
            });
          }
        ),
        outputs: {
          queueUrl: queue.queueUrl,
        },
      };
    },
    async (context) => {
      let start = new Date().getTime();
      while (true) {
        if (new Date().getTime() - start > 10000) {
          throw new Error(`did not receive message in 10s`);
        }
        const response = await localSQS
          .receiveMessage({
            QueueUrl: context.queueUrl,
            MaxNumberOfMessages: 1,
          })
          .promise();

        const message = response.Messages?.[0];
        if (message) {
          expect(message.Body).toEqual(JSON.stringify({ orderId: "orderId" }));
        }
      }
    },
    {
      orderId: "orderId",
    }
  );
});

/**
 * Helper state integration that dumps out the whole state into an object.
 *
 * ```ts
 * const a = "1";
 * const state = dumpState();
 * return state.a;
 * ```
 */
const dumpState = makeIntegration<"dumpState", <T>() => T>({
  kind: "dumpState",
  asl: () => ({
    jsonPath: "$",
  }),
});
