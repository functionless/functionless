[functionless](../README.md) / [Exports](../modules.md) / SyncExecutionFailedResult

# Interface: SyncExecutionFailedResult

## Hierarchy

- `BaseSyncExecutionResult`

  ↳ **`SyncExecutionFailedResult`**

## Table of contents

### Properties

- [billingDetails](SyncExecutionFailedResult.md#billingdetails)
- [cause](SyncExecutionFailedResult.md#cause)
- [error](SyncExecutionFailedResult.md#error)
- [executionArn](SyncExecutionFailedResult.md#executionarn)
- [input](SyncExecutionFailedResult.md#input)
- [inputDetails](SyncExecutionFailedResult.md#inputdetails)
- [name](SyncExecutionFailedResult.md#name)
- [outputDetails](SyncExecutionFailedResult.md#outputdetails)
- [startDate](SyncExecutionFailedResult.md#startdate)
- [stateMachineArn](SyncExecutionFailedResult.md#statemachinearn)
- [status](SyncExecutionFailedResult.md#status)
- [stopDate](SyncExecutionFailedResult.md#stopdate)
- [traceHeader](SyncExecutionFailedResult.md#traceheader)

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

[src/step-function.ts:884](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L884)

___

### cause

• **cause**: `string`

#### Defined in

[src/step-function.ts:905](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L905)

___

### error

• **error**: `string`

#### Defined in

[src/step-function.ts:906](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L906)

___

### executionArn

• **executionArn**: `string`

#### Inherited from

BaseSyncExecutionResult.executionArn

#### Defined in

[src/step-function.ts:888](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L888)

___

### input

• **input**: `string`

#### Inherited from

BaseSyncExecutionResult.input

#### Defined in

[src/step-function.ts:889](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L889)

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

[src/step-function.ts:890](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L890)

___

### name

• **name**: `string`

#### Inherited from

BaseSyncExecutionResult.name

#### Defined in

[src/step-function.ts:893](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L893)

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

[src/step-function.ts:895](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L895)

___

### startDate

• **startDate**: `number`

#### Inherited from

BaseSyncExecutionResult.startDate

#### Defined in

[src/step-function.ts:898](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L898)

___

### stateMachineArn

• **stateMachineArn**: `string`

#### Inherited from

BaseSyncExecutionResult.stateMachineArn

#### Defined in

[src/step-function.ts:899](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L899)

___

### status

• **status**: ``"FAILED"`` \| ``"TIMED_OUT"``

#### Overrides

BaseSyncExecutionResult.status

#### Defined in

[src/step-function.ts:907](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L907)

___

### stopDate

• **stopDate**: `number`

#### Inherited from

BaseSyncExecutionResult.stopDate

#### Defined in

[src/step-function.ts:901](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L901)

___

### traceHeader

• **traceHeader**: `string`

#### Inherited from

BaseSyncExecutionResult.traceHeader

#### Defined in

[src/step-function.ts:902](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L902)
