# Typescript → Event Target Input Transformers

Event input transformers are pure functions that transform the input json into a json object or string sent to the target. The transformer is modeled as a map function.

https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-transform-target-input.html

> Limit: Event Bridge does not support input transformation when sending data between buses.

## Constant

```ts
.map(() => "got one!")
```

```json
{
  "input": "got one!"
}
```

## String field

```ts
.map(event => event.source)
```

Simple inputs can use `eventPath`.

```json
{
  "inputPath": "$.source"
}
```

## Formatted String

```ts
.map(event => `the source is ${event.source}`)
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
.map(event => event)
```

```json
{
  "inputPathsMap": {},
  "inputTemplate": "<aws.events.event>"
}
```

## Rule Name and Rule Arn

```ts
.map((event, $utils) => `name: ${$utils.context.ruleName} arn: ${$utils.context.ruleArn}`)
```

```json
{
  "inputPathsMap": {},
  "inputTemplate": "name: <aws.events.rule-name> arn: <aws.events.rule-arn>"
}
```

## Constant Objects

```ts
.map(event => event.detail)
```

```json
{
  "inputPath": "$.detail"
}
```

## Objects

```ts
.map(event => ({
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