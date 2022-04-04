[functionless](../README.md) / [Exports](../modules.md) / SyncExecutionSuccessResult

# Interface: SyncExecutionSuccessResult<T\>

## Type parameters

| Name |
| :------ |
| `T` |

## Hierarchy

- `BaseSyncExecutionResult`

  ↳ **`SyncExecutionSuccessResult`**

## Table of contents

### Properties

- [billingDetails](SyncExecutionSuccessResult.md#billingdetails)
- [executionArn](SyncExecutionSuccessResult.md#executionarn)
- [input](SyncExecutionSuccessResult.md#input)
- [inputDetails](SyncExecutionSuccessResult.md#inputdetails)
- [name](SyncExecutionSuccessResult.md#name)
- [output](SyncExecutionSuccessResult.md#output)
- [outputDetails](SyncExecutionSuccessResult.md#outputdetails)
- [startDate](SyncExecutionSuccessResult.md#startdate)
- [stateMachineArn](SyncExecutionSuccessResult.md#statemachinearn)
- [status](SyncExecutionSuccessResult.md#status)
- [stopDate](SyncExecutionSuccessResult.md#stopdate)
- [traceHeader](SyncExecutionSuccessResult.md#traceheader)

## Properties

### billingDetails

• **billingDetails**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `billedDurationInMilliseconds` | `number` |
| `billedMemoryUsedInMB` | `number` |

#### Inherited from

BaseSyncExecutionResult.billingDetails

#### Defined in

[src/step-function.ts:884](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/step-function.ts#L884)

___

### executionArn

• **executionArn**: `string`

#### Inherited from

BaseSyncExecutionResult.executionArn

#### Defined in

[src/step-function.ts:888](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/step-function.ts#L888)

___

### input

• **input**: `string`

#### Inherited from

BaseSyncExecutionResult.input

#### Defined in

[src/step-function.ts:889](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/step-function.ts#L889)

___

### inputDetails

• **inputDetails**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `included` | `boolean` |

#### Inherited from

BaseSyncExecutionResult.inputDetails

#### Defined in

[src/step-function.ts:890](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/step-function.ts#L890)

___

### name

• **name**: `string`

#### Inherited from

BaseSyncExecutionResult.name

#### Defined in

[src/step-function.ts:893](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/step-function.ts#L893)

___

### output

• **output**: `T`

#### Defined in

[src/step-function.ts:910](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/step-function.ts#L910)

___

### outputDetails

• **outputDetails**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `included` | `boolean` |

#### Inherited from

BaseSyncExecutionResult.outputDetails

#### Defined in

[src/step-function.ts:895](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/step-function.ts#L895)

___

### startDate

• **startDate**: `number`

#### Inherited from

BaseSyncExecutionResult.startDate

#### Defined in

[src/step-function.ts:898](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/step-function.ts#L898)

___

### stateMachineArn

• **stateMachineArn**: `string`

#### Inherited from

BaseSyncExecutionResult.stateMachineArn

#### Defined in

[src/step-function.ts:899](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/step-function.ts#L899)

___

### status

• **status**: ``"SUCCEEDED"``

#### Overrides

BaseSyncExecutionResult.status

#### Defined in

[src/step-function.ts:911](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/step-function.ts#L911)

___

### stopDate

• **stopDate**: `number`

#### Inherited from

BaseSyncExecutionResult.stopDate

#### Defined in

[src/step-function.ts:901](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/step-function.ts#L901)

___

### traceHeader

• **traceHeader**: `string`

#### Inherited from

BaseSyncExecutionResult.traceHeader

#### Defined in

[src/step-function.ts:902](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/step-function.ts#L902)
