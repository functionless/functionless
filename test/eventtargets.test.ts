import { EventBusRuleInput } from "../src/eventbridge";

import { Function, reflect } from "../src";
import { aws_events } from "aws-cdk-lib";
import { ebEventTargetTestCase, ebEventTargetTestCaseError } from "./util";
import { EventField } from "aws-cdk-lib/aws-events";

interface testEvent
  extends EventBusRuleInput<{
    value: string;
    num: number;
    array: string[];
    "blah-blah": string;
    "blah blah": string;
  }> {}

test("event path", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => event.source),
    aws_events.RuleTargetInput.fromEventPath("$.source")
  );
});

test("event path index access", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => event["source"]),
    aws_events.RuleTargetInput.fromEventPath("$.source")
  );
});

test("event path index access special json path", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => event.detail["blah-blah"]),
    aws_events.RuleTargetInput.fromEventPath("$.detail.blah-blah")
  );
});

test("event path index access spaces json path", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => event.detail["blah blah"]),
    // Note: this doesn't look right, but it was tested with the event bridge sandbox and worked
    aws_events.RuleTargetInput.fromEventPath("$.detail.blah blah")
  );
});

test("string formatting", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => `hello ${event.source}`),
    aws_events.RuleTargetInput.fromText(
      `hello ${aws_events.EventField.fromPath("$.source")}`
    )
  );
});

test("string formatting with constants", () => {
  ebEventTargetTestCase<testEvent>(
    reflect(() => `hello ${"hi?"}`),
    aws_events.RuleTargetInput.fromText(`hello hi?`)
  );
});

test("constant value", () => {
  ebEventTargetTestCase<testEvent>(
    reflect(() => `hello`),
    aws_events.RuleTargetInput.fromText(`hello`)
  );
});

test("string concat", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => `hello ` + event.source),
    aws_events.RuleTargetInput.fromText(
      `hello ${aws_events.EventField.fromPath("$.source")}`
    )
  );
});

test("object with constants", () => {
  ebEventTargetTestCase<testEvent>(
    reflect(() => ({
      value: "hi",
    })),
    aws_events.RuleTargetInput.fromObject({
      value: "hi",
    })
  );
});

test("object with event references", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => ({
      value: event.detail.value,
    })),
    aws_events.RuleTargetInput.fromObject({
      value: aws_events.EventField.fromPath("$.detail.value"),
    })
  );
});

test("object with event template references", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => ({
      value: `hello ${event.detail.value}`,
    })),
    aws_events.RuleTargetInput.fromObject({
      value: `hello ${aws_events.EventField.fromPath("$.detail.value")}`,
    })
  );
});

test("object with event number", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => ({
      value: event.detail.num,
    })),
    aws_events.RuleTargetInput.fromObject({
      value: aws_events.EventField.fromPath("$.detail.num"),
    })
  );
});

test("object with null", () => {
  ebEventTargetTestCase<testEvent>(
    reflect(() => ({
      value: null,
    })),
    aws_events.RuleTargetInput.fromObject({
      value: null,
    })
  );
});

test("object with null", () => {
  ebEventTargetTestCase<testEvent>(
    reflect(() => ({
      value: undefined,
    })),
    aws_events.RuleTargetInput.fromObject({})
  );
});

test("object with event template number references", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => ({
      value: `hello ${event.detail.num}`,
    })),
    aws_events.RuleTargetInput.fromObject({
      value: `hello ${aws_events.EventField.fromPath("$.detail.num")}`,
    })
  );
});

test("object with event object references", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => ({
      value: event.detail,
    })),
    aws_events.RuleTargetInput.fromObject({
      value: aws_events.EventField.fromPath("$.detail"),
    })
  );
});

test("object with deep event object references", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => ({
      value: { value2: event.detail.value },
    })),
    aws_events.RuleTargetInput.fromObject({
      value: { value2: aws_events.EventField.fromPath("$.detail.value") },
    })
  );
});

test("template with object", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => `{ value: ${{ myValue: event.source }} }`),
    aws_events.RuleTargetInput.fromText(
      `{ value: {\"myValue\":\"${aws_events.EventField.fromPath(
        "$.source"
      )}\"} }`
    )
  );
});

test("object with event array references", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => ({
      value: event.detail.array,
    })),
    aws_events.RuleTargetInput.fromObject({
      value: aws_events.EventField.fromPath("$.detail.array"),
    })
  );
});

test("object with event array literal", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => ({
      value: [event.detail.value],
    })),
    aws_events.RuleTargetInput.fromObject({
      value: [aws_events.EventField.fromPath("$.detail.value")],
    })
  );
});

