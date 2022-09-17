import { App, Stack } from "aws-cdk-lib";
import { StepFunction } from "../src";
import { Event, EventBus } from "../src/event-bridge";
import { Function } from "../src/function";
import { ebEventPatternTestCase, ebEventPatternTestCaseError } from "./util";

type TestEvent = Event<{
  num: number;
  str: string;
  optional?: string;
  optionalNum?: number;
  "multi-part": string;
  deep: {
    value: string;
  };
  bool: boolean;
  array: string[];
  numArray: number[];
  boolArray: boolean[];
}>;

describe("event pattern", () => {
  describe("equals", () => {
    test("simple", () => {
      ebEventPatternTestCase((event: TestEvent) => event.source === "lambda", {
        source: ["lambda"],
      });
    });

    test("no event parameter", () => {
      ebEventPatternTestCase(() => true, {
        source: [{ prefix: "" }],
      });
    });

    test("index access", () => {
      ebEventPatternTestCase(
        // eslint-disable-next-line dot-notation
        (event: TestEvent) => event["source"] === "lambda",
        {
          source: ["lambda"],
        }
      );
    });

    test("double equals", () => {
      ebEventPatternTestCase((event: TestEvent) => event.source == "lambda", {
        source: ["lambda"],
      });
    });

    test("is null", () => {
      ebEventPatternTestCase((event: TestEvent) => event.source === null, {
        source: [null],
      });
    });

    test("detail", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => event.detail.str === "something",
        {
          detail: { str: ["something"] },
        }
      );
    });

    test("detail deep", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => event.detail.deep.value === "something",
        {
          detail: { deep: { value: ["something"] } },
        }
      );
    });

    test("detail index accessor", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => event.detail["multi-part"] === "something",
        {
          detail: { "multi-part": ["something"] },
        }
      );
    });

    test("numeric", () => {
      ebEventPatternTestCase((event: TestEvent) => event.detail.num === 50, {
        detail: { num: [50] },
      });
    });

    test("negative number", () => {
      ebEventPatternTestCase((event: TestEvent) => event.detail.num === -50, {
        detail: { num: [-50] },
      });
    });

    // regression: we require explicit `bool === true`
    test.skip("boolean implicit", () => {
      ebEventPatternTestCase((event: TestEvent) => event.detail.bool, {
        detail: {
          bool: [true],
        },
      });
    });

    // regression: we require explicit `bool === false`
    test.skip("boolean implicit false", () => {
      ebEventPatternTestCase((event: TestEvent) => !event.detail.bool, {
        detail: { bool: [false] },
      });
    });

    test("boolean explicit", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => event.detail.bool === false,
        {
          detail: { bool: [false] },
        }
      );
    });

    describe("array", () => {
      test("array", () => {
        ebEventPatternTestCase(
          (event: TestEvent) => event.detail.array.includes("something"),
          {
            detail: { array: ["something"] },
          }
        );
      });

      test("num array", () => {
        ebEventPatternTestCase(
          (event: TestEvent) => event.detail.numArray.includes(1),
          {
            detail: { numArray: [1] },
          }
        );
      });

      test("num array", () => {
        ebEventPatternTestCase(
          (event: TestEvent) => event.detail.numArray.includes(-1),
          {
            detail: { numArray: [-1] },
          }
        );
      });

      test("bool array", () => {
        ebEventPatternTestCase(
          (event: TestEvent) => event.detail.boolArray.includes(true),
          {
            detail: { boolArray: [true] },
          }
        );
      });

      test("array not includes", () => {
        ebEventPatternTestCase(
          (event: TestEvent) => !event.detail.array.includes("something"),
          {
            detail: { array: [{ "anything-but": "something" }] },
          }
        );
      });

      test("num array not includes", () => {
        ebEventPatternTestCase(
          (event: TestEvent) => !event.detail.numArray.includes(1),
          {
            detail: { numArray: [{ "anything-but": 1 }] },
          }
        );
      });

      test("bool array not includes", () => {
        ebEventPatternTestCase(
          (event: TestEvent) => !event.detail.boolArray.includes(true),
          {
            detail: { boolArray: [false] },
          }
        );
      });

      test("array explicit equals error", () => {
        ebEventPatternTestCaseError(
          // @ts-ignore
          (event: TestEvent) => event.detail.array === ["a", "b"],
          "Event Patterns can only compare primitive values"
        );
      });
    });
  });

  describe("prefix", () => {
    test("prefix", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => event.source.startsWith("l"),
        {
          source: [{ prefix: "l" }],
        }
      );
    });

    test("not prefix", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !event.source.startsWith("l"),
        {
          source: [{ "anything-but": { prefix: "l" } }],
        }
      );
    });

    // regression: this will be a tsc-level error now that we don't have type information in the AST
    test.skip("prefix non string", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) => (<any>event.detail.num).startsWith("l"),
        "Starts With operation only supported on strings, found number."
      );
    });
  });

  describe("numeric range single", () => {
    test("numeric range single", () => {
      ebEventPatternTestCase((event: TestEvent) => event.detail.num < 100, {
        detail: { num: [{ numeric: ["<", 100] }] },
      });
    });

    test("numeric range greater than", () => {
      ebEventPatternTestCase((event: TestEvent) => event.detail.num > 100, {
        detail: { num: [{ numeric: [">", 100] }] },
      });
    });

    test("numeric range greater than equals", () => {
      ebEventPatternTestCase((event: TestEvent) => event.detail.num >= 100, {
        detail: { num: [{ numeric: [">=", 100] }] },
      });
    });

    test("numeric range inverted", () => {
      ebEventPatternTestCase((event: TestEvent) => 100 < event.detail.num, {
        detail: { num: [{ numeric: [">", 100] }] },
      });
    });

    test("numeric range inverted", () => {
      ebEventPatternTestCase((event: TestEvent) => 100 >= event.detail.num, {
        detail: { num: [{ numeric: ["<=", 100] }] },
      });
    });
  });

  describe("not", () => {
    test("string", () => {
      ebEventPatternTestCase((event: TestEvent) => event.source !== "lambda", {
        source: [{ "anything-but": "lambda" }],
      });
    });

    test("not not prefix", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !!event.source.startsWith("lambda"),
        {
          source: [{ prefix: "lambda" }],
        }
      );
    });

    test("negate string equals", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !(event.source === "lambda"),
        {
          source: [{ "anything-but": "lambda" }],
        }
      );
    });

    test("negate not string equals", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !(event.source !== "lambda"),
        {
          source: ["lambda"],
        }
      );
    });

    test("not bool true", () => {
      ebEventPatternTestCase((event: TestEvent) => event.detail.bool !== true, {
        detail: { bool: [false] },
      });
    });

    test("negate not bool true", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !(event.detail.bool !== true),
        {
          detail: { bool: [true] },
        }
      );
    });

    test("negate bool true", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !(event.detail.bool === true),
        {
          detail: { bool: [false] },
        }
      );
    });

    test("string wrapped", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !(event.source === "lambda"),
        {
          source: [{ "anything-but": "lambda" }],
        }
      );
    });

    test("number", () => {
      ebEventPatternTestCase((event: TestEvent) => event.detail.num !== 100, {
        detail: { num: [{ "anything-but": 100 }] },
      });
    });

    test("array", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !event.detail.array.includes("something"),
        {
          detail: { array: [{ "anything-but": "something" }] },
        }
      );
    });

    test("string prefix", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !event.detail.str.startsWith("something"),
        {
          detail: { str: [{ "anything-but": { prefix: "something" } }] },
        }
      );
    });

    test("negate multiple fields", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) =>
          !(event.detail.str === "hello" && event.id === "there"),
        "Can only negate simple statements like equals, doesn't equals, and prefix."
      );
    });

    test("negate multiple", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) => !(event.detail.str || !event.detail.str),
        "Impossible logic discovered."
      );
    });

    test("negate negate multiple", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !!(event.detail.str || !event.detail.str),
        { source: [{ prefix: "" }] }
      );
    });

    test("negate intrafield valid aggregate", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) =>
          !(event.detail.str.startsWith("hello") || event.detail.str === "hi")
      ),
        "Can only negate simple statments like boolean and equals.";
    });
  });

  describe("exists", () => {
    test("does", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => event.detail.optional !== undefined,
        {
          detail: { optional: [{ exists: true }] },
        }
      );
    });

    test("does in", () => {
      ebEventPatternTestCase((event: TestEvent) => "optional" in event.detail, {
        detail: { optional: [{ exists: true }] },
      });
    });

    test("does exist lone value", () => {
      ebEventPatternTestCase((event: TestEvent) => !!event.detail.optional, {
        detail: { optional: [{ exists: true }] },
      });
    });

    test("does not", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => event.detail.optional === undefined,
        {
          detail: { optional: [{ exists: false }] },
        }
      );
    });

    test("does not in", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !("optional" in event.detail),
        {
          detail: { optional: [{ exists: false }] },
        }
      );
    });

    test("exists at event level", () => {
      ebEventPatternTestCase((event: TestEvent) => "source" in event, {
        source: [{ exists: true }],
      });
    });
  });

  describe("references", () => {
    const myConstant = "hello";
    test("external constant", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => event.detail.str === myConstant,
        {
          detail: { str: [myConstant] },
        }
      );
    });

    const constantObj = { value: "hello2" };

    test("external constant", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => event.detail.str === constantObj.value,
        {
          detail: { str: [constantObj.value] },
        }
      );
    });

    test("internal constant", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => {
          const myInternalContant = "hi";
          return event.detail.str === myInternalContant;
        },
        {
          detail: { str: ["hi"] },
        }
      );
    });

    test("formatting", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => {
          const myInternalContant = "hi";
          return event.detail.str === `${myInternalContant} there`;
        },
        {
          detail: { str: ["hi there"] },
        }
      );
    });

    test("internal property", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => {
          const myInternalContant = { value: "hi" };
          return event.detail.str === myInternalContant.value;
        },
        {
          detail: { str: ["hi"] },
        }
      );
    });

    test("constant function call", () => {
      ebEventPatternTestCaseError((event: TestEvent) => {
        const myInternalContant = (() => "hi" + " " + "there")();
        return event.detail.str === myInternalContant;
      }, "Equivalency must compare to a constant value.");
    });

    test("constant function call", () => {
      ebEventPatternTestCaseError((event: TestEvent) => {
        const myMethod = () => "hi" + " " + "there";
        return event.detail.str === myMethod();
      }, "Equivalency must compare to a constant value.");
    });
  });

  describe("simple invalid", () => {
    test("error on raw event in predicate", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) => !!event,
        "Identifier is unsupported"
      );
    });
  });

  describe("numeric aggregate", () => {
    test("numeric range aggregate", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.num >= 100 && event.detail.num < 1000,
        {
          detail: { num: [{ numeric: [">=", 100, "<", 1000] }] },
        }
      );
    });

    test("numeric range overlapping", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.num >= 100 &&
          event.detail.num < 1000 &&
          event.detail.num > 50,
        {
          detail: { num: [{ numeric: [">=", 100, "<", 1000] }] },
        }
      );
    });

    test("numeric range negate", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          !(event.detail.num >= 100 && event.detail.num < 1000),
        {
          detail: { num: [{ numeric: [">=", 1000, "<", 100] }] },
        }
      );
    });

    test("numeric range overlapping", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.num >= 100 &&
          event.detail.num < 1000 &&
          event.detail.num < 200,
        {
          detail: { num: [{ numeric: [">=", 100, "<", 200] }] },
        }
      );
    });

    test("numeric range aggregate with other fields", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.num >= 100 &&
          event.detail.num < 1000 &&
          event.detail.str === "something",
        {
          detail: {
            num: [{ numeric: [">=", 100, "<", 1000] }],
            str: ["something"],
          },
        }
      );
    });

    test("numeric range or exclusive", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => event.detail.num > 300 || event.detail.num < 200,
        {
          detail: { num: [{ numeric: [">", 300] }, { numeric: ["<", 200] }] },
        }
      );
    });

    test("numeric range or exclusive negate", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          !(event.detail.num > 300 || event.detail.num < 200),
        {
          detail: { num: [{ numeric: [">=", 200, "<=", 300] }] },
        }
      );
    });

    // the ranges represent infinity, so the clause is removed
    test("numeric range or aggregate empty", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => event.detail.num < 300 || event.detail.num > 200,
        {
          source: [{ prefix: "" }],
        }
      );
    });

    test("numeric range or aggregate", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          (event.detail.num > 300 && event.detail.num < 350) ||
          event.detail.num < 200,
        {
          detail: {
            num: [{ numeric: [">", 300, "<", 350] }, { numeric: ["<", 200] }],
          },
        }
      );
    });

    test("numeric range or and AND", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          (event.detail.num > 300 || event.detail.num < 200) &&
          event.detail.num > 0,
        {
          detail: {
            num: [{ numeric: [">", 300] }, { numeric: [">", 0, "<", 200] }],
          },
        }
      );
    });

    /**
     * > 300
     * < 200
     *
     * Second range is invalid
     * > 0
     * < 500
     */
    test("numeric range or and AND part reduced", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          (event.detail.num > 300 || event.detail.num < 200) &&
          (event.detail.num > 0 || event.detail.num < 500),
        {
          detail: {
            num: [{ numeric: [">", 300] }, { numeric: ["<", 200] }],
          },
        }
      );
    });

    test("numeric range or and AND part reduced inverted", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          (event.detail.num > 0 || event.detail.num < 500) &&
          (event.detail.num > 300 || event.detail.num < 200),
        {
          detail: {
            num: [{ numeric: [">", 300] }, { numeric: ["<", 200] }],
          },
        }
      );
    });

    test("numeric range or and AND part reduced both valid", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          (event.detail.num > 300 || event.detail.num < 200) &&
          (event.detail.num > 250 || event.detail.num < 100),
        {
          detail: {
            num: [{ numeric: [">", 300] }, { numeric: ["<", 100] }],
          },
        }
      );
    });

    test("numeric range or and AND part reduced both ranges", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          ((event.detail.num >= 10 && event.detail.num <= 20) ||
            (event.detail.num >= 30 && event.detail.num <= 40)) &&
          ((event.detail.num >= 5 && event.detail.num <= 15) ||
            (event.detail.num >= 25 && event.detail.num <= 30)),
        {
          detail: {
            num: [{ numeric: [">=", 10, "<=", 15] }, 30],
          },
        }
      );
    });

    test("numeric range or and AND part reduced both losing some range", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          ((event.detail.num >= 10 && event.detail.num <= 20) ||
            (event.detail.num >= 30 && event.detail.num <= 40)) &&
          ((event.detail.num >= 5 && event.detail.num <= 15) ||
            (event.detail.num >= 25 && event.detail.num < 30)),
        {
          detail: {
            num: [{ numeric: [">=", 10, "<=", 15] }],
          },
        }
      );
    });

    test("numeric range multiple distinct segments", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          (event.detail.num > 300 && event.detail.num < 400) ||
          (event.detail.num > 0 && event.detail.num < 200) ||
          (event.detail.num > -100 && event.detail.num < -50),
        {
          detail: {
            num: [
              { numeric: [">", 300, "<", 400] },
              { numeric: [">", 0, "<", 200] },
              { numeric: [">", -100, "<", -50] },
            ],
          },
        }
      );
    });

    test("numeric range multiple distinct segments overlapped", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          (event.detail.num > 300 && event.detail.num < 400) ||
          (event.detail.num > 0 && event.detail.num < 200) ||
          (event.detail.num > -100 && event.detail.num < -50) ||
          event.detail.num > -200,
        {
          detail: {
            num: [{ numeric: [">", -200] }],
          },
        }
      );
    });

    test("numeric range multiple distinct segments merged", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          (event.detail.num > 300 && event.detail.num < 400) ||
          (event.detail.num > 0 && event.detail.num < 200) ||
          (event.detail.num > -100 && event.detail.num < -50) ||
          (event.detail.num > -200 && event.detail.num < 200),
        {
          detail: {
            num: [
              { numeric: [">", -200, "<", 200] },
              { numeric: [">", 300, "<", 400] },
            ],
          },
        }
      );
    });

    test("numeric range or and AND dropped range", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          (event.detail.num > 300 || event.detail.num < 200) &&
          event.detail.num > 400,
        {
          detail: {
            num: [{ numeric: [">", 400] }],
          },
        }
      );
    });

    test("numeric range nil range error upper", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) =>
          event.detail.num >= 100 &&
          event.detail.num < 1000 &&
          event.detail.num < 50,
        "Found zero range numeric range lower 100 inclusive: true, upper 50 inclusive: false"
      );
    });

    test("numeric range nil range OR valid range", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.num === 10 ||
          (event.detail.num >= 100 &&
            event.detail.num < 1000 &&
            event.detail.num < 50),
        {
          detail: {
            num: [10],
          },
        }
      );
    });

    test("numeric range nil range AND invalid range", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) =>
          event.detail.num >= 100 &&
          event.detail.num < 1000 &&
          event.detail.num < 50 &&
          event.detail.num === 10,
        "Impossible logic discovered: Found zero range numeric range lower 100 inclusive: true, upper 50 inclusive: false"
      );
    });

    test("numeric range nil range OR valid aggregate range", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.num === 10 ||
          event.detail.num === 11 ||
          (event.detail.num >= 100 &&
            event.detail.num < 1000 &&
            event.detail.num < 50),
        {
          detail: {
            num: [10, 11],
          },
        }
      );
    });

    test("numeric range nil range error lower", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) =>
          event.detail.num >= 100 &&
          event.detail.num < 1000 &&
          event.detail.num > 1100
      );
    });

    test("numeric range nil range illogical", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) => event.detail.num >= 100 && event.detail.num < 50,
        "Found zero range numeric range lower 100 inclusive: true, upper 50 inclusive: false"
      );
    });

    test("numeric range nil range illogical with override", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.num === 10 ||
          (event.detail.num >= 100 && event.detail.num < 50),
        {
          detail: {
            num: [10],
          },
        }
      );
    });
  });

  describe("aggregate", () => {
    test("test for optional", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          !!event.detail.optional && event.detail.optional === "value",
        {
          detail: {
            optional: ["value"],
          },
        }
      );
    });

    test("test for optional number", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          !!event.detail.optionalNum &&
          event.detail.optionalNum > 10 &&
          event.detail.optionalNum < 100,
        {
          detail: {
            optionalNum: [{ numeric: [">", 10, "<", 100] }],
          },
        }
      );
    });

    test("number and string separate fields", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.num === 10 && event.detail.str === "hello",
        {
          detail: {
            str: ["hello"],
            num: [10],
          },
        }
      );
    });

    test("same field AND string", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) =>
          event.detail.str === "hi" && <any>event.detail.str === "hello",
        "hello"
      );
    });

    test("same field AND string with OR", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.str === "huh" ||
          (event.detail.str === "hi" && <any>event.detail.str === "hello"),
        {
          detail: {
            str: ["huh"],
          },
        }
      );
    });

    test("same field AND string identical", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.str === "hi" && event.detail.str === "hi",
        {
          detail: {
            str: ["hi"],
          },
        }
      );
    });

    test("same field OR string", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.str === "hi" || event.detail.str === "hello",
        {
          detail: {
            str: ["hi", "hello"],
          },
        }
      );
    });

    test("same field OR string and AND another field ", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          (event.detail.str === "hi" || event.detail.str === "hello") &&
          event.detail.num === 100,
        {
          detail: {
            str: ["hi", "hello"],
            num: [100],
          },
        }
      );
    });

    test("same field AND another field ", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.str === "hello" && event.detail.num === 100,
        {
          detail: {
            str: ["hello"],
            num: [100],
          },
        }
      );
    });

    test("same field || another field ", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) =>
          event.detail.str === "hello" || event.detail.num === 100,
        "Event bridge does not support OR logic between multiple fields, found str and num."
      );
    });

    test("lots of AND", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.str === "hi" &&
          event.detail.num === 100 &&
          event.source === "lambda" &&
          event.region === "us-east-1" &&
          event.id === "10",
        {
          detail: {
            str: ["hi"],
            num: [100],
          },
          id: ["10"],
          source: ["lambda"],
          region: ["us-east-1"],
        }
      );
    });

    test("AND prefix", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.str.startsWith("hi") && event.detail.num === 100,
        {
          detail: {
            str: [{ prefix: "hi" }],
            num: [100],
          },
        }
      );
    });

    test("AND not prefix", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) =>
          !event.detail.str.startsWith("hi") && event.detail.str !== "hello",
        "Event Bridge patterns do not support AND logic between NOT prefix and any other logic."
      );
    });

    test("AND not prefix reverse", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) =>
          event.detail.str !== "hello" && !event.detail.str.startsWith("hi"),
        "Event Bridge patterns do not support AND logic between NOT prefix and any other logic."
      );
    });

    test("AND not two prefix", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) =>
          !event.detail.str.startsWith("hello") &&
          !event.detail.str.startsWith("hi"),
        "Event Bridge patterns do not support AND logic between NOT prefix and any other logic."
      );
    });

    test("AND list", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.array.includes("hi") && event.detail.num === 100,
        {
          detail: {
            array: ["hi"],
            num: [100],
          },
        }
      );
    });

    test("AND exists", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          !!event.detail.optional && event.detail.num === 100,
        {
          detail: {
            optional: [{ exists: true }],
            num: [100],
          },
        }
      );
    });

    test("AND not exists", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          !event.detail.optional && event.detail.num === 100,
        {
          detail: {
            optional: [{ exists: false }],
            num: [100],
          },
        }
      );
    });

    test("AND not equals", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.str !== "hi" && event.detail.str !== "hello",
        {
          detail: {
            str: [{ "anything-but": ["hi", "hello"] }],
          },
        }
      );
    });

    test("AND not not equals", () => {
      ebEventPatternTestCase(
        // str === "hi" || str === "hello"
        (event: TestEvent) =>
          !(event.detail.str !== "hi" && event.detail.str !== "hello"),
        {
          detail: {
            str: ["hi", "hello"],
          },
        }
      );
    });

    test("AND not exists and exists impossible", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) => !event.detail.str && <any>event.detail.str,
        "Field cannot both be present and not present."
      );
    });

    test("AND not exists and exists impossible", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.str === "hi" ||
          (!event.detail.str && <any>event.detail.str),
        {
          detail: {
            str: ["hi"],
          },
        }
      );
    });

    test("AND not exists and not equals", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !event.detail.str && event.detail.str !== "x",
        {
          detail: {
            str: [{ exists: false }],
          },
        }
      );
    });

    test("AND not exists and value", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) => !event.detail.str && event.detail.str === "x",
        "Invalid comparison: pattern cannot both be not present as a positive value"
      );
    });

    test("AND not exists and value", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.str === "hello" ||
          (!event.detail.str && event.detail.str === "x"),
        {
          detail: {
            str: ["hello"],
          },
        }
      );
    });

    test("AND not null and not value", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.str !== null && event.detail.str !== "x",
        {
          detail: {
            str: [{ "anything-but": [null, "x"] }],
          },
        }
      );
    });

    test("AND not not exists and not equals", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => !(!event.detail.str && event.detail.str !== "x"),
        {
          detail: {
            str: [{ exists: true }],
          },
        }
      );
    });

    test("AND not exists and not equals", () => {
      ebEventPatternTestCase(
        (event: TestEvent) => event.detail.str !== "x" && !event.detail.str,
        {
          detail: {
            str: [{ exists: false }],
          },
        }
      );
    });

    test("OR not equals", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.str !== "hi" || <any>event.detail.str !== "hello",
        { source: [{ prefix: "" }] }
      );
    });

    test("AND not eq", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          event.detail.str !== "hi" && event.detail.num === 100,
        {
          detail: {
            str: [{ "anything-but": "hi" }],
            num: [100],
          },
        }
      );
    });

    test("OR not exists", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          !event.detail.optional || event.detail.optional === "cheese",
        {
          detail: {
            optional: [{ exists: false }, "cheese"],
          },
        }
      );
    });

    test("OR not exists not eq", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          !event.detail.optional || event.detail.optional !== "cheese",
        {
          detail: {
            optional: [{ exists: false }, { "anything-but": "cheese" }],
          },
        }
      );
    });

    test("OR not exists starts with", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          !event.detail.optional || event.detail.optional.startsWith("cheese"),
        {
          detail: {
            optional: [{ exists: false }, { prefix: "cheese" }],
          },
        }
      );
    });

    test("OR not exists not starts with", () => {
      ebEventPatternTestCase(
        (event: TestEvent) =>
          !event.detail.optional || !event.detail.optional.startsWith("cheese"),
        {
          detail: {
            optional: [
              { exists: false },
              { "anything-but": { prefix: "cheese" } },
            ],
          },
        }
      );
    });
  });

  describe("error edge cases", () => {
    test("comparing non event values", () => {
      ebEventPatternTestCaseError(
        (_event) => "10" === "10",
        "Expected exactly one event reference, got zero."
      );
    });

    test("comparing two event values", () => {
      ebEventPatternTestCaseError(
        (event: TestEvent) => event.id === event.region,
        "Expected exactly one event reference, got two."
      );
    });
  });
});

