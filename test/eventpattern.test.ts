import { ebEventPatternTestCase, ebEventPatternTestCaseError } from "./util";
import { EventBusRuleInput, EventPredicateFunction } from "../src/event-bridge";
import { reflect } from "../src/reflect";

type TestEvent = EventBusRuleInput<{
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
          ),
          "Equivency must compare to a constant value."
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

    test("not prefix", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !event.source.startsWith("l")
        ),
        {
          source: [{ "anything-but": { prefix: "l" } }],
        }
      );
    });

    test("prefix non string", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>((event) =>
          (<any>event.detail.num).startsWith("l")
        ),
        `Starts With operation only supported on strings, found number.`
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
          detail: { num: [{ numeric: ["<", 100] }] },
        }
      );
    });

    test("numeric range greater than", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num > 100
        ),
        {
          detail: { num: [{ numeric: [">", 100] }] },
        }
      );
    });

    test("numeric range greater than equals", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num >= 100
        ),
        {
          detail: { num: [{ numeric: [">=", 100] }] },
        }
      );
    });

    test("numeric range inverted", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => 100 < event.detail.num
        ),
        {
          detail: { num: [{ numeric: [">", 100] }] },
        }
      );
    });

    test("numeric range inverted", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => 100 >= event.detail.num
        ),
        {
          detail: { num: [{ numeric: ["<=", 100] }] },
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

    test("not not prefix", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !!event.source.startsWith("lambda")
        ),
        {
          source: [{ prefix: "lambda" }],
        }
      );
    });

    test("negate string equals", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !(event.source === "lambda")
        ),
        {
          source: [{ "anything-but": "lambda" }],
        }
      );
    });

    test("negate not string equals", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !(event.source !== "lambda")
        ),
        {
          source: ["lambda"],
        }
      );
    });

    test("not bool true", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.bool !== true
        ),
        {
          detail: { bool: [false] },
        }
      );
    });

    test("negate not bool true", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !(event.detail.bool !== true)
        ),
        {
          detail: { bool: [true] },
        }
      );
    });

    test("negate bool true", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !(event.detail.bool === true)
        ),
        {
          detail: { bool: [false] },
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

    test("negate multiple fields", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !(event.detail.str === "hello" && event.id === "there")
        ),
        "Can only negate simple statements like equals, doesn't equals, and prefix."
      );
    });

    test("negate multiple", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !(event.detail.str || !event.detail.str)
        ),
        "Impossible logic discovered."
      );
    });

    test("negate negate multiple", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !!(event.detail.str || !event.detail.str)
        ),
        { source: [{ prefix: "" }] }
      );
    });

    test("negate intrafield valid aggregate", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            !(event.detail.str.startsWith("hello") || event.detail.str === "hi")
        )
      ),
        "Can only negate simple statments like boolean and equals.";
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
    test("external constant", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str === myConstant
        ),
        {
          detail: { str: [myConstant] },
        }
      );
    });

    const constantObj = { value: "hello2" };

    test("external constant", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str === constantObj.value
        ),
        {
          detail: { str: [constantObj.value] },
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
        }),
        "Equivency must compare to a constant value."
      );
    });

    test("constant function call", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>((event) => {
          const myMethod = () => "hi" + " " + "there";
          return event.detail.str === myMethod();
        }),
        "Equivency must compare to a constant value."
      );
    });
  });

  describe("simple invalid", () => {
    test("error on raw event in predicate", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>((event) => !!event),
        "Identifier is unsupported"
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
          detail: { num: [{ numeric: [">=", 100, "<", 1000] }] },
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
          detail: { num: [{ numeric: [">=", 100, "<", 1000] }] },
        }
      );
    });

    test("numeric range negate", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !(event.detail.num >= 100 && event.detail.num < 1000)
        ),
        {
          detail: { num: [{ numeric: [">=", 1000, "<", 100] }] },
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
          detail: { num: [{ numeric: [">=", 100, "<", 200] }] },
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
            num: [{ numeric: [">=", 100, "<", 1000] }],
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
          detail: { num: [{ numeric: [">", 300] }, { numeric: ["<", 200] }] },
        }
      );
    });

    test("numeric range or exclusive negate", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !(event.detail.num > 300 || event.detail.num < 200)
        ),
        {
          detail: { num: [{ numeric: [">=", 200, "<=", 300] }] },
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
          source: [{ prefix: "" }],
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
            num: [{ numeric: [">", 300, "<", 350] }, { numeric: ["<", 200] }],
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.num > 300 || event.detail.num < 200) &&
            (event.detail.num > 0 || event.detail.num < 500)
        ),
        {
          detail: {
            num: [{ numeric: [">", 300] }, { numeric: ["<", 200] }],
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
            num: [{ numeric: [">", 300] }, { numeric: ["<", 200] }],
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
            num: [{ numeric: [">", 300] }, { numeric: ["<", 100] }],
          },
        }
      );
    });

    test("numeric range or and AND part reduced both ranges", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            ((event.detail.num >= 10 && event.detail.num <= 20) ||
              (event.detail.num >= 30 && event.detail.num <= 40)) &&
            ((event.detail.num >= 5 && event.detail.num <= 15) ||
              (event.detail.num >= 25 && event.detail.num <= 30))
        ),
        {
          detail: {
            num: [{ numeric: [">=", 10, "<=", 15] }, 30],
          },
        }
      );
    });

    test("numeric range or and AND part reduced both losing some range", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            ((event.detail.num >= 10 && event.detail.num <= 20) ||
              (event.detail.num >= 30 && event.detail.num <= 40)) &&
            ((event.detail.num >= 5 && event.detail.num <= 15) ||
              (event.detail.num >= 25 && event.detail.num < 30))
        ),
        {
          detail: {
            num: [{ numeric: [">=", 10, "<=", 15] }],
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.num > 300 && event.detail.num < 400) ||
            (event.detail.num > 0 && event.detail.num < 200) ||
            (event.detail.num > -100 && event.detail.num < -50) ||
            event.detail.num > -200
        ),
        {
          detail: {
            num: [{ numeric: [">", -200] }],
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
              { numeric: [">", -200, "<", 200] },
              { numeric: [">", 300, "<", 400] },
            ],
          },
        }
      );
    });

    test("numeric range or and AND dropped range", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.num > 300 || event.detail.num < 200) &&
            event.detail.num > 400
        ),
        {
          detail: {
            num: [{ numeric: [">", 400] }],
          },
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
        ),
        "Found zero range numeric range lower 100 inclusive: true, upper 50 inclusive: false"
      );
    });

    test("numeric range nil range OR valid range", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.num === 10 ||
            (event.detail.num >= 100 &&
              event.detail.num < 1000 &&
              event.detail.num < 50)
        ),
        {
          detail: {
            num: [10],
          },
        }
      );
    });

    test("numeric range nil range AND invalid range", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.num >= 100 &&
            event.detail.num < 1000 &&
            event.detail.num < 50 &&
            event.detail.num === 10
        ),
        "Impossible logic discovered: Found zero range numeric range lower 100 inclusive: true, upper 50 inclusive: false"
      );
    });

    test("numeric range nil range OR valid aggregate range", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.num === 10 ||
            event.detail.num === 11 ||
            (event.detail.num >= 100 &&
              event.detail.num < 1000 &&
              event.detail.num < 50)
        ),
        {
          detail: {
            num: [10, 11],
          },
        }
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
        ),
        "Found zero range numeric range lower 100 inclusive: true, upper 50 inclusive: false"
      );
    });

    test("numeric range nil range illogical with override", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.num === 10 ||
            (event.detail.num >= 100 && event.detail.num < 50)
        ),
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            !!event.detail.optional && event.detail.optional === "value"
        ),
        {
          detail: {
            optional: ["value"],
          },
        }
      );
    });

    test("test for optional number", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            !!event.detail.optionalNum &&
            event.detail.optionalNum > 10 &&
            event.detail.optionalNum < 100
        ),
        {
          detail: {
            optionalNum: [{ numeric: [">", 10, "<", 100] }],
          },
        }
      );
    });

    test("number and string separate fields", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.num === 10 && event.detail.str === "hello"
        ),
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.str === "hi" && <any>event.detail.str === "hello"
        ),
        "hello"
      );
    });

    test("same field AND string with OR", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.str === "huh" ||
            (event.detail.str === "hi" && <any>event.detail.str === "hello")
        ),
        {
          detail: {
            str: ["huh"],
          },
        }
      );
    });

    test("same field AND string identical", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str === "hi" && event.detail.str === "hi"
        ),
        {
          detail: {
            str: ["hi"],
          },
        }
      );
    });

    test("same field OR string", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str === "hi" || event.detail.str === "hello"
        ),
        {
          detail: {
            str: ["hi", "hello"],
          },
        }
      );
    });

    test("same field OR string and AND another field ", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            (event.detail.str === "hi" || event.detail.str === "hello") &&
            event.detail.num === 100
        ),
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str === "hello" && event.detail.num === 100
        ),
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str === "hello" || event.detail.num === 100
        ),
        `Event bridge does not support OR logic between multiple fields, found str and num.`
      );
    });

    test("lots of AND", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.str === "hi" &&
            event.detail.num === 100 &&
            event.source === "lambda" &&
            event.region === "us-east-1" &&
            event.id === "10"
        ),
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.str.startsWith("hi") && event.detail.num === 100
        ),
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            !event.detail.str.startsWith("hi") && event.detail.str !== "hello"
        ),
        "Event Bridge patterns do not support AND logic between NOT prefix and any other logic."
      );
    });

    test("AND not prefix reverse", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.str !== "hello" && !event.detail.str.startsWith("hi")
        ),
        "Event Bridge patterns do not support AND logic between NOT prefix and any other logic."
      );
    });

    test("AND not two prefix", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            !event.detail.str.startsWith("hello") &&
            !event.detail.str.startsWith("hi")
        ),
        "Event Bridge patterns do not support AND logic between NOT prefix and any other logic."
      );
    });

    test("AND list", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.array.includes("hi") && event.detail.num === 100
        ),
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !!event.detail.optional && event.detail.num === 100
        ),
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !event.detail.optional && event.detail.num === 100
        ),
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str !== "hi" && event.detail.str !== "hello"
        ),
        {
          detail: {
            str: [{ "anything-but": ["hi", "hello"] }],
          },
        }
      );
    });

    test("AND not not equals", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          // str === "hi" || str === "hello"
          (event) =>
            !(event.detail.str !== "hi" && event.detail.str !== "hello")
        ),
        {
          detail: {
            str: ["hi", "hello"],
          },
        }
      );
    });

    test("AND not exists and exists impossible", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !event.detail.str && <any>event.detail.str
        ),
        "Field cannot both be present and not present."
      );
    });

    test("AND not exists and exists impossible", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.str === "hi" ||
            (!event.detail.str && <any>event.detail.str)
        ),
        {
          detail: {
            str: ["hi"],
          },
        }
      );
    });

    test("AND not exists and not equals", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !event.detail.str && event.detail.str !== "x"
        ),
        {
          detail: {
            str: [{ exists: false }],
          },
        }
      );
    });

    test("AND not exists and value", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !event.detail.str && event.detail.str === "x"
        ),
        "Invalid comparison: pattern cannot both be not present as a positive value"
      );
    });

    test("AND not exists and value", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.str === "hello" ||
            (!event.detail.str && event.detail.str === "x")
        ),
        {
          detail: {
            str: ["hello"],
          },
        }
      );
    });

    test("AND not null and not value", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str !== null && event.detail.str !== "x"
        ),
        {
          detail: {
            str: [{ "anything-but": [null, "x"] }],
          },
        }
      );
    });

    test("AND not not exists and not equals", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => !(!event.detail.str && event.detail.str !== "x")
        ),
        {
          detail: {
            str: [{ exists: true }],
          },
        }
      );
    });

    test("AND not exists and not equals", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str !== "x" && !event.detail.str
        ),
        {
          detail: {
            str: [{ exists: false }],
          },
        }
      );
    });

    test("OR not equals", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            event.detail.str !== "hi" || <any>event.detail.str !== "hello"
        ),
        { source: [{ prefix: "" }] }
      );
    });

    test("AND not eq", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.detail.str !== "hi" && event.detail.num === 100
        ),
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
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            !event.detail.optional || event.detail.optional === "cheese"
        ),
        {
          detail: {
            optional: [{ exists: false }, "cheese"],
          },
        }
      );
    });

    test("OR not exists not eq", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            !event.detail.optional || event.detail.optional !== "cheese"
        ),
        {
          detail: {
            optional: [{ exists: false }, { "anything-but": "cheese" }],
          },
        }
      );
    });

    test("OR not exists starts with", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            !event.detail.optional || event.detail.optional.startsWith("cheese")
        ),
        {
          detail: {
            optional: [{ exists: false }, { prefix: "cheese" }],
          },
        }
      );
    });

    test("OR not exists not starts with", () => {
      ebEventPatternTestCase(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) =>
            !event.detail.optional ||
            !event.detail.optional.startsWith("cheese")
        ),
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
        reflect<EventPredicateFunction<TestEvent>>((_event) => "10" === "10"),
        "Expected exactly one event reference, got zero."
      );
    });

    test("comparing two event values", () => {
      ebEventPatternTestCaseError(
        reflect<EventPredicateFunction<TestEvent>>(
          (event) => event.id === event.region
        ),
        "Expected exactly one event reference, got two."
      );
    });
  });
});