test("object with bare array literal", () => {
  ebEventTargetTestCase<testEvent>(
    reflect((event) => [event.detail.value]),
    aws_events.RuleTargetInput.fromObject([
      aws_events.EventField.fromPath("$.detail.value"),
    ])
  );
});

test("object with bare array literal with null", () => {
  ebEventTargetTestCase<testEvent>(
    reflect(() => [null]),
    aws_events.RuleTargetInput.fromObject([null])
  );
});

test("object with bare array literal with undefined", () => {
  ebEventTargetTestCase<testEvent>(
    reflect(() => [undefined]),
    aws_events.RuleTargetInput.fromObject([])
  );
});

test("object with bare null", () => {
  ebEventTargetTestCase<testEvent>(
    reflect(() => null),
    aws_events.RuleTargetInput.fromObject(null)
  );
});

test("object with bare undefined", () => {
  ebEventTargetTestCase<testEvent>(
    reflect(() => undefined),
    aws_events.RuleTargetInput.fromObject(undefined)
  );
});

type MyString = string;
interface MyTest extends EventBusRuleInput<{ s: MyString }> {}

test("non-string type", () => {
  ebEventTargetTestCase<MyTest>(
    reflect((event) => event.detail.s + event.detail.s),
    aws_events.RuleTargetInput.fromObject(
      `${EventField.fromPath("$.detail.s")}${EventField.fromPath("$.detail.s")}`
    )
  );
});

describe("predefined", () => {
  test("direct event", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((event) => event),
      {
        bind: () => {
          return { inputPathsMap: {}, inputTemplate: "<aws.events.event>" };
        },
      }
    );
  });

  test("direct rule name", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((_event, u) => u.context.ruleName),
      {
        bind: () => {
          return {
            inputPathsMap: {},
            inputTemplate: '"<aws.events.rule-name>"',
          };
        },
      }
    );
  });

  test("direct rule name in template", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((_event, u) => `blah ${u.context.ruleName}`),
      {
        bind: () => {
          return {
            inputPathsMap: {},
            inputTemplate: '"blah <aws.events.rule-name>"',
          };
        },
      }
    );
  });

  test("direct event json name", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((_event, u) => u.context.eventJson),
      {
        bind: () => {
          return {
            inputPathsMap: {},
            inputTemplate: '"<aws.events.event.json>"',
          };
        },
      }
    );
  });

  test("direct event in object", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((event) => ({
        evnt: event,
      })),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: `{"evnt":<aws.events.event>}`,
        }),
      }
    );
  });

  test("direct event in template", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((event) => `original: ${event}`),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: '"original: <aws.events.event>"',
        }),
      }
    );
  });

  test("rule name", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((_, $utils) => ({ value: $utils.context.ruleName })),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: `{"value":<aws.events.rule-name>}`,
        }),
      }
    );
  });

  test("rule arn", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((_, $utils) => ({ value: $utils.context.ruleArn })),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: `{"value":<aws.events.rule-arn>}`,
        }),
      }
    );
  });

  test("event json", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((_, $utils) => ({ value: $utils.context.eventJson })),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: `{"value":<aws.events.event.json>}`,
        }),
      }
    );
  });

  test("time", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((_, $utils) => ({ value: $utils.context.ingestionTime })),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: `{"value":<aws.events.ingestion-time>}`,
        }),
      }
    );
  });

  test("different utils name", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((_, utils) => ({ value: utils.context.ruleName })),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: `{"value":<aws.events.rule-name>}`,
        }),
      }
    );
  });

  test("different utils name at the top", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((_, utils) => utils.context.ruleName),
      {
        bind: () => {
          return {
            inputPathsMap: {},
            inputTemplate: '"<aws.events.rule-name>"',
          };
        },
      }
    );
  });
});

