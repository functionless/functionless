import { ebEventPatternTestCase, ebEventPatternTestCaseError } from "./util";
import { EventBusEvent, EventPredicateFunction } from "../src/eventbridge";
import { reflect } from "../src";

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
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.source === "lambda"
        ),
        {
          source: ["lambda"],
        }
      );
    });

    test("detail", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str === "something"
        ),
        {
          detail: { str: ["something"] },
        }
      );
    });

    test("detail deep", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.deep.value === "something"
        ),
        {
          detail: { deep: { value: ["something"] } },
        }
      );
    });

    test("detail index accessor", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail["multi-part"] === "something"
        ),
        {
          detail: { "multi-part": ["something"] },
        }
      );
    });

    test("numeric", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num === 50
        ),
        {
          detail: { num: [5] },
        }
      );
    });

    test("boolean implicit", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.bool
        ),
        {
          detail: { bool: [true] },
        }
      );
    });

    test("boolean implicit false", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !event.detail.bool
        ),
        {
          detail: { bool: [false] },
        }
      );
    });

    test("boolean explicit", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.bool === false
        ),
        {
          detail: { bool: [false] },
        }
      );
    });

    describe.skip("array", () => {
      test("array", () => {
        ebEventPatternTestCase(
          reflect<EventPredicateFunction<TestEvent>>((event) =>
            event.detail.array.includes("something")
          ),
          {
            detail: { array: ["something"] },
          }
        );
      });

      test("array explicit equals error", () => {
        ebEventPatternTestCaseError(
          reflect<EventPredicateFunction<TestEvent>>(
            (event) => event.detail.array === ["a", "b"]
          )
        );
      });

      test("array explicit equals error", () => {
        ebEventPatternTestCaseError(
          reflect<EventPredicateFunction<TestEvent>>(
            (event) => event.detail.array === ["a", "b"]
          )
        );
      });
    });
  });

  test("prefix", () => {
    ebEventPatternTestCase(
      reflect<EventPredicateFunction<TestEvent>>((event) =>
        event.source.startsWith("l")
      ),
      {
        source: [{ prefix: "l" }],
      }
    );
  });

  describe.skip("numeric range single", () => {
    test("numeric range single", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num < 100
        ),
        {
          detail: { num: [{ number: ["<", 100] }] },
        }
      );
    });

    test("numeric range greater than", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num > 100
        ),
        {
          detail: { num: [{ number: [">", 100] }] },
        }
      );
    });

    test("numeric range greater than equals", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num >= 100
        ),
        {
          detail: { num: [{ number: [">=", 100] }] },
        }
      );
    });
  });

  describe.skip("not", () => {
    test("string", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.source !== "lambda"
        ),
        {
          source: [{ "anything-but": "lambda" }],
        }
      );
    });

    test("string wrapped", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !(event.source === "lambda")
        ),
        {
          source: [{ "anything-but": "lambda" }],
        }
      );
    });

    test("number", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num !== 100
        ),
        {
          detail: { num: [{ "anything-but": 100 }] },
        }
      );
    });

    test("array", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !event.detail.array.includes("something")
        ),
        {
          detail: { array: [{ "anything-but": "something" }] },
        }
      );
    });

    test("string prefix", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !event.detail.str.startsWith("something")
        ),
        {
          detail: { array: [{ "anything-but": { prefix: "something" } }] },
        }
      );
    });
  });

  describe.skip("exists", () => {
    test("does", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.optional !== undefined
        ),
        {
          detail: { optional: [{ exists: true }] },
        }
      );
    });

    test("does not", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.optional === undefined
        ),
        {
          detail: { optional: [{ exists: false }] },
        }
      );
    });
  });

  describe.skip("references", () => {
    const myConstant = "hello";
    test("external constant", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str === myConstant
        ),
        {
          detail: { optional: [myConstant] },
        }
      );
    });

    test("internal constant", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>((event) => {
          const myInternalContant = "hi";
          event.detail.str === myInternalContant;
        }),
        {
          detail: { optional: ["hi"] },
        }
      );
    });

    test("formatting", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>((event) => {
          const myInternalContant = "hi";
          event.detail.str === `${myInternalContant} there`;
        }),
        {
          detail: { optional: ["hi there"] },
        }
      );
    });

    test("internal property", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>((event) => {
          const myInternalContant = { value: "hi" };
          event.detail.str === myInternalContant.value;
        }),
        {
          detail: { optional: ["hi"] },
        }
      );
    });

    test("constant function call", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>((event) => {
          const myInternalContant = (() => "hi" + " " + "there")();
          event.detail.str === myInternalContant;
        })
      );
    });

    test("constant function call", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>((event) => {
          const myMethod = () => "hi" + " " + "there";
          event.detail.str === myMethod();
        })
      );
    });
  });

  describe("simple invalid", () => {
    test("error on raw event in predicate", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>((event) => event)
      );
    });
  });

  describe.skip("numeric aggregate", () => {
    test("numeric range aggregate", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num >= 100 && event.detail.num < 1000
        ),
        {
          detail: { num: [{ number: [">=", 100, "<", 1000] }] },
        }
      );
    });

    test("numeric range overlapping", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.num >= 100 &&
            event.detail.num < 1000 &&
            event.detail.num > 50
        ),
        {
          detail: { num: [{ number: [">", 50, "<", 1000] }] },
        }
      );
    });

    test("numeric range overlapping", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.num >= 100 &&
            event.detail.num < 1000 &&
            event.detail.num < 200
        ),
        {
          detail: { num: [{ number: [">=", 100, "<", 200] }] },
        }
      );
    });

    test("numeric range nil range error upper", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.num >= 100 &&
            event.detail.num < 1000 &&
            event.detail.num < 50
        )
      );
    });

    test("numeric range nil range error lower", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.num >= 100 &&
            event.detail.num < 1000 &&
            event.detail.num > 1100
        )
      );
    });

    test("numeric range nil range illogical", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num >= 100 && event.detail.num < 50
        )
      );
    });
  });

  describe.skip("aggregate", () => {});
});
