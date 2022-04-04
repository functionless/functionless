[functionless](../README.md) / [Exports](../modules.md) / $SFN

# Namespace: $SFN

## Table of contents

### Variables

- [kind](SFN.md#kind)

### Functions

- [forEach](SFN.md#foreach)
- [map](SFN.md#map)
- [parallel](SFN.md#parallel)
- [waitFor](SFN.md#waitfor)
- [waitUntil](SFN.md#waituntil)

## Variables

### kind

• `Const` **kind**: ``"SFN"``

#### Defined in

[src/step-function.ts:37](https://github.com/sam-goodwin/functionless/blob/261ad48/src/step-function.ts#L37)

## Functions

### forEach

▸ **forEach**<`T`\>(`array`, `callbackfn`): `void`

Process each item in an {@link array} in parallel and run with the default maxConcurrency.

Example:
```ts
new ExpressStepFunction(this, "F", (items: string[]) => {
  $SFN.forEach(items, item => task(item))
});
```

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `array` | `T`[] | the list of items to process |
| `callbackfn` | (`item`: `T`, `index`: `number`, `array`: `T`[]) => `void` | function to process each item |

#### Returns

`void`

#### Defined in

[src/step-function.ts:125](https://github.com/sam-goodwin/functionless/blob/261ad48/src/step-function.ts#L125)

▸ **forEach**<`T`\>(`array`, `props`, `callbackfn`): `void`

Process each item in an {@link array} in parallel and run with the default maxConcurrency.

Example:
```ts
new ExpressStepFunction(this, "F"} (items: string[]) => {
  $SFN.forEach(items, { maxConcurrency: 2 }, item => task(item));
});
```

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `array` | `T`[] | the list of items to process |
| `props` | `Object` | configure the maxConcurrency |
| `props.maxConcurrency` | `number` | - |
| `callbackfn` | (`item`: `T`, `index`: `number`, `array`: `T`[]) => `void` | function to process each item |

#### Returns

`void`

#### Defined in

[src/step-function.ts:145](https://github.com/sam-goodwin/functionless/blob/261ad48/src/step-function.ts#L145)

___

### map

▸ **map**<`T`, `U`\>(`array`, `callbackfn`): `U`[]

Map over each item in an {@link array} in parallel and run with the default maxConcurrency.

Example:
```ts
new ExpressStepFunction(this, "F", (items: string[]) => {
  return $SFN.map(items, item => task(item))
});
```

#### Type parameters

| Name |
| :------ |
| `T` |
| `U` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `array` | `T`[] | the list of items to map over |
| `callbackfn` | (`item`: `T`, `index`: `number`, `array`: `T`[]) => `U` | function to process each item |

#### Returns

`U`[]

an array containing the result of each mapped item

#### Defined in

[src/step-function.ts:173](https://github.com/sam-goodwin/functionless/blob/261ad48/src/step-function.ts#L173)

▸ **map**<`T`, `U`\>(`array`, `props`, `callbackfn`): `U`[]

Map over each item in an {@link array} in parallel and run with a maxConcurrency of {@link props}.maxConcurrency

Example:
```ts
new ExpressStepFunction(this, "F",  (items: string[]) => {
  return $SFN.map(items, { maxConcurrency: 2 }, item => task(item))
});
```

#### Type parameters

| Name |
| :------ |
| `T` |
| `U` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `array` | `T`[] | the list of items to map over |
| `props` | `Object` | configure the maxConcurrency |
| `props.maxConcurrency` | `number` | - |
| `callbackfn` | (`item`: `T`, `index`: `number`, `array`: `T`[]) => `U` | function to process each item |

#### Returns

`U`[]

an array containing the result of each mapped item

#### Defined in

[src/step-function.ts:193](https://github.com/sam-goodwin/functionless/blob/261ad48/src/step-function.ts#L193)

___

### parallel

▸ **parallel**<`Paths`\>(...`paths`): { [i in keyof Paths]: i extends \`${number}\` ? ReturnType<Extract<Paths[i], Function\>\> : Paths[i] }

Run 1 or more workflows in parallel.

```ts
new ExpressStepFunction(this, "F", (id: string) => {
  const results = $SFN.parallel(
    () => task1(id)
    () => task2(id)
  )
})
```

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Paths` | extends readonly () => `any`[] |

#### Parameters

| Name | Type |
| :------ | :------ |
| `...paths` | `Paths` |

#### Returns

{ [i in keyof Paths]: i extends \`${number}\` ? ReturnType<Extract<Paths[i], Function\>\> : Paths[i] }

#### Defined in

[src/step-function.ts:289](https://github.com/sam-goodwin/functionless/blob/261ad48/src/step-function.ts#L289)

___

### waitFor

▸ **waitFor**(`seconds`): `void`

Wait for a specific number of {@link seconds}.

```ts
new ExpressStepFunction(this, "F", (seconds: number) => $SFN.waitFor(seconds))
```

**`see`** https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html

#### Parameters

| Name | Type |
| :------ | :------ |
| `seconds` | `number` |

#### Returns

`void`

#### Defined in

[src/step-function.ts:48](https://github.com/sam-goodwin/functionless/blob/261ad48/src/step-function.ts#L48)

___

### waitUntil

▸ **waitUntil**(`timestamp`): `void`

Wait until a {@link timestamp}.

```ts
new ExpressStepFunction(this, "F", (timestamp: string) => $SFN.waitUntil(timestamp))
```

**`see`** https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html

#### Parameters

| Name | Type |
| :------ | :------ |
| `timestamp` | `string` |

#### Returns

`void`

#### Defined in

[src/step-function.ts:84](https://github.com/sam-goodwin/functionless/blob/261ad48/src/step-function.ts#L84)
