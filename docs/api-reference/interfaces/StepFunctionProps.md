[functionless](../README.md) / [Exports](../modules.md) / StepFunctionProps

# Interface: StepFunctionProps

## Hierarchy

- `Omit`<`aws_stepfunctions.StateMachineProps`, ``"definition"`` \| ``"stateMachineType"``\>

  ↳ **`StepFunctionProps`**

## Table of contents

### Properties

- [logs](StepFunctionProps.md#logs)
- [role](StepFunctionProps.md#role)
- [stateMachineName](StepFunctionProps.md#statemachinename)
- [timeout](StepFunctionProps.md#timeout)
- [tracingEnabled](StepFunctionProps.md#tracingenabled)

## Properties

### logs

• `Optional` `Readonly` **logs**: `LogOptions`

Defines what execution history events are logged and where they are logged.

**`default`** No logging

#### Inherited from

Omit.logs

#### Defined in

node_modules/aws-cdk-lib/aws-stepfunctions/lib/state-machine.d.ts:107

___

### role

• `Optional` `Readonly` **role**: `IRole`

The execution role for the state machine service

**`default`** A role is automatically created

#### Inherited from

Omit.role

#### Defined in

node_modules/aws-cdk-lib/aws-stepfunctions/lib/state-machine.d.ts:89

___

### stateMachineName

• `Optional` `Readonly` **stateMachineName**: `string`

A name for the state machine

**`default`** A name is automatically generated

#### Inherited from

Omit.stateMachineName

#### Defined in

node_modules/aws-cdk-lib/aws-stepfunctions/lib/state-machine.d.ts:79

___

### timeout

• `Optional` `Readonly` **timeout**: `Duration`

Maximum run time for this state machine

**`default`** No timeout

#### Inherited from

Omit.timeout

#### Defined in

node_modules/aws-cdk-lib/aws-stepfunctions/lib/state-machine.d.ts:95

___

### tracingEnabled

• `Optional` `Readonly` **tracingEnabled**: `boolean`

Specifies whether Amazon X-Ray tracing is enabled for this state machine.

**`default`** false

#### Inherited from

Omit.tracingEnabled

#### Defined in

node_modules/aws-cdk-lib/aws-stepfunctions/lib/state-machine.d.ts:113