// https://github.com/sam-goodwin/functionless/issues/68
describe.skip("destructure", () => {
  test("destructure parameter", () => {
    ebEventPatternTestCase(
      reflect<EventPredicateFunction<TestEvent>>(
        ({ source }) => source === "lambda"
      ),
      {
        source: ["lambda"],
      }
    );
  });

  test("destructure variable", () => {
    ebEventPatternTestCase(
      reflect<EventPredicateFunction<TestEvent>>((event) => {
        const { source } = event;
        return source === "lambda";
      }),
      {
        source: ["lambda"],
      }
    );
  });

  test("destructure multi-layer variable", () => {
    ebEventPatternTestCase(
      reflect<EventPredicateFunction<TestEvent>>((event) => {
        const {
          detail: { str },
        } = event;
        return str === "lambda";
      }),
      {
        detail: { str: ["lambda"] },
      }
    );
  });

  test("destructure array doesn't work", () => {
    ebEventPatternTestCaseError(
      reflect<EventPredicateFunction<TestEvent>>((event) => {
        const {
          detail: {
            array: [value],
          },
        } = event;
        return value === "lambda";
      })
    );
  });

  test("destructure parameter array doesn't work", () => {
    ebEventPatternTestCaseError(
      reflect<EventPredicateFunction<TestEvent>>(
        ({
          detail: {
            array: [value],
          },
        }) => value === "lambda"
      )
    );
  });

  test("descture variable rename", () => {
    ebEventPatternTestCase(
      reflect<EventPredicateFunction<TestEvent>>((event) => {
        const { source: src } = event;
        return src === "lambda";
      }),
      {
        source: ["lambda"],
      }
    );
  });

  test("destructure parameter rename", () => {
    ebEventPatternTestCase(
      reflect<EventPredicateFunction<TestEvent>>(
        ({ source: src }) => src === "lambda"
      ),
      {
        source: ["lambda"],
      }
    );
  });
});

// TODO: create ticket
describe.skip("list some", () => {
  test("list starts with", () => {
    ebEventPatternTestCase(
      reflect<EventPredicateFunction<TestEvent>>((event) =>
        event.resources.some((r) => r.startsWith("hi"))
      ),
      {
        resources: [{ prefix: "hi" }],
      }
    );
  });

  test("list starts with AND errors", () => {
    ebEventPatternTestCaseError(
      reflect<EventPredicateFunction<TestEvent>>((event) =>
        event.resources.some((r) => r.startsWith("hi") && r === "taco")
      )
    );
  });

  test("list starts with OR is fine", () => {
    ebEventPatternTestCase(
      reflect<EventPredicateFunction<TestEvent>>((event) =>
        event.resources.some(
          (r) => r.startsWith("hi") || r.startsWith("taco") || r === "cheddar"
        )
      ),
      {
        resources: [{ prefix: "hi" }, { prefix: "taco" }, "cheddar"],
      }
    );
  });

  test("list some instead of includes", () => {
    ebEventPatternTestCase(
      reflect<EventPredicateFunction<TestEvent>>((event) =>
        event.resources.some((r) => r === "cheddar")
      ),
      {
        resources: ["cheddar"],
      }
    );
  });
});
