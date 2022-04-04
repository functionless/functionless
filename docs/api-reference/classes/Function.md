[functionless](../README.md) / [Exports](../modules.md) / Function

# Class: Function<P, O\>

## Type parameters

| Name |
| :------ |
| `P` |
| `O` |

## Callable

### Function

▸ **Function**(...`args`): `ReturnType`<`ConditionalFunction`<`P`, `O`\>\>

Wraps an {@link aws_lambda.Function} with a type-safe interface that can be
called from within an [AppsyncResolver](AppsyncResolver.md).

For example:
```ts
const getPerson = new Function<string, Person>(
  new aws_lambda.Function(..)
);

new AppsyncResolver(() => {
  return getPerson("value");
})
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `...args` | `Parameters`<`ConditionalFunction`<`P`, `O`\>\> |

#### Returns

`ReturnType`<`ConditionalFunction`<`P`, `O`\>\>

#### Defined in

[src/function.ts:75](https://github.com/sam-goodwin/functionless/blob/72d5f75/src/function.ts#L75)

## Table of contents

### Constructors

- [constructor](Function.md#constructor)

### Properties

- [\_\_functionBrand](Function.md#__functionbrand)
- [kind](Function.md#kind)
- [resource](Function.md#resource)

## Constructors

### constructor

• **new Function**<`P`, `O`\>(`resource`)

#### Type parameters

| Name |
| :------ |
| `P` |
| `O` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `resource` | `IFunction` |

#### Defined in

[src/function.ts:37](https://github.com/sam-goodwin/functionless/blob/72d5f75/src/function.ts#L37)

## Properties

### \_\_functionBrand

• `Readonly` **\_\_functionBrand**: `ConditionalFunction`<`P`, `O`\>

#### Defined in

[src/function.ts:35](https://github.com/sam-goodwin/functionless/blob/72d5f75/src/function.ts#L35)

___

### kind

• `Readonly` **kind**: ``"Function"``

#### Defined in

[src/function.ts:32](https://github.com/sam-goodwin/functionless/blob/72d5f75/src/function.ts#L32)

___

### resource

• `Readonly` **resource**: `IFunction`
