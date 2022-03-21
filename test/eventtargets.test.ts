import { EventBusRuleInput } from "../src/eventbridge";

import { Function, reflect } from "../src";
import { aws_events } from "aws-cdk-lib";
import { ebEventTargetTestCase, ebEventTargetTestCaseError } from "./util";

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

describe.skip("referencing", () => {
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

  test("spread", () => {
    ebEventTargetTestCaseError<testEvent>(
      reflect((event) => ({ ...event.detail, field: "hello" })),
      "Event Bridge input transforms do not support object spreading."
    );
  });
});
