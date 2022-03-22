import { ebEventPatternTestCase, ebEventPatternTestCaseError } from "./util";
import { EventBusRuleInput, EventPredicateFunction } from "../src/eventbridge";
import { reflect } from "../src";

type TestEvent = EventBusRuleInput<{
  num: number;
  str: string;
  optional?: string;
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
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.source === "lambda"
        ),
        {
          source: ["lambda"],
        }
      );
    });

    test("no event parameter", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(() => true),
        {
          source: [{ prefix: "" }],
        }
      );
    });

    test("index access", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event["source"] === "lambda"
        ),
        {
          source: ["lambda"],
        }
      );
    });

    test("double equals", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.source == "lambda"
        ),
        {
          source: ["lambda"],
        }
      );
    });

    test("is null", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.source === null
        ),
        {
          source: [null],
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
          detail: { num: [50] },
        }
      );
    });

    test("negative number", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num === -50
        ),
        {
          detail: { num: [-50] },
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

    describe("array", () => {
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

      test("num array", () => {
        ebEventPatternTestCase(
          reflect<EventPredicateFunction<TestEvent>>((event) =>
            event.detail.numArray.includes(1)
          ),
          {
            detail: { numArray: [1] },
          }
        );
      });

      test("num array", () => {
        ebEventPatternTestCase(
          reflect<EventPredicateFunction<TestEvent>>((event) =>
            event.detail.numArray.includes(-1)
          ),
          {
            detail: { numArray: [-1] },
          }
        );
      });

      test("bool array", () => {
        ebEventPatternTestCase(
          reflect<EventPredicateFunction<TestEvent>>((event) =>
            event.detail.boolArray.includes(true)
          ),
          {
            detail: { boolArray: [true] },
          }
        );
      });

      test("array not includes", () => {
        ebEventPatternTestCase(
          reflect<EventPredicateFunction<TestEvent>>(
            (event) => !event.detail.array.includes("something")
          ),
          {
            detail: { array: [{ "anything-but": "something" }] },
          }
        );
      });

      test("num array not includes", () => {
        ebEventPatternTestCase(
          reflect<EventPredicateFunction<TestEvent>>(
            (event) => !event.detail.numArray.includes(1)
          ),
          {
            detail: { numArray: [{ "anything-but": 1 }] },
          }
        );
      });

      test("bool array not includes", () => {
        ebEventPatternTestCase(
          reflect<EventPredicateFunction<TestEvent>>(
            (event) => !event.detail.boolArray.includes(true)
          ),
          {
            detail: { boolArray: [false] },
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
    });
  });

  describe("prefix", () => {
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

    test("prefix", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !event.source.startsWith("l")
        ),
        {
          source: [{ "anything-but": { prefix: "l" } }],
        }
      );
    });
  });

  describe("numeric range single", () => {
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

    test("numeric range inverted", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => 100 < event.detail.num
        ),
        {
          detail: { num: [{ number: [">", 100] }] },
        }
      );
    });

    test("numeric range inverted", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => 100 >= event.detail.num
        ),
        {
          detail: { num: [{ number: ["<=", 100] }] },
        }
      );
    });
  });

  describe("not", () => {
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
          detail: { str: [{ "anything-but": { prefix: "something" } }] },
        }
      );
    });
  });

  describe("exists", () => {
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

    test("does in", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => "optional" in event.detail
        ),
        {
          detail: { optional: [{ exists: true }] },
        }
      );
    });

    test("does exist lone value", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !!event.detail.optional
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

    test("does not in", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !("optional" in event.detail)
        ),
        {
          detail: { optional: [{ exists: false }] },
        }
      );
    });

    test("exists at event level", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => "source" in event
        ),
        {
          source: [{ exists: true }],
        }
      );
    });
  });

  describe("references", () => {
    const myConstant = "hello";
    test.skip("external constant", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str === myConstant
        ),
        {
          detail: { str: [myConstant] },
        }
      );
    });

    test("internal constant", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>((event) => {
          const myInternalContant = "hi";
          return event.detail.str === myInternalContant;
        }),
        {
          detail: { str: ["hi"] },
        }
      );
    });

    test("formatting", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>((event) => {
          const myInternalContant = "hi";
          return event.detail.str === `${myInternalContant} there`;
        }),
        {
          detail: { str: ["hi there"] },
        }
      );
    });

    test("internal property", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>((event) => {
          const myInternalContant = { value: "hi" };
          return event.detail.str === myInternalContant.value;
        }),
        {
          detail: { str: ["hi"] },
        }
      );
    });

    test("constant function call", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>((event) => {
          const myInternalContant = (() => "hi" + " " + "there")();
          return event.detail.str === myInternalContant;
        })
      );
    });

    test("constant function call", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>((event) => {
          const myMethod = () => "hi" + " " + "there";
          return event.detail.str === myMethod();
        })
      );
    });
  });

  describe("simple invalid", () => {
    test("error on raw event in predicate", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>((event) => !!event)
      );
    });
  });

  describe("numeric aggregate", () => {
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
          detail: { num: [{ number: [">=", 100, "<", 1000] }] },
        }
      );
    });

    test("numeric range negate", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !(event.detail.num >= 100 && event.detail.num < 1000)
        ),
        {
          detail: { num: [{ number: [">=", 1000, "<", 100] }] },
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

    test("numeric range aggregate with other fields", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.num >= 100 &&
            event.detail.num < 1000 &&
            event.detail.str === "something"
        ),
        {
          detail: {
            num: [{ number: [">=", 100, "<", 1000] }],
            str: ["something"],
          },
        }
      );
    });

    test("numeric range or exclusive", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num > 300 || event.detail.num < 200
        ),
        {
          detail: { num: [{ number: [">", 300] }, { number: ["<", 200] }] },
        }
      );
    });

    test("numeric range or exclusive negate", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !(event.detail.num > 300 || event.detail.num < 200)
        ),
        {
          detail: { num: [{ number: [">=", 200, "<=", 300] }] },
        }
      );
    });

    // the ranges represent infinity, so the clause is removed
    test("numeric range or aggregate empty", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num < 300 || event.detail.num > 200
        ),
        {
          detail: {},
        }
      );
    });

    test("numeric range or aggregate", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.num > 300 && event.detail.num < 350) ||
            event.detail.num < 200
        ),
        {
          detail: {
            num: [{ number: [">", 300, "<", 350] }, { number: ["<", 200] }],
          },
        }
      );
    });

    test("numeric range or and AND", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.num > 300 || event.detail.num < 200) &&
            event.detail.num > 0
        ),
        {
          detail: {
            num: [{ number: [">", 300] }, { number: [">", 0, "<", 200] }],
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.num > 300 || event.detail.num < 200) &&
            (event.detail.num > 0 || event.detail.num < 500)
        ),
        {
          detail: {
            num: [{ number: [">", 300] }, { number: ["<", 200] }],
          },
        }
      );
    });

    test("numeric range or and AND part reduced inverted", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.num > 0 || event.detail.num < 500) &&
            (event.detail.num > 300 || event.detail.num < 200)
        ),
        {
          detail: {
            num: [{ number: [">", 300] }, { number: ["<", 200] }],
          },
        }
      );
    });

    test("numeric range or and AND part reduced both valid", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.num > 300 || event.detail.num < 200) &&
            (event.detail.num > 250 || event.detail.num < 100)
        ),
        {
          detail: {
            num: [{ number: [">", 300] }, { number: ["<", 100] }],
          },
        }
      );
    });

    test("numeric range multiple distinct segments", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.num > 300 && event.detail.num < 400) ||
            (event.detail.num > 0 && event.detail.num < 200) ||
            (event.detail.num > -100 && event.detail.num < -50)
        ),
        {
          detail: {
            num: [
              { number: [">", 300, "<", 400] },
              { number: [">", 0, "<", 200] },
              { number: [">", -100, "<", -50] },
            ],
          },
        }
      );
    });

    test("numeric range multiple distinct segments overlapped", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.num > 300 && event.detail.num < 400) ||
            (event.detail.num > 0 && event.detail.num < 200) ||
            (event.detail.num > -100 && event.detail.num < -50) ||
            event.detail.num > -200
        ),
        {
          detail: {
            num: [{ number: [">", -200] }],
          },
        }
      );
    });

    test("numeric range multiple distinct segments merged", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.num > 300 && event.detail.num < 400) ||
            (event.detail.num > 0 && event.detail.num < 200) ||
            (event.detail.num > -100 && event.detail.num < -50) ||
            (event.detail.num > -200 && event.detail.num < 200)
        ),
        {
          detail: {
            num: [
              { number: [">", -200, "<", 200] },
              { number: [">", 300, "<", 400] },
            ],
          },
        }
      );
    });

    // Note: another option would be to just drop the invalid range.
    test("numeric range or and AND error", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.num > 300 || event.detail.num < 200) &&
            event.detail.num > 400
        )
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
