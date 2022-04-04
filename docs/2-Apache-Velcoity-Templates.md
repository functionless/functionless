# TypeScript -> Velocity Template Logic

In order to write effective VTL templates, it helps to understand how TypeScript syntax maps to Velocity Template Statements.

An AppSync Request Mapping Template is synthesized by evaluating all [Expressions](./src/expression.ts) to a series of `#set`, `$util.qr`, `#foreach` and `#if` statements. The end result is an object containing the returned result of the function which can then be converted to JSON with `$util.toJson`.

The following section provides a reference guide on how each of the supported TypeScript syntax is mapped to VTL.

#### Parameter Reference

A reference to the top-level Function Parameter is mapped to a `$context` in VTL:

```ts
new AppsyncResolver((c: AppsyncContext<{ arg: string }>) => {
  return c.arguments.arg;
});
```

```
#return($context.arguments.arg)
```

#### Variable Declaration

If in the top-level scope, all Variables are stored in `$context.stash`.

```ts
new AppsyncResolver(() => {
  const a = "value";
  const b = a;
});
```

```
#set($context.stash.a = 'value')
#set($context.stash.b = $context.stash.a)
```

#### Variable Declaration in a nested scope

If in a nested scope, then the local variable name is used. These variables will not be available across Resolver Pipeline stages - but this should not be a problem as they are contained within a nested scope in TypeScript also.

```ts
new AppsyncResolver(() => {
  if (condition) {
    const a = "value";
    const b = a;
  }

  for (const i in list) {
    const a = "value";
    const b = a;
  }
});
```

```
#if($condition)
#set($a = 'value')
#set($b = $a)
#end

#foreach($i in $list)
#set($a = 'value')
#set($b = $a)
#end
```

#### Template Expressions (string interpolation)

Template expressions translate almost 1:1 with VTL:

```ts
const a = `hello ${name}`;
```

```
#set($context.stash.a = "hello ${name}")
```

#### Property and Index Assignment

```ts
a[0] = value;
a.prop = value;
a["prop"] = value;
a[prop] = value;
```

```
$util.qr($a[0] = $value)
$util.qr($a.prop = $value)
$util.qr($a['prop'] = $value)
$util.qr($a[$prop] = $value)
```

#### ArrayLiteralExpr

Array Literals can contain arbitrary expressions.

```ts
const a = [];
const b = ["hello", 1, util.toJson(a)];
```

```
#set($a = [])
#set($b = ['hello', 1, $util.toJson($a)])
```

#### SpreadElementExpr

There is a special case when you use a `SpreadElementExpr` (e.g. `[...list]`) because there is no way to achieve this behavior in VTL without first assigning a list and then using `addAll` to copy the items in.

If you ever use `SpreadElementExpr`, a temporary variable will be first initialized with an empty array (`[]`):

```ts
const c = [...b];
```

```
#set($v1 = [])
$util.qr($c.addAll($b))
#set($c = $v1)
```

#### ObjectLiteralExpr

An `ObjectLiteralExpr` is first stored as an empty map `{}` in a temporary variable and subsequent statements are generated to add each of the elements in.

```ts
const a = {
  key: "string",
};
```

```
#set($a = {})
$util.qr($a.put('key', 'string'))
```

#### SpreadAssignExpr

If you spread an object into another, a [`java.util.Map.putAll`](https://docs.oracle.com/javase/8/docs/api/java/util/HashMap.html#putAll-java.util.Map-) statement is generated to copy over each item in the source object into the destination object.

```ts
const a = {
  ...obj,
};
```

```
#set($a = {})
$util.qr($a.putAll($obj))
```

#### CallExpr - $util

The `$util.*` utility functions are translated verbatim into a VTL expression.

```ts
$util.error("error");
const a = $util.toJson(val);
```

```
$util.error('error')
#set($a = $util.toJson($val))
```

#### If Statement

An `if` statement translates to a series of `#if`, `#else` statements.

```ts
if (a === "hello") {
  return a;
}
```

```
#if($a == 'hello')
  #return($a)
#end
```

`#elseif` is not used because evaluating the condition may translate to a series of `#set` or `$util.qr` statements. For this reason, all `else if` clauses are translated to `#else` with a nested `#if`:

```ts
if (a === "hello") {
  return a;
} else if (call() === "hello") {
  return false;
}
```

```
#if($a == 'hello')
  #return($a)
#else
  #set($v1 = call())
  #if($v1 === "hello")
    #return($a)
  #end
#end
```

#### Conditional Expressions

A conditional expression, i.e. `cond ? then : else` are translated into `#if` and `#else` statements that assign a shared variable with the result of their computation;

```ts
const a = condition ? "left" : "right;
```

```
#if($condition)
#set($result = 'left')
#else
#set($result = 'right')
#end
#set($a = $result)
```

#### For-In-Statement

A `for-in` statement iterates over the keys in an object using `java.util.Map.keySet()`.

```ts
for (const i in obj) {
  const a = obj[i];
}
```

```
#foreach($i in $obj.keySet())
#set($a = $obj[$i])
#end
```

#### For-Of-Statement

A `for-of` statement iterates over the items in a `java.util.List`.

```ts
for (const item in list) {
}
```

```
#foreach($item in $list)
#end
```

#### CallExpr - map

When you map over a list, a new list is created and then `#foreach` is used to iterate over the source list, evaluate your function and add the result to the new list.

**Warning**: chains of `map`, `forEach` and `reduce` results in redundant `#foreach` loops, see https://github.com/sam-goodwin/functionless/issues/2

```ts
const newList = list.map((i) => i + 1);
```

```
#set($newList = [])
#foreach($i in $list)
$util.qr($newList.add($i + 1))
#end
```

#### CallExpr - forEach

`forEach` is similar to `map` except it does not produce a value. The (below) example emulates `map` with `forEach`.

**Warning**: chains of `map`, `forEach` and `reduce` results in redundant `#foreach` loops, see https://github.com/sam-goodwin/functionless/issues/2

```ts
const newList = [];
list.forEach((i) => newList.push(i + 1));
```

```
#set($newList = [])
#foreach($i in $list)
$util.qr($newList.add($i + 1))
#end
```

#### CallExpr - reduce

`reduce` has two variants: 1) with an `initialValue` and 2) without.

**Warning**: chains of `map`, `forEach` and `reduce` results in redundant `#foreach` loops, see https://github.com/sam-goodwin/functionless/issues/2

If there is no initial value, then the list cannot be empty - if an empty list is encountered an error will be raised with `$util.error`.

Within the loop, the first value will not be processed by your function, instead it becomes the first value `$a`.

```ts
// without an initial value
const sum = list.reduce((a, b) => a + b);
```

```
#set(sum = [])
#if($list.isEmpty())
$util.error('Reduce of empty array with no initial value')
#end
#foreach($b in $list)
#if($foreach.index == 0)
#set($a = $b)
#else
#set($a = $a + $b)
#end
#end
```

If there is an initial value, then it is stored as a variable, referenced in the `#foreach` loop and overwritten at the end of each loop.

```ts
// with an initial value
const obj = list.reduce((a: Record<string, boolean>, b: string) => {
  ...a,
  [b]: true
}, {})
```

```
#set($a = {})
#foreach($b in $obj)
#set($v1 = {})
$util.qr($v1.putAll($a))
$util.qr($v1.put($b, true))
#set($a = $v1)
#end
```