// https://github.com/functionless/functionless/issues/68
describe.skip("destructure", () => {
  test("destructure parameter", () => {
    ebEventPatternTestCase(({ source }) => source === "lambda", {
      source: ["lambda"],
    });
  });

  test("destructure variable", () => {
    ebEventPatternTestCase(
      (event: TestEvent) => {
        const { source } = event;
        return source === "lambda";
      },
      {
        source: ["lambda"],
      }
    );
  });

  test("destructure multi-layer variable", () => {
    ebEventPatternTestCase(
      (event: TestEvent) => {
        const {
          detail: { str },
        } = event;
        return str === "lambda";
      },
      {
        detail: { str: ["lambda"] },
      }
    );
  });

  test("destructure array doesn't work", () => {
    ebEventPatternTestCaseError((event: TestEvent) => {
      const {
        detail: {
          array: [value],
        },
      } = event;
      return value === "lambda";
    });
  });

  test("destructure parameter array doesn't work", () => {
    ebEventPatternTestCaseError(
      ({
        detail: {
          array: [value],
        },
      }) => value === "lambda"
    );
  });

  test("descture variable rename", () => {
    ebEventPatternTestCase(
      (event: TestEvent) => {
        const { source: src } = event;
        return src === "lambda";
      },
      {
        source: ["lambda"],
      }
    );
  });

  test("destructure parameter rename", () => {
    ebEventPatternTestCase(({ source: src }) => src === "lambda", {
      source: ["lambda"],
    });
  });
});

