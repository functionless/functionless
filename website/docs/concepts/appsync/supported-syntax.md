---
sidebar_position: 1.2
---

# Supported Syntax

Calls to services such as Table or Function can only be performed at the top-level. See below for some examples of valid and invalid service calls

## Valid

```ts
// stash the result of the service call - the most common use-case
const item = myTable.get();

// calling the service but discarding the result is fine
myTable.get();
```

## Invalid

```ts
// you cannot in-line a call as the if condition, store it as a variable first
if (myTable.get()) {
}

if (condition) {
  // it is not currently possible to conditionally call a service, but this will be supported at a later time
  myTable.get();
}

for (const item in list) {
  // resolvers cannot be contained within a loop
  myTable.get();
}
```

No branching or parallel logic is supported. If you need more flexibility, consider calling a [Step Function](../step-function):

```ts
new ExpressStepFunction(this, "MyFunc", (items: string[]) => {
  // process each item in parallel, an operation not supported in AWS AppSync.
  return items.map((item) => task(item));
});
```
