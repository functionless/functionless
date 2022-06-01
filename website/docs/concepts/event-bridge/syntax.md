---
sidebar_position: 99
---

# Syntax

## Event Patterns

Event patterns are all predicates that filter on the incoming event. The pattern is modeled as a predicate on the bus, resulting in a rule that follows the logic in the predicate.

https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html

```ts
.when("rule", event => event.detail.value === "something")
```

### Equals

```ts
.when("rule", event => event.source === "lambda")
```

```json
{
  "source": ["lambda"]
}
```

### Not Equals

```ts
.when("rule", event => event.source !== "lambda")
```

```json
{
  "source": [{ "anything-but": "lambda" }]
}
```

### Starts With

```ts
.when("rule", event => event.source.startsWith("lambda"))
```

```json
{
  "source": [{ "prefix": "lambda" }]
}
```

### Not Starts With

```ts
.when("rule", event => !event.source.startsWith("lambda"))
```

```json
{
  "source": [{ "anything-but": { "prefix": "lambda" } }]
}
```

> Limit: Anything-but Prefix cannot work with any other logic on the same field.

### List Includes

```ts
.when("rule", event => event.resources.includes("some arn"))
```

```json
{
  "resources": ["some arn"]
}
```

> Limit: Event Bridge patterns only support includes logic for lists, exact match and order based logic is not supported.

### Numbers

```ts
.when("rule", event => event.detail.age > 30 && event.detail.age <= 60)
```

```json
{
  "detail": {
    "age": [{ "numeric": [">", 30, ",<=", 60] }]
  }
}
```

Non-converging ranges

```ts
.when("rule", event => event.detail.age < 30 || event.detail.age >= 60)
```

```json
{
  "detail": {
    "age": [{ "numeric": [">", 30] }, { "numeric": [">=", 60] }]
  }
}
```

Inversion

```ts
.when("rule", event => !(event.detail.age < 30 && event.detail.age >= 60))
```

```json
{
  "detail": {
    "age": [{ "numeric": [">=", 30, "<", 60] }]
  }
}
```

Reduction

```ts
.when("rule", event => (event.detail.age < 30 || event.detail.age >= 60) &&
               (event.detail.age < 20 || event.detail.age >= 50) &&
               event.detail.age > 0)
```

```json
{
  "detail": {
    "age": [{ "numeric": [">", 0, "<", 20] }, { "numeric": [">=", 60] }]
  }
}
```

### Or Logic

> Limit: Event Bridge patterns do not support OR logic between fields. The logic `event.source === "lambda" || event['detail-type'] === "LambdaLike"` is impossible within the same rule.

```ts
.when("rule", event => event.source === "lambda" || event.source === "dynamo")
```

```json
{
  "source": ["lambda", "dynamo"]
}
```

### And Logic

> Limit: Except for the case of numeric ranges and a few others Event Bridge does not support AND logic within the same field. The logic `event.resources.includes("resource1") && event.resources.includes("resource2")` is impossible.

```ts
.when("rule", event => event.source === "lambda" && event.id.startsWith("idPrefix"))
```

```json
{
  "source": ["lambda"],
  "id": [{ "prefix": "isPrefix" }]
}
```

### Presence

Exists

```ts
.when("rule", event => event.detail.optional !== undefined)
.when("rule", event => !!event.detail.optional)
```

```json
{
  "detail": {
    "optional": { "exists": true }
  }
}
```

Does not Exist

```ts
.when("rule", event => event.detail.optional === undefined)
.when("rule", event => !event.detail.optional)
```

```json
{
  "detail": {
    "optional": { "exists": false }
  }
}
```

Simplification

```ts
.when("rule", event => event.detail.optional && event.detail.optional === "value")
```

```json
{
  "detail": {
    "optional": ["value"]
  }
}
```

## Event Transforms

Event input transformers are pure functions that transform the input json into a json object or string sent to the target. The transformer is modeled as a map function.

https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-transform-target-input.html

> Limit: Event Bridge does not support input transformation when sending data between buses.

## Constant

```ts
.map("rule", () => "got one!")
```

```json
{
  "input": "got one!"
}
```

## String field

```ts
.map("rule", event => event.source)
```

Simple inputs can use `eventPath`.

```json
{
  "inputPath": "$.source"
}
```

## Formatted String

```ts
.map("rule", event => `the source is ${event.source}`)
```

```json
{
  "inputPathsMap": {
    "source": "$.source"
  },
  "inputTemplate": "the source is <source>"
}
```

## Whole Event

```ts
.map("rule", event => event)
```

```json
{
  "inputPathsMap": {},
  "inputTemplate": "<aws.events.event>"
}
```

## Rule Name and Rule Arn

```ts
.map("rule", (event, $utils) => `name: ${$utils.context.ruleName} arn: ${$utils.context.ruleArn}`)
```

```json
{
  "inputPathsMap": {},
  "inputTemplate": "name: <aws.events.rule-name> arn: <aws.events.rule-arn>"
}
```

## Constant Objects

```ts
.map("rule", event => event.detail)
```

```json
{
  "inputPath": "$.detail"
}
```

## Objects

```ts
.map("rule", event => ({
  value: event.detail.field,
  source: event.source,
  constant: "hello"
}))
```

```json
{
  "inputPathsMap": {
    "field": "$.detail.field",
    "source": "$.source"
  },
  "inputTemplate": "{ \"value\": <field>, \"source\": <source>, \"constant\": \"hello\" }"
}
```