// TODO: create ticket
describe.skip("list some", () => {
  test("list starts with", () => {
    ebEventPatternTestCase(
      (event: TestEvent) => event.resources.some((r) => r.startsWith("hi")),
      {
        resources: [{ prefix: "hi" }],
      }
    );
  });

  test("list starts with AND errors", () => {
    ebEventPatternTestCaseError((event: TestEvent) =>
      event.resources.some((r) => r.startsWith("hi") && r === "taco")
    );
  });

  test("list starts with OR is fine", () => {
    ebEventPatternTestCase(
      (event: TestEvent) =>
        event.resources.some(
          (r) => r.startsWith("hi") || r.startsWith("taco") || r === "cheddar"
        ),
      {
        resources: [{ prefix: "hi" }, { prefix: "taco" }, "cheddar"],
      }
    );
  });

  test("list some instead of includes", () => {
    ebEventPatternTestCase(
      (event: TestEvent) => event.resources.some((r) => r === "cheddar"),
      {
        resources: ["cheddar"],
      }
    );
  });
});

test("error when using rest parameters", () => {
  ebEventPatternTestCaseError(
    (...event: [TestEvent, ...TestEvent[]]) =>
      event[0].resources.some((r) => r.startsWith("hi") && r === "taco"),
    "Event Bridge does not yet support rest parameters"
  );
});

// type inference tests
() => {
  const app = new App({
    autoSynth: false,
  });
  const stack = new Stack(app, "stack");

  const bus = new EventBus<Event<TestEvent>>(stack, "bus");

  bus.all().pipe(
    new Function(stack, "F", async (event) => {
      // event should be inferred
      const time: string = event.detail.time;
      time;
    })
  );

  bus.all().pipe(
    new StepFunction(stack, "F", async (event) => {
      // event should be inferred
      const time: string = event.detail.time;
      time;
    })
  );
};
