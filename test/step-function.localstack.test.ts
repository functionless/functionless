import crypto from "crypto";
import { Duration, aws_dynamodb, RemovalPolicy } from "aws-cdk-lib";
import { AttributeType } from "aws-cdk-lib/aws-dynamodb";
import {
  CompositePrincipal,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
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
  StepFunctionError,
  FunctionClosure,
  Queue,
  ASLGraph,
} from "../src";
import { makeIntegration } from "../src/integration";
import { runtimeTestExecutionContext, runtimeTestSuite } from "./runtime";
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
      scope: Construct
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

runtimeTestSuite<
  { function: string },
  { payload: any | ((context: { function: string }) => any) }
>("sfnStack", (testResource, stack, _app, beforeAllTests) => {
  const _testSfn: (
    f: typeof testResource | typeof testResource.only
  ) => TestExpressStepFunctionBase = (f) => (name, sfn, expected, payload) => {
    f(
      name,
      (parent, role) => {
        const res = sfn(parent);
        const [funcRes, outputs] =
          res instanceof StepFunction ? [res, {}] : [res.sfn, res.outputs];
        funcRes.resource.grantStartExecution(role);
        funcRes.resource.grantRead(role);

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
      async (context, clients, extra) => {
        expect(
          normalizeCDKJson(JSON.parse(extra?.definition!))
        ).toMatchSnapshot();
        const result = await testStepFunction(
          clients.stepFunctions,
          // the execution is started in the `beforeAllTests`, poll on the execution id here.
          extra?.execution!
        );

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
      },
      { payload }
    );
  };

  const test = _testSfn(testResource) as TestExpressStepFunctionResource;

  test.skip = (name, _func, _expected, _payload?) =>
    testResource.skip(
      name,
      () => {
        return { outputs: { function: "" } };
      },
      async () => {},
      { payload: undefined }
    );

  // eslint-disable-next-line no-only-tests/no-only-tests
  test.only = _testSfn(testResource.only);

  beforeAllTests(async (testOutputs, clients) => {
    return Promise.all(
      testOutputs.map(async (t) => {
        const pay =
          typeof t.test.extras?.payload === "function"
            ? (<globalThis.Function>t.test.extras?.payload)(t.deployOutputs)
            : t.test.extras?.payload;

        const execution = await clients.stepFunctions
          .startExecution({
            stateMachineArn: t.deployOutputs.outputs.function,
            input: JSON.stringify(pay),
          })
          .promise();

        return {
          ...t,
          deployOutputs: {
            ...t.deployOutputs,
            extra: {
              ...t.deployOutputs.extra,
              execution: execution.executionArn,
            },
          },
        };
      })
    );
  });

  /**
   * A role used to create functions and state machines.
   *
   * by default, all machines and state machines will create their own role, which results in hundreds of roles.
   *
   * Use this role when a test resource does not grant permissions (does not call another resource).
   * Tests which make a call to another resource should use it's own role in order
   * to test IAM inference.
   */
  const resourceRole = new Role(stack, "resourceRole", {
    assumedBy: new CompositePrincipal(
      new ServicePrincipal("states"),
      new ServicePrincipal("lambda")
    ),
  });

  // inject the localstack client config into the lambda clients
  // without this configuration, the functions will try to hit AWS proper
  const localstackClientConfig: FunctionProps = {
    timeout: Duration.seconds(20),
    role: resourceRole,
    clientConfigRetriever:
      runtimeTestExecutionContext.deployTarget === "AWS"
        ? undefined
        : () => ({
            endpoint: `http://${process.env.LOCALSTACK_HOSTNAME}:4566`,
          }),
  };

  function sfnTestLambda<I, O>(
    id: string,
    closure: FunctionClosure<I, O>
  ): Function<I, O>;
  function sfnTestLambda<I, O>(
    scope: Construct,
    id: string,
    closure: FunctionClosure<I, O>
  ): Function<I, O>;
  function sfnTestLambda<I, O>(
    ...args:
      | [id: string, closure: FunctionClosure<I, O>]
      | [scope: Construct, id: string, closure: FunctionClosure<I, O>]
  ) {
    const [scope, id, closure] =
      args.length === 2 ? [stack, args[0], args[1]] : args;
    return new Function<I, O>(scope, id, localstackClientConfig, closure);
  }

  /**
   * common function that returns an array.
   */
  const arrFunc = sfnTestLambda<undefined, number[]>("arrFunc", async () => {
    return [1, 2, 3];
  });

  const trueFunc = sfnTestLambda<undefined, boolean>("trueFunc", async () => {
    return true;
  });

  const echoStringFunc = sfnTestLambda("func", async (event) => {
    return { str: event };
  });

  test(
    "step function props are passed through to the resource",
    (parent) => {
      return new StepFunction(
        parent,
        "sfn2",
        {
          stateMachineName: `magicMachine${runtimeTestExecutionContext.stackSuffix}`,
          role: resourceRole,
        },
        async (_, context) => {
          return context.StateMachine.Name;
        }
      );
    },
    `magicMachine${runtimeTestExecutionContext.stackSuffix}`
  );

  test(
    "duplicate nodes",
    (parent) => {
      return new StepFunction(
        parent,
        "sfn2",
        { role: resourceRole },
        async () => {
          "hello world";
          "hello world";
          return "hello world";
        }
      );
    },
    "hello world"
  );

  test(
    "call lambda",
    (parent) => {
      const func2 = sfnTestLambda<{ str: string }, { str: string }>(
        parent,
        "func2",
        async (event) => {
          return event;
        }
      );
      const func3 = sfnTestLambda<number[], number>(
        parent,
        "func3",
        async (event) => {
          return event.length;
        }
      );
      return new StepFunction(parent, "sfn2", async (event) => {
        const f1 = (await echoStringFunc("hello world")).str;
        const obj = { str: "hello world" };
        const arr = [1, 2, 3];
        return {
          f1,
          f2: (await echoStringFunc(event.str)).str,
          f3: (await func2({ str: "hello world 2" })).str,
          f4: (await func2(obj)).str,
          f5: await func3([1, 2]),
          f6: await func3(arr),
          f7: (
            await $SFN.retry(async () =>
              $AWS.Lambda.Invoke({
                Function: func2,
                Payload: obj,
              })
            )
          ).Payload.str,
        };
      });
    },
    {
      f1: "hello world",
      f2: "world hello",
      f3: "hello world 2",
      f4: "hello world",
      f5: 2,
      f6: 3,
      f7: "hello world",
    },
    { str: "world hello" }
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
    "call $SFN map, foreach, and parallel",
    (parent) => {
      const func = sfnTestLambda<number, void>(
        parent,
        "func",
        async (event) => {
          console.log(event);
        }
      );

      return new StepFunction(parent, "sfn2", async (input) => {
        await $SFN.forEach(input.arr, (n) => $SFN.retry(async () => func(n)));

        return {
          a: await $SFN.map([1, 2, 3], (n) => {
            return `n${n}`;
          }),
          b: await $SFN.map(input.arr, (n) => {
            return n;
          }),
          c: await $SFN.parallel(
            () => 1,
            () => 2
          ),
        };
      });
    },
    { a: ["n1", "n2", "n3"], b: [1, 2], c: [1, 2] },
    { arr: [1, 2] }
  );

  const shasum = crypto.createHash("sha1");
  shasum.update("hide me");
  const sha256sum = crypto.createHash("sha256");
  sha256sum.update("hashMe");

  test(
    "intrinsics",
    (parent) => {
      return new StepFunction(parent, "sfn", async (input) => {
        let objAccess;
        try {
          objAccess = input.range[input.key];
        } catch (err) {
          objAccess = (<StepFunctionError>err).cause;
        }
        let objIn;
        try {
          objIn = input.key in input.range;
        } catch (err) {
          objIn = (<StepFunctionError>err).cause;
        }
        return {
          partition: $SFN.partition([1, 2, 3, 4, 5, 6], 4),
          partitionRef: $SFN.partition(input.arr, input.part),
          range: $SFN.range(4, 30, 5),
          rangeRef: $SFN
            .range(input.range.start, input.range.end, input.range.step)
            .map((n) => `n${n}`)
            .join(""),
          unique: $SFN.unique(["a", 5, 4, 3, 2, 1, 1, 2, 3, 4, 5, "a", "b"]),
          uniqueRef: $SFN.unique(input.arr),
          base64: $SFN.base64Decode($SFN.base64Encode("test")),
          base64Ref: $SFN.base64Decode($SFN.base64Encode(input.baseTest)),
          hash: $SFN.hash("hide me", "SHA-1"),
          hashRef: $SFN.hash(input.hashTest, input.hashAlgo),
          includes: [1, 2, 3, 4].includes(2),
          includesRes: input.arr.includes(input.part),
          notIncludesRes: input.arr.includes("a" as unknown as number),
          get: [1, 2, 3, 4][0]!,
          getRef: input.arr[input.part]!,
          getFunc: $SFN.getItem(input.arr, 0),
          getFuncRef: $SFN.getItem(input.arr, input.part),
          objAccess,
          ...input.range,
          inRef: input.part in input.arr,
          inRefFalse: input.large in input.arr,
          objIn,
          getLength: [1, 2, 3, 4].length,
          lengthRef: input.arr.length,
          uniqueLength: $SFN.unique(input.arr).length,
          lengthObj: input.lengthObj.length,
          ...input.lengthObj,
          emptyLength: input.emptyArr.length,
          slice: input.arr.slice(1, 3),
          sliceRef: input.arr.slice(input.part, input.end),
          sliceRefStart: input.arr.slice(input.end),
          constantSplit: "literal.value".split("."),
          refSplitWithConstant: input.hashAlgo.split("-"),
          refSplitWithRef: input.hashAlgo.split(input.split),
          constantSplitWithRef: "1-2-3-4".split(input.split),
          // step functions split filters out empty strings
          // https://twitter.com/sussmansa/status/1569051340575494144
          splitEmpty: "-1---4".split(input.split),
        };
      });
    },
    {
      partition: [
        [1, 2, 3, 4],
        [5, 6],
      ],
      partitionRef: [[1, 2], [3, 1], [2, 3], [4]],
      range: [4, 9, 14, 19, 24, 29],
      rangeRef: "n1n3n5n7n9n11",
      unique: ["a", 1, 2, "b", 3, 4, 5],
      uniqueRef: [1, 2, 3, 4],
      base64: "test",
      base64Ref: "encodeMe",
      hash: shasum.digest("hex"),
      hashRef: sha256sum.digest("hex"),
      includes: true,
      includesRes: true,
      notIncludesRes: false,
      get: 1,
      getRef: 3,
      getFunc: 1,
      getFuncRef: 3,
      objAccess: "Reference element access is not valid for objects.",
      inRef: true,
      inRefFalse: false,
      objIn: "Reference element access is not valid for objects.",
      getLength: 4,
      length: "a",
      lengthRef: 7,
      uniqueLength: 4,
      lengthObj: "a",
      emptyLength: 0,
      slice: [2, 3],
      sliceRef: [3, 1],
      sliceRefStart: [2, 3, 4],
      start: 1,
      end: 11,
      step: 2,
      constantSplit: ["literal", "value"],
      refSplitWithConstant: ["SHA", "256"],
      refSplitWithRef: ["SHA", "256"],
      constantSplitWithRef: ["1", "2", "3", "4"],
      splitEmpty: ["1", "4"],
    },
    {
      range: { start: 1, end: 11, step: 2 },
      arr: [1, 2, 3, 1, 2, 3, 4],
      part: 2,
      end: 4,
      large: 100,
      baseTest: "encodeMe",
      hashTest: "hashMe",
      hashAlgo: "SHA-256" as ASLGraph.HashAlgorithm,
      lengthObj: { length: "a" },
      emptyArr: [],
      key: "start" as const,
      split: "-",
    }
  );

  test(
    "object literal spread",
    (parent) => {
      return new StepFunction(parent, "sfn", async (input) => {
        const literalValueObjectLiterals = {
          x: 1,
          y: "a",
          j: { x: 2 },
          ...input,
        };

        // the duplication tests depth of intrinsic
        // TODO: after optimization is added, turn some of it
        return {
          ...{ a: 0, b: 2, c: 3 },
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...{ m: 0, n: 5, o: 6 },
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...{ x: 7, y: 8, z: 9, a: 1, m: 4 },
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          ...input,
          literalValueObjectLiterals,
        };
      });
    },
    {
      a: 1,
      b: 2,
      c: 3,
      m: 4,
      n: 5,
      o: 6,
      x: 7,
      y: 8,
      z: 9,
      literalValueObjectLiterals: { x: 1, y: "a", j: { x: 2 }, a: 1 },
    },
    { a: 1 }
  );

  test(
    "call $SFN retry",
    (parent) => {
      const table = new Table<{ a: string; n: number }, "a">(parent, "table", {
        partitionKey: {
          name: "a",
          type: AttributeType.STRING,
        },
      });
      return new StepFunction(parent, "sfn2", async ({ id }) => {
        // retry and then succeed - 3
        const a = await $SFN.retry(async () => {
          const result = await table.update.attributes({
            Key: {
              a: { S: id },
            },
            UpdateExpression: "SET n = if_not_exists(n, :init) + :inc",
            ReturnValues: "ALL_NEW",
            ExpressionAttributeValues: {
              ":init": { N: "0" },
              ":inc": { N: "1" },
            },
          });
          if (result.Attributes?.n?.N === "3") {
            return Number(result.Attributes?.n.N);
          }
          throw new StepFunctionError("MyError", "Because");
        });

        // retry and fail
        let b = 0;
        try {
          b = await $SFN.retry(async () => {
            throw new StepFunctionError("MyError", "Because");
          });
        } catch {
          b = 2;
        }

        // retry with custom error and fail
        let c = 0;
        try {
          c = await $SFN.retry(
            [
              {
                ErrorEquals: ["MyError"],
                BackoffRate: 1,
                IntervalSeconds: 1,
                MaxAttempts: 1,
              },
            ],
            async () => {
              throw new StepFunctionError("MyError", "Because");
            }
          );
        } catch {
          c = 3;
        }

        // retry defined, but different error type, fail
        let d = 0;
        try {
          d = await $SFN.retry(
            [
              {
                ErrorEquals: ["MyError2"],
                BackoffRate: 1,
                IntervalSeconds: 1,
                MaxAttempts: 1,
              },
            ],
            async () => {
              throw new StepFunctionError("MyError", "Because");
            }
          );
        } catch {
          d = 5;
        }

        // retry multiple error types - 111111
        let e = 0;
        try {
          e = await $SFN.retry(
            [
              {
                ErrorEquals: ["MyError2"],
                BackoffRate: 1,
                IntervalSeconds: 1,
                MaxAttempts: 2,
              },
              {
                ErrorEquals: ["MyError"],
                BackoffRate: 1,
                IntervalSeconds: 1,
                MaxAttempts: 2,
              },
            ],
            async () => {
              const result = await table.update.attributes({
                Key: {
                  a: { S: id },
                },
                UpdateExpression: "SET n = if_not_exists(n, :init) + :inc",
                ReturnValues: "ALL_NEW",
                ExpressionAttributeValues: {
                  ":init": { N: "0" },
                  ":inc": { N: "1" },
                },
              });
              if (result.Attributes?.n?.N === "6") {
                return 6;
              }
              if (result.Attributes?.n?.N === "5") {
                throw new StepFunctionError("MyError", "Because");
              }
              throw new StepFunctionError("MyError2", "Because");
            }
          );
        } catch {
          e = 7;
        }

        return [a, b, c, d, e];
      });
    },
    [3, 2, 3, 5, 6],
    { id: `key${Math.floor(Math.random() * 1000)}` }
  );

  test(
    "$AWS.SDK.DynamoDB.describeTable",
    (parent) => {
      const table = new Table<{ id: string }, "id">(parent, "myTable", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
        removalPolicy: RemovalPolicy.DESTROY,
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
      return new StepFunction(parent, "sfn2", async (input) => {
        if (input.a) {
          if (await $SFN.retry(() => trueFunc())) {
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
            for (const i of await arrFunc()) {
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
      return new StepFunction(parent, "sfn2", async (input) => {
        let a = "x";
        for (const i of [1, 2, 3]) {
          a = `${a}${i}`;
        }
        for (const i of input.arr) {
          a = `${a}${i}`;
        }
        for (const i of await arrFunc()) {
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
      return new StepFunction(parent, "sfn2", async (input) => {
        const l = (await arrFunc()).map((x) => `n${x}`);
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
      return new StepFunction(parent, "sfn2", async (input) => {
        let a = "";
        const l = (await $SFN.retry(() => arrFunc())).map((x) => `n${x}`);
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
      return new StepFunction(parent, "sfn2", async (input) => {
        const l = (await arrFunc()).map((x) => `${input.prefix}${x}`);
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
      return new StepFunction(
        parent,
        "sfn2",
        { role: resourceRole },
        async (input) => {
          let a = "";
          input.arr.forEach((x) => {
            a = `${a}a${x}`;
            return a;
          });
          return a;
        }
      );
    },
    "a1a2a3",
    { arr: [1, 2, 3] }
  );

  test(
    "filter",
    (parent) => {
      return new StepFunction(
        parent,
        "sfn2",
        { role: resourceRole },
        async ({ arr, key }) => {
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
        }
      );
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
      return new StepFunction(
        parent,
        "sfn2",
        { role: resourceRole },
        async (input) => {
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

          if (
            ((y = `${y}5`), false) ||
            ((y = `${y}6`), true) ||
            (y = `${y}7`)
          ) {
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
        }
      );
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
    "math",
    (parent) =>
      new StepFunction(parent, "sfn", async (input) => {
        let a = input.p;
        let b = 1;

        return {
          plusEqualsConst: (b += 1), // 2
          plusEqualsRef: (b += input.p), // 3
          minusEqualsConst: (b -= 1), // 2
          minusEqualsRef: (b -= input.p), // 1
          minusEqualsNegConst: (b -= -1), // 2
          b, // 2
          refPlusRef: input.p + input.p, //2
          refPlusNegRef: input.p + input.n, // 0
          refPlusZeroRef: input.p + input.z, // 1
          refPlusConst: input.p + 1, // 2
          refPlusNegConst: input.p + -1, // 0
          refPlusZeroConst: input.p + -0, // 1
          // @ts-ignore
          refPlusBooleanConst: input.p + true, // 2
          // @ts-ignore
          refBooleanPlusBooleanConst: input.b + true, // 2
          // @ts-ignore
          refBooleanPlusBooleanRef: input.b + input.b, // 2
          // @ts-ignore
          constBooleanPlusBooleanConst: true + true, // 2
          refMinusRef: input.p - input.p, // 0
          refMinusNegRef: input.p - input.n, // 2
          refMinusZeroRef: input.p - input.z, // 1
          refMinusConst: input.p - 1, // 0
          refMinusNegConst: input.p - -1, // 2
          postPlusPlus: a++, // 1=>2
          prePlusPlus: ++a, // 3
          postMinusMinus: a--, // 3 => 2
          preMinusMinus: --a, // 1
          negateRef: -input.p, // -1
          negateNegRef: -input.n, // 1
          negateZeroRef: -input.z, // 0
          refStringPlusNumberConst: input.str + 1, // "a1",
          refStringPlusStringConst: input.str + "b", // "ab"
          refStringPlusBooleanConst: input.str + true, // "atrue"
          numberConstPlusRefString: 1 + input.str, // "1a",
          stringConstPlusRefString: "b" + input.str, // "ba"
          booleanConstPlusRefString: true + input.str, // "truea"
          refStringPlusRefString: input.str + input.str, // "aa"
          constStringPlusStringConst: "a" + "b", // "ab"
          constStringPlusNumberConst: "a" + 1, // "a1"
          constStringPlusBooleanConst: "a" + true, // "atrue"
        };
      }),
    {
      b: 2,
      plusEqualsConst: 2,
      plusEqualsRef: 3,
      minusEqualsConst: 2,
      minusEqualsRef: 1,
      minusEqualsNegConst: 2,
      refPlusRef: 2,
      refPlusNegRef: 0,
      refPlusZeroRef: 1,
      refPlusConst: 2,
      refPlusNegConst: 0,
      refPlusZeroConst: 1,
      refPlusBooleanConst: 2,
      refBooleanPlusBooleanConst: 2,
      refBooleanPlusBooleanRef: 2,
      constBooleanPlusBooleanConst: 2,
      refMinusRef: 0,
      refMinusNegRef: 2,
      refMinusZeroRef: 1,
      refMinusConst: 0,
      refMinusNegConst: 2,
      postPlusPlus: 1,
      prePlusPlus: 3,
      postMinusMinus: 3,
      preMinusMinus: 1,
      negateRef: -1,
      negateNegRef: 1,
      negateZeroRef: 0,
      refStringPlusNumberConst: "a1",
      refStringPlusStringConst: "ab",
      refStringPlusBooleanConst: "atrue",
      numberConstPlusRefString: "1a",
      stringConstPlusRefString: "ba",
      booleanConstPlusRefString: "truea",
      refStringPlusRefString: "aa",
      constStringPlusStringConst: "ab",
      constStringPlusNumberConst: "a1",
      constStringPlusBooleanConst: "atrue",
    },
    { p: 1, n: -1, z: 0, str: "a", b: true }
  );

  test(
    "binary and unary comparison",
    (parent) => {
      return new StepFunction(
        parent,
        "sfn2",
        { role: resourceRole },
        async (input) => {
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
            objNotPresentFalse: !input.obj,
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
        }
      );
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
      varNotPresentFalse: true,
      objNotPresentFalse: false,
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
      const func = sfnTestLambda<boolean, boolean>(
        parent,
        "func",
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
      return new StepFunction(parent, "sfn2", async () => {
        return {
          and: true && (await $SFN.retry(() => trueFunc())),
          or: false || (await $SFN.retry(() => trueFunc())),
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
      return new StepFunction(
        parent,
        "sfn2",
        { role: resourceRole },
        async (input) => {
          const a = "2";
          return { a: input.a, b: a };
        }
      );
    },
    { a: "1", b: "2" },
    { a: "1" }
  );

  test(
    "assignment",
    (parent) => {
      return new StepFunction(
        parent,
        "sfn2",
        { role: resourceRole },
        async () => {
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
        }
      );
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
      return new StepFunction(
        parent,
        "sfn2",
        { role: resourceRole },
        async () => {
          const obj = { 1: "a", x: "b" } as {
            1: string;
            x: string;
            n?: string;
          };
          const arr = [1];
          return {
            a: obj.x,
            b: obj.x,
            // c: obj[1], -- invalid SFN - localstack hangs on error
            d: obj["1"],
            e: arr[0],
            // f: arr["0"], -- invalid SFN - localstack hangs on error
            g: obj?.n ?? "c",
            h: obj?.n ?? "d",
          };
        }
      );
    },
    {
      a: "b",
      b: "b",
      // c: "a",
      d: "a",
      e: 1,
      //  f: 1,
      g: "c",
      h: "d",
    }
  );

  test(
    "templates",
    (parent) => {
      return new StepFunction<
        { obj: { str: string; str2?: string; items: number[] } },
        string
      >(parent, "fn", async (input) => {
        const partOfTheTemplateString = `hello ${input.obj.str2 ?? "default"}`;

        const templateWithSpecial = `{{'\\${input.obj.str}\\'}}`;

        const result = await echoStringFunc(
          `${input.obj.str} ${"hello"} ${partOfTheTemplateString} ${
            input.obj.items[0]
          }`
        );

        return `the result: ${result.str} ${
          input.obj.str === "hullo"
        } ${templateWithSpecial}`;
      });
    },
    "the result: hullo hello hello default 1 true {{'\\hullo\\'}}",
    { obj: { str: "hullo", items: [1] } }
  );

  test(
    "typeof",
    (parent) => {
      return new StepFunction(
        parent,
        "fn",
        { role: resourceRole },
        async (input) => {
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
        }
      );
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
      return new StepFunction<{ arr: number[]; id: string }, string>(
        parent,
        "fn",
        async (input) => {
          let a = "";
          for (const i in input.arr) {
            a = `${a}${i}${input.arr[i]!}`;
          }
          for (const i in input.arr) {
            let j = "1";
            for (j in input.arr) {
              a = `${a}|n${input.arr[i]!}i${i}n${input.arr[j]!}j${j}`;
            }
            a = `${a}--${j}`;
          }
          return a;
        }
      );
    },
    "011223|n1i0n1j0|n1i0n2j1|n1i0n3j2--2|n2i1n1j0|n2i1n2j1|n2i1n3j2--2|n3i2n1j0|n3i2n2j1|n3i2n3j2--2",
    { arr: [1, 2, 3], id: `key${Math.floor(Math.random() * 1000)}` }
  );

  test(
    "for of",
    (parent) => {
      return new StepFunction<{ arr: number[]; id: string }, string>(
        parent,
        "fn",
        async (input) => {
          let a = "";
          for (const i of input.arr) {
            a = `${a}${i}`;
          }
          // 2 + 3 + 4 + 3 + 4 + 5 + 4 + 5 + 6 = 36 + 6 = 42
          for (const i of input.arr) {
            let j = 1;
            for (j of input.arr) {
              a = `${a}|i${i}j${j}`;
            }
            // 3 + 3 + 3 = 9 = 51
            a = `${a}--${j}`;
          }
          return a;
        }
      );
    },
    "123|i1j1|i1j2|i1j3--3|i2j1|i2j2|i2j3--3|i3j1|i3j2|i3j3--3",
    { arr: [1, 2, 3], id: `key${Math.floor(Math.random() * 1000)}` }
  );

  test(
    "for",
    (parent) => {
      return new StepFunction(
        parent,
        "sfn",
        { role: resourceRole },
        (input) => {
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
        }
      );
    },
    "n1n2n3cc11",
    { arr: [1, 2, 3] }
  );

  test(
    "continue break",
    (parent) => {
      return new StepFunction<{ id: string }, string>(
        parent,
        "sfn",
        async () => {
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

          let b = "";
          for (const i of [1, 2, 3, 4]) {
            if (i === 1) {
              continue;
            }
            b = `${b}${i}`;
            if (i === 3) {
              break;
            }
          }
          return `${a}${b}`;
        }
      );
    },
    "1112123"
  );

  test(
    "throw catch finally",
    (parent) => {
      const func = sfnTestLambda<undefined, void>(parent, "func", async () => {
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
        { role: resourceRole },
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
      return new StepFunction(
        parent,
        "sfn2",
        { role: resourceRole },
        async (input) => {
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
        }
      );
    },
    // Caveat: Unlike ECMA, we run JSON.stringify on object and arrays
    'a/b/c#1-2-3#1|2|3#d|e|f##1,2,3#a={"a":"a"}=["b"]={"b":"b"}=[1,2,3]=null',
    { arr: [1, 2, 3], sep: "|", obj: { b: "b" } }
  );

  test(
    "ternary",
    (parent) => {
      return new StepFunction(parent, "fn", async (input) => {
        let a = "";
        input.t ? (a = `${a}1`) : null;

        // should add 3
        input.f ? (a = `${a}2`) : (a = `${a}3`);

        // should not execute update
        input.t ? null : (a = `${a}4`);

        return {
          true: input.t ? "a" : "b",
          false: input.f ? "a" : "b",
          constantTrue: true ? "c" : "d",
          constantFalse: false ? "c" : "d",
          result: a,
        };
      });
    },
    {
      true: "a",
      false: "b",
      constantTrue: "c",
      constantFalse: "d",
      result: "13",
    },
    { t: true, f: false, id: `key${Math.floor(Math.random() * 1000)}` }
  );

  test(
    "json parse and stringify",
    (parent) => {
      return new StepFunction(
        parent,
        "sfn",
        { role: resourceRole },
        async (input) => {
          const str = JSON.stringify(input);
          const obj = JSON.parse(str);
          return {
            str: str,
            obj: obj,
            a: obj.a,
          };
        }
      );
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
      return new StepFunction(
        parent,
        "sfn",
        { role: resourceRole },
        async (_, context) => {
          return `name: ${context.Execution.Name}`;
        }
      );
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
      new StepFunction(parent, "sfn", { role: resourceRole }, async (input) => {
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
      new StepFunction(parent, "sfn", { role: resourceRole }, async () => {
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
        { role: resourceRole },
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

          const arr = [{ a: "a", b: [1] }];

          const sfnMap = await $SFN.map(arr, ({ a, b: [c] }) => a + c);

          // just should not fail
          await $SFN.forEach(arr, ({ a, b: [c] }) => {
            `${a} ${c}`;
          });

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
            sfnMap,
          };
        }
      ),
    {
      prop: "helloworldwhatisupsirendofarraydynamicwhat",
      var: "helloworlddynamicwhatisupsirendofarray",
      map: "ab",
      forV: "ab",
      tr: "hi",
      sfnMap: ["a1"],
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
      new StepFunction(parent, "sfn", { role: resourceRole }, async () => {
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
      new StepFunction(parent, "sfn", { role: resourceRole }, (input) => {
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
      new StepFunction(parent, "sfn", { role: resourceRole }, (input) => {
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
          // @ts-ignore
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
      new StepFunction(parent, "sfn", { role: resourceRole }, (input) => {
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

  test(
    "queue",
    (scope) => {
      const queue = new Queue<{ id: string }>(stack, "Queue");

      return new StepFunction(scope, "q", async () => {
        await queue.sendMessage({ MessageBody: { id: "hello" } });
        await queue.sendMessageBatch({
          Entries: [{ MessageBody: { id: "hello" }, Id: "1" }],
        });
        await queue.sendMessageBatch({
          Entries: [{ MessageBody: { id: "hello" }, Id: "2" }],
        });
        await queue.receiveMessage();
        await queue.purge();
      });
    },
    null
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