describe("referencing", () => {
  test("dereference", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((event) => {
        const value = event.detail.value;

        return { value: value };
      }),
      aws_events.RuleTargetInput.fromObject({
        value: aws_events.EventField.fromPath("$.detail.value"),
      })
    );
  });

  test("dereference and prop access", () => {
    ebEventTargetTestCase<testEvent>(
      reflect((event) => {
        const value = event.detail;

        return { value: value.value };
      }),
      aws_events.RuleTargetInput.fromObject({
        value: aws_events.EventField.fromPath("$.detail.value"),
      })
    );
  });

  test("constant", () => {
    ebEventTargetTestCase<testEvent>(
      reflect(() => {
        const value = "hi";

        return { value: value };
      }),
      aws_events.RuleTargetInput.fromObject({
        value: "hi",
      })
    );
  });

  // Functionless doesn't support computed properties currently
  test.skip("constant computed prop name", () => {
    ebEventTargetTestCase<testEvent>(
      reflect(() => {
        const value = "hi";

        return { [value]: value };
      }),
      aws_events.RuleTargetInput.fromObject({
        hi: "hi",
      })
    );
  });

  test("constant from object", () => {
    ebEventTargetTestCase<testEvent>(
      reflect(() => {
        const config = { value: "hi" };

        return { value: config.value };
      }),
      aws_events.RuleTargetInput.fromObject({
        value: "hi",
      })
    );
  });

  test("spread with constant object", () => {
    ebEventTargetTestCase<testEvent>(
      reflect(() => {
        const config = { value: "hi" };

        return { ...config };
      }),
      aws_events.RuleTargetInput.fromObject({
        value: "hi",
      })
    );
  });

  test("object element access", () => {
    ebEventTargetTestCase<testEvent>(
      reflect(() => {
        const config = { value: "hi" };

        return { val: config["value"] };
      }),
      aws_events.RuleTargetInput.fromObject({
        val: "hi",
      })
    );
  });

  test("object access", () => {
    ebEventTargetTestCase<testEvent>(
      reflect(() => {
        const config = { value: "hi" } as any;

        return { val: config.value };
      }),
      aws_events.RuleTargetInput.fromObject({
        val: "hi",
      })
    );
  });

  test("constant list", () => {
    ebEventTargetTestCase<testEvent>(
      reflect(() => {
        const config = ["hi"];

        return { values: config };
      }),
      aws_events.RuleTargetInput.fromObject({
        values: ["hi"],
      })
    );
  });

  test("spread with constant list", () => {
    ebEventTargetTestCase<testEvent>(
      reflect(() => {
        const config = ["hi"];

        return { values: [...config, "there"] };
      }),
      aws_events.RuleTargetInput.fromObject({
        values: ["hi", "there"],
      })
    );
  });

  test("array index", () => {
    ebEventTargetTestCase<testEvent>(
      reflect(() => {
        const config = ["hi"];

        return { values: [config[0], "there"] };
      }),
      aws_events.RuleTargetInput.fromObject({
        values: ["hi", "there"],
      })
    );
  });

  test("array index variable index", () => {
    ebEventTargetTestCase<testEvent>(
      reflect(() => {
        const index = 0;
        const config = ["hi"];

        return { values: [config[index], "there"] };
      }),
      aws_events.RuleTargetInput.fromObject({
        values: ["hi", "there"],
      })
    );
  });

  test.skip("constant from outside", () => {
    const value = "hi";

    ebEventTargetTestCase<testEvent>(
      reflect(() => {
        return { value };
      }),
      aws_events.RuleTargetInput.fromObject({
        value: "hi",
      })
    );
  });
});

describe("not allowed", () => {
  test("empty body", () => {
    ebEventTargetTestCaseError<testEvent>(
      reflect(() => {}),
      "No return statement found in event bridge target function."
    );
  });

  // Note: this cannot happen with the type checker, but validating in case someone tries to hack around it
  test("use of deep fields outside of detail", () => {
    ebEventTargetTestCaseError<testEvent>(
      reflect((event) => ({
        event: (<any>event.source).blah,
      })),
      "Event references with depth greater than one must be on the detail property, got source,blah"
    );
  });

  test("service call", () => {
    const func = new Function<string, void>(null as any);
    ebEventTargetTestCaseError<testEvent>(
      reflect(() => func("hello")),
      "Unsupported template expression of kind: CallExpr"
    );
  });

  test("math", () => {
    ebEventTargetTestCaseError<testEvent>(
      reflect((event) => event.detail.num + 1),
      "Addition operator is only supported to concatinate at least one string to another value."
    );
  });

  test("non-constants", () => {
    ebEventTargetTestCaseError<testEvent>(
      reflect((event) => (() => event.detail.num)()),
      "Unsupported template expression of kind: CallExpr"
    );
  });

  test("spread obj ref", () => {
    ebEventTargetTestCaseError<testEvent>(
      reflect((event) => ({ ...event.detail, field: "hello" })),
      "Event Bridge input transforms do not support object spreading non-constant objects."
    );
  });

  test("spread array ref", () => {
    ebEventTargetTestCaseError<testEvent>(
      reflect((event) => [...event.detail.array]),
      "Event Bridge input transforms do not support array spreading non-constant arrays."
    );
  });

  test("object access missing key", () => {
    ebEventTargetTestCaseError<testEvent>(
      reflect(() => {
        const obj = { val: "" } as any;
        return { val: obj["blah"] };
      }),
      "Cannot find property blah in Object with keys: val"
    );
  });
});
