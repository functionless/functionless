---
sidebar_position: 99
---

# Limitations

## Events passed to the bus in a step function must literal objects

Events passed to the bus in a step function must be one or more literal objects and may not use the spread (`...`) syntax.

```ts
const event = { source: "lambda", "detail-type": "type", detail: {} };
bus.putEvents(event); // error
bus.putEvents({ ...event }); // error
bus.putEvents(...[event]); // error
bus.putEvents({
  // works
  source: "lambda",
  "detail-type": "type",
  detail: {},
});
```

The limitation is due to Step Function's lack of optional or default value retrieval for fields. Attempting to access a missing field in ASL leads to en error. This can be fixed using Choice/Conditions to check for the existence of a single field, but would take all permutations of all optional fields to support optional field at runtime. Due to this limitation, we currently compute the transformation at compile time using the fields present on the literal object. For more details and process see: https://github.com/functionless/functionless/issues/101.
