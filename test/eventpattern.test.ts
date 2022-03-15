import { ebEventPatternTestCase, ebEventPatternTestCaseError } from "./util";
import { EventBusEvent } from "../src/eventbridge";

type TestEvent = EventBusEvent<{
  num: number;
  str: string;
  optional?: string;
  "multi-part": string;
  deep: {
    value: string;
  };
  bool: boolean;
  array: string[];
}>;

describe("event pattern", () => {
  describe("equals", () => {
    test("simple", () => {
      ebEventPatternTestCase((event) => event.source === "lambda", {
        source: ["lambda"],
      });
    });

    test("detail", () => {
      ebEventPatternTestCase<TestEvent>(
        (event) => event.detail.str === "something",
        {
          detail: { str: ["something"] },
        }
      );
    });

    test("detail deep", () => {
      ebEventPatternTestCase<TestEvent>(
        (event) => event.detail.deep.value === "something",
        {
          detail: { deep: { value: ["something"] } },
        }
      );
    });

    test("detail index accessor", () => {
      ebEventPatternTestCase<TestEvent>(
        (event) => event.detail["multi-part"] === "something",
        {
          detail: { "multi-part": ["something"] },
        }
      );
    });

    test("numeric", () => {
      ebEventPatternTestCase<TestEvent>((event) => event.detail.num === 5, {
        detail: { num: [5] },
      });
    });

    test("boolean implicit", () => {
      ebEventPatternTestCase<TestEvent>((event) => event.detail.bool, {
        detail: { bool: [true] },
      });
    });

    test("boolean implicit false", () => {
      ebEventPatternTestCase<TestEvent>((event) => !event.detail.bool, {
        detail: { bool: [false] },
      });
    });

    test("boolean explicit", () => {
      ebEventPatternTestCase<TestEvent>(
        (event) => event.detail.bool === false,
        {
          detail: { bool: [false] },
        }
      );
    });

    describe.skip("array", () => {
      test("array", () => {
        ebEventPatternTestCase<TestEvent>(
          (event) => event.detail.array.includes("something"),
          {
            detail: { array: ["something"] },
          }
        );
      });

      test("array explicit equals error", () => {
        ebEventPatternTestCaseError<TestEvent>(
          (event) => event.detail.array === ["a", "b"]
        );
      });

      test("array explicit equals error", () => {
        ebEventPatternTestCaseError<TestEvent>(
          (event) => event.detail.array === ["a", "b"]
        );
      });
    });
  });

  test("prefix", () => {
    ebEventPatternTestCase((event) => event.source.startsWith("l"), {
      source: [{ prefix: "l" }],
    });
  });

  describe.skip("numeric range single", () => {
    test("numeric range single", () => {
      ebEventPatternTestCase<TestEvent>((event) => event.detail.num < 100, {
        detail: { num: [{ number: ["<", 100] }] },
      });
    });

    test("numeric range greater than", () => {
      ebEventPatternTestCase<TestEvent>((event) => event.detail.num > 100, {
        detail: { num: [{ number: [">", 100] }] },
      });
    });

    test("numeric range greater than equals", () => {
      ebEventPatternTestCase<TestEvent>((event) => event.detail.num >= 100, {
        detail: { num: [{ number: [">=", 100] }] },
      });
    });
  });

  describe.skip("not", () => {
    test("string", () => {
      ebEventPatternTestCase<TestEvent>((event) => event.source !== "lambda", {
        source: [{ "anything-but": "lambda" }],
      });
    });

    test("string wrapped", () => {
      ebEventPatternTestCase<TestEvent>(
        (event) => !(event.source === "lambda"),
        {
          source: [{ "anything-but": "lambda" }],
        }
      );
    });

    test("number", () => {
      ebEventPatternTestCase<TestEvent>((event) => event.detail.num !== 100, {
        detail: { num: [{ "anything-but": 100 }] },
      });
    });

    test("array", () => {
      ebEventPatternTestCase<TestEvent>(
        (event) => !event.detail.array.includes("something"),
        {
          detail: { array: [{ "anything-but": "something" }] },
        }
      );
    });

    test("string prefix", () => {
      ebEventPatternTestCase<TestEvent>(
        (event) => !event.detail.str.startsWith("something"),
        {
          detail: { array: [{ "anything-but": { prefix: "something" } }] },
        }
      );
    });
  });

  describe.skip("exists", () => {
    test("does", () => {
      ebEventPatternTestCase((event) => event.detail.optional !== undefined, {
        detail: { optional: [{ exists: true }] },
      });
    });

    test("does not", () => {
      ebEventPatternTestCase((event) => event.detail.optional === undefined, {
        detail: { optional: [{ exists: false }] },
      });
    });
  });

  describe.skip("references", () => {
    const myConstant = "hello";
    test("external constant", () => {
      ebEventPatternTestCase((event) => event.detail.str === myConstant, {
        detail: { optional: [myConstant] },
      });
    });

    test("internal constant", () => {
      ebEventPatternTestCase(
        (event) => {
          const myInternalContant = "hi";
          event.detail.str === myInternalContant;
        },
        {
          detail: { optional: ["hi"] },
        }
      );
    });

    test("formatting", () => {
      ebEventPatternTestCase(
        (event) => {
          const myInternalContant = "hi";
          event.detail.str === `${myInternalContant} there`;
        },
        {
          detail: { optional: ["hi there"] },
        }
      );
    });

    test("internal property", () => {
      ebEventPatternTestCase(
        (event) => {
          const myInternalContant = { value: "hi" };
          event.detail.str === myInternalContant.value;
        },
        {
          detail: { optional: ["hi"] },
        }
      );
    });

    test("constant function call", () => {
      ebEventPatternTestCaseError((event) => {
        const myInternalContant = (() => "hi" + " " + "there")();
        event.detail.str === myInternalContant;
      });
    });

    test("constant function call", () => {
      ebEventPatternTestCaseError((event) => {
        const myMethod = () => "hi" + " " + "there";
        event.detail.str === myMethod();
      });
    });
  });

  describe("simple invalid", () => {
    test("error on raw event in predicate", () => {
      ebEventPatternTestCaseError((event) => event);
    });
  });

  describe.skip("numeric aggregate", () => {
    test("numeric range aggregate", () => {
      ebEventPatternTestCase<TestEvent>(
        (event) => event.detail.num >= 100 && event.detail.num < 1000,
        {
          detail: { num: [{ number: [">=", 100, "<", 1000] }] },
        }
      );
    });

    test("numeric range overlapping", () => {
      ebEventPatternTestCase<TestEvent>(
        (event) =>
          event.detail.num >= 100 &&
          event.detail.num < 1000 &&
          event.detail.num > 50,
        {
          detail: { num: [{ number: [">", 50, "<", 1000] }] },
        }
      );
    });

    test("numeric range overlapping", () => {
      ebEventPatternTestCase<TestEvent>(
        (event) =>
          event.detail.num >= 100 &&
          event.detail.num < 1000 &&
          event.detail.num < 200,
        {
          detail: { num: [{ number: [">=", 100, "<", 200] }] },
        }
      );
    });

    test("numeric range nil range error upper", () => {
      ebEventPatternTestCaseError<TestEvent>(
        (event) =>
          event.detail.num >= 100 &&
          event.detail.num < 1000 &&
          event.detail.num < 50
      );
    });

    test("numeric range nil range error lower", () => {
      ebEventPatternTestCaseError<TestEvent>(
        (event) =>
          event.detail.num >= 100 &&
          event.detail.num < 1000 &&
          event.detail.num > 1100
      );
    });

    test("numeric range nil range illogical", () => {
      ebEventPatternTestCaseError<TestEvent>(
        (event) => event.detail.num >= 100 && event.detail.num < 50
      );
    });
  });

  describe.skip("aggregate", () => {});
});
