[functionless](../README.md) / [Exports](../modules.md) / StepFunction

# Class: StepFunction<F\>

## Type parameters

| Name | Type |
| :------ | :------ |
| `F` | extends [`AnyFunction`](../modules.md#anyfunction) |

## Hierarchy

- `BaseStepFunction`<`F`\>

  ↳ **`StepFunction`**

## Callable

### StepFunction

▸ **StepFunction**(`name`, ...`args`): `StartExecutionOutput`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `...args` | `Parameters`<`F`\> |

#### Returns

`StartExecutionOutput`

#### Defined in

[src/step-function.ts:939](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L939)

### StepFunction

▸ **StepFunction**(`name`, `traceHeader`, ...`args`): `StartExecutionOutput`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `traceHeader` | `string` |
| `...args` | `Parameters`<`F`\> |

#### Returns

`StartExecutionOutput`

#### Defined in

[src/step-function.ts:943](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L943)

### StepFunction

▸ **StepFunction**(...`args`): `StartExecutionOutput`

#### Parameters

| Name | Type |
| :------ | :------ |
| `...args` | `Parameters`<`F`\> |

#### Returns

`StartExecutionOutput`

#### Defined in

[src/step-function.ts:948](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L948)

## Table of contents

### Constructors

- [constructor](StepFunction.md#constructor)

### Properties

- [\_\_functionBrand](StepFunction.md#__functionbrand)
- [decl](StepFunction.md#decl)
- [definition](StepFunction.md#definition)
- [env](StepFunction.md#env)
- [grantPrincipal](StepFunction.md#grantprincipal)
- [kind](StepFunction.md#kind)
- [node](StepFunction.md#node)
- [physicalName](StepFunction.md#physicalname)
- [resource](StepFunction.md#resource)
- [role](StepFunction.md#role)
- [stack](StepFunction.md#stack)
- [stateMachineArn](StepFunction.md#statemachinearn)
- [stateMachineName](StepFunction.md#statemachinename)
- [FunctionlessType](StepFunction.md#functionlesstype)

### Methods

- [addToRolePolicy](StepFunction.md#addtorolepolicy)
- [applyRemovalPolicy](StepFunction.md#applyremovalpolicy)
- [describeExecution](StepFunction.md#describeexecution)
- [generatePhysicalName](StepFunction.md#generatephysicalname)
- [getResourceArnAttribute](StepFunction.md#getresourcearnattribute)
- [getResourceNameAttribute](StepFunction.md#getresourcenameattribute)
- [getStepFunctionType](StepFunction.md#getstepfunctiontype)
- [grant](StepFunction.md#grant)
- [grantExecution](StepFunction.md#grantexecution)
- [grantRead](StepFunction.md#grantread)
- [grantStartExecution](StepFunction.md#grantstartexecution)
- [grantStartSyncExecution](StepFunction.md#grantstartsyncexecution)
- [grantTaskResponse](StepFunction.md#granttaskresponse)
- [metric](StepFunction.md#metric)
- [metricAborted](StepFunction.md#metricaborted)
- [metricFailed](StepFunction.md#metricfailed)
- [metricStarted](StepFunction.md#metricstarted)
- [metricSucceeded](StepFunction.md#metricsucceeded)
- [metricThrottled](StepFunction.md#metricthrottled)
- [metricTime](StepFunction.md#metrictime)
- [metricTimedOut](StepFunction.md#metrictimedout)
- [toString](StepFunction.md#tostring)
- [isConstruct](StepFunction.md#isconstruct)
- [isResource](StepFunction.md#isresource)

## Constructors

### constructor

• **new StepFunction**<`F`\>(`scope`, `id`, `props`, `func`)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `F` | extends [`AnyFunction`](../modules.md#anyfunction) |

#### Parameters

| Name | Type |
| :------ | :------ |
| `scope` | `Construct` |
| `id` | `string` |
| `props` | [`StepFunctionProps`](../interfaces/StepFunctionProps.md) |
| `func` | `F` |

#### Inherited from

BaseStepFunction<F\>.constructor

#### Defined in

[src/step-function.ts:346](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L346)

• **new StepFunction**<`F`\>(`scope`, `id`, `func`)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `F` | extends [`AnyFunction`](../modules.md#anyfunction) |

#### Parameters

| Name | Type |
| :------ | :------ |
| `scope` | `Construct` |
| `id` | `string` |
| `func` | `F` |

#### Inherited from

BaseStepFunction<F\>.constructor

#### Defined in

[src/step-function.ts:348](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L348)

## Properties

### \_\_functionBrand

• `Readonly` **\_\_functionBrand**: `F`

#### Inherited from

BaseStepFunction.\_\_functionBrand

#### Defined in

[src/step-function.ts:334](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L334)

___

### decl

• `Readonly` **decl**: [`FunctionDecl`](FunctionDecl.md)<`F`\>

#### Inherited from

BaseStepFunction.decl

#### Defined in

[src/step-function.ts:330](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L330)

___

### definition

• `Readonly` **definition**: `StateMachine`<`States`\>

#### Inherited from

BaseStepFunction.definition

#### Defined in

[src/step-function.ts:339](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L339)

___

### env

• `Readonly` **env**: `ResourceEnvironment`

#### Inherited from

BaseStepFunction.env

#### Defined in

node_modules/aws-cdk-lib/core/lib/resource.d.ts:108

___

### grantPrincipal

• `Readonly` **grantPrincipal**: `IPrincipal`

The principal this state machine is running as

#### Inherited from

BaseStepFunction.grantPrincipal

#### Defined in

[src/step-function.ts:344](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L344)

___

### kind

• `Readonly` **kind**: ``"StepFunction"``

#### Inherited from

BaseStepFunction.kind

#### Defined in

[src/step-function.ts:328](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L328)

___

### node

• `Readonly` **node**: `Node`

The tree node.

**`stability`** stable

#### Inherited from

BaseStepFunction.node

#### Defined in

node_modules/constructs/lib/construct.d.ts:305

___

### physicalName

• `Protected` `Readonly` **physicalName**: `string`

Returns a string-encoded token that resolves to the physical name that
should be passed to the CloudFormation resource.

This value will resolve to one of the following:
- a concrete value (e.g. `"my-awesome-bucket"`)
- `undefined`, when a name should be generated by CloudFormation
- a concrete name generated automatically during synthesis, in
  cross-environment scenarios.

#### Inherited from

BaseStepFunction.physicalName

#### Defined in

node_modules/aws-cdk-lib/core/lib/resource.d.ts:120

___

### resource

• `Readonly` **resource**: `CfnStateMachine`

#### Inherited from

BaseStepFunction.resource

#### Defined in

[src/step-function.ts:331](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L331)

___

### role

• `Readonly` **role**: `IRole`

#### Inherited from

BaseStepFunction.role

#### Defined in

[src/step-function.ts:338](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L338)

___

### stack

• `Readonly` **stack**: `Stack`

#### Inherited from

BaseStepFunction.stack

#### Defined in

node_modules/aws-cdk-lib/core/lib/resource.d.ts:107

___

### stateMachineArn

• `Readonly` **stateMachineArn**: `string`

#### Inherited from

BaseStepFunction.stateMachineArn

#### Defined in

[src/step-function.ts:337](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L337)

___

### stateMachineName

• `Readonly` **stateMachineName**: `string`

#### Inherited from

BaseStepFunction.stateMachineName

#### Defined in

[src/step-function.ts:336](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L336)

___

### FunctionlessType

▪ `Static` `Readonly` **FunctionlessType**: ``"StepFunction"``

This static property identifies this class as an StepFunction to the TypeScript plugin.

#### Defined in

[src/step-function.ts:931](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L931)

## Methods

### addToRolePolicy

▸ **addToRolePolicy**(`statement`): `void`

Add the given statement to the role's policy

#### Parameters

| Name | Type |
| :------ | :------ |
| `statement` | `PolicyStatement` |

#### Returns

`void`

#### Inherited from

BaseStepFunction.addToRolePolicy

#### Defined in

[src/step-function.ts:510](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L510)

___

### applyRemovalPolicy

▸ **applyRemovalPolicy**(`policy`): `void`

Apply the given removal policy to this resource

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

#### Parameters

| Name | Type |
| :------ | :------ |
| `policy` | `RemovalPolicy` |

#### Returns

`void`

#### Inherited from

BaseStepFunction.applyRemovalPolicy

#### Defined in

node_modules/aws-cdk-lib/core/lib/resource.d.ts:144

___

### describeExecution

▸ **describeExecution**(`executionArn`): `DescribeExecutionOutput`

#### Parameters

| Name | Type |
| :------ | :------ |
| `executionArn` | `string` |

#### Returns

`DescribeExecutionOutput`

#### Inherited from

BaseStepFunction.describeExecution

#### Defined in

[src/step-function.ts:461](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L461)

___

### generatePhysicalName

▸ `Protected` **generatePhysicalName**(): `string`

#### Returns

`string`

#### Inherited from

BaseStepFunction.generatePhysicalName

#### Defined in

node_modules/aws-cdk-lib/core/lib/resource.d.ts:145

___

### getResourceArnAttribute

▸ `Protected` **getResourceArnAttribute**(`arnAttr`, `arnComponents`): `string`

Returns an environment-sensitive token that should be used for the
resource's "ARN" attribute (e.g. `bucket.bucketArn`).

Normally, this token will resolve to `arnAttr`, but if the resource is
referenced across environments, `arnComponents` will be used to synthesize
a concrete ARN with the resource's physical name. Make sure to reference
`this.physicalName` in `arnComponents`.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `arnAttr` | `string` | The CFN attribute which resolves to the ARN of the resource. Commonly it will be called "Arn" (e.g. `resource.attrArn`), but sometimes it's the CFN resource's `ref`. |
| `arnComponents` | `ArnComponents` | The format of the ARN of this resource. You must reference `this.physicalName` somewhere within the ARN in order for cross-environment references to work. |

#### Returns

`string`

#### Inherited from

BaseStepFunction.getResourceArnAttribute

#### Defined in

node_modules/aws-cdk-lib/core/lib/resource.d.ts:175

___

### getResourceNameAttribute

▸ `Protected` **getResourceNameAttribute**(`nameAttr`): `string`

Returns an environment-sensitive token that should be used for the
resource's "name" attribute (e.g. `bucket.bucketName`).

Normally, this token will resolve to `nameAttr`, but if the resource is
referenced across environments, it will be resolved to `this.physicalName`,
which will be a concrete name.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `nameAttr` | `string` | The CFN attribute which resolves to the resource's name. Commonly this is the resource's `ref`. |

#### Returns

`string`

#### Inherited from

BaseStepFunction.getResourceNameAttribute

#### Defined in

node_modules/aws-cdk-lib/core/lib/resource.d.ts:157

___

### getStepFunctionType

▸ **getStepFunctionType**(): `STANDARD`

#### Returns

`STANDARD`

#### Overrides

BaseStepFunction.getStepFunctionType

#### Defined in

[src/step-function.ts:933](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L933)

___

### grant

▸ **grant**(`identity`, ...`actions`): `Grant`

Grant the given identity custom permissions

#### Parameters

| Name | Type |
| :------ | :------ |
| `identity` | `IGrantable` |
| `...actions` | `string`[] |

#### Returns

`Grant`

#### Inherited from

BaseStepFunction.grant

#### Defined in

[src/step-function.ts:597](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L597)

___

### grantExecution

▸ **grantExecution**(`identity`, ...`actions`): `Grant`

Grant the given identity permissions on all executions of the state machine

#### Parameters

| Name | Type |
| :------ | :------ |
| `identity` | `IGrantable` |
| `...actions` | `string`[] |

#### Returns

`Grant`

#### Inherited from

BaseStepFunction.grantExecution

#### Defined in

[src/step-function.ts:586](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L586)

___

### grantRead

▸ **grantRead**(`identity`): `Grant`

Grant the given identity permissions to read results from state
machine.

#### Parameters

| Name | Type |
| :------ | :------ |
| `identity` | `IGrantable` |

#### Returns

`Grant`

#### Inherited from

BaseStepFunction.grantRead

#### Defined in

[src/step-function.ts:542](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L542)

___

### grantStartExecution

▸ **grantStartExecution**(`identity`): `Grant`

Grant the given identity permissions to start an execution of this state
machine.

#### Parameters

| Name | Type |
| :------ | :------ |
| `identity` | `IGrantable` |

#### Returns

`Grant`

#### Inherited from

BaseStepFunction.grantStartExecution

#### Defined in

[src/step-function.ts:518](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L518)

___

### grantStartSyncExecution

▸ **grantStartSyncExecution**(`identity`): `Grant`

Grant the given identity permissions to start a synchronous execution of
this state machine.

#### Parameters

| Name | Type |
| :------ | :------ |
| `identity` | `IGrantable` |

#### Returns

`Grant`

#### Inherited from

BaseStepFunction.grantStartSyncExecution

#### Defined in

[src/step-function.ts:530](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L530)

___

### grantTaskResponse

▸ **grantTaskResponse**(`identity`): `Grant`

Grant the given identity task response permissions on a state machine

#### Parameters

| Name | Type |
| :------ | :------ |
| `identity` | `IGrantable` |

#### Returns

`Grant`

#### Inherited from

BaseStepFunction.grantTaskResponse

#### Defined in

[src/step-function.ts:571](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L571)

___

### metric

▸ **metric**(`metricName`, `props?`): `Metric`

Return the given named metric for this State Machine's executions

**`default`** - sum over 5 minutes

#### Parameters

| Name | Type |
| :------ | :------ |
| `metricName` | `string` |
| `props?` | `MetricOptions` |

#### Returns

`Metric`

#### Inherited from

BaseStepFunction.metric

#### Defined in

[src/step-function.ts:613](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L613)

___

### metricAborted

▸ **metricAborted**(`props?`): `Metric`

Metric for the number of executions that were aborted

**`default`** - sum over 5 minutes

#### Parameters

| Name | Type |
| :------ | :------ |
| `props?` | `MetricOptions` |

#### Returns

`Metric`

#### Inherited from

BaseStepFunction.metricAborted

#### Defined in

[src/step-function.ts:662](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L662)

___

### metricFailed

▸ **metricFailed**(`props?`): `Metric`

Metric for the number of executions that failed

**`default`** - sum over 5 minutes

#### Parameters

| Name | Type |
| :------ | :------ |
| `props?` | `MetricOptions` |

#### Returns

`Metric`

#### Inherited from

BaseStepFunction.metricFailed

#### Defined in

[src/step-function.ts:631](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L631)

___

### metricStarted

▸ **metricStarted**(`props?`): `Metric`

Metric for the number of executions that were started

**`default`** - sum over 5 minutes

#### Parameters

| Name | Type |
| :------ | :------ |
| `props?` | `MetricOptions` |

#### Returns

`Metric`

#### Inherited from

BaseStepFunction.metricStarted

#### Defined in

[src/step-function.ts:719](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L719)

___

### metricSucceeded

▸ **metricSucceeded**(`props?`): `Metric`

Metric for the number of executions that succeeded

**`default`** - sum over 5 minutes

#### Parameters

| Name | Type |
| :------ | :------ |
| `props?` | `MetricOptions` |

#### Returns

`Metric`

#### Inherited from

BaseStepFunction.metricSucceeded

#### Defined in

[src/step-function.ts:681](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L681)

___

### metricThrottled

▸ **metricThrottled**(`props?`): `Metric`

Metric for the number of executions that were throttled

**`default`** - sum over 5 minutes

#### Parameters

| Name | Type |
| :------ | :------ |
| `props?` | `MetricOptions` |

#### Returns

`Metric`

#### Inherited from

BaseStepFunction.metricThrottled

#### Defined in

[src/step-function.ts:650](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L650)

___

### metricTime

▸ **metricTime**(`props?`): `Metric`

Metric for the interval, in milliseconds, between the time the execution starts and the time it closes

**`default`** - average over 5 minutes

#### Parameters

| Name | Type |
| :------ | :------ |
| `props?` | `MetricOptions` |

#### Returns

`Metric`

#### Inherited from

BaseStepFunction.metricTime

#### Defined in

[src/step-function.ts:730](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L730)

___

### metricTimedOut

▸ **metricTimedOut**(`props?`): `Metric`

Metric for the number of executions that timed out

**`default`** - sum over 5 minutes

#### Parameters

| Name | Type |
| :------ | :------ |
| `props?` | `MetricOptions` |

#### Returns

`Metric`

#### Inherited from

BaseStepFunction.metricTimedOut

#### Defined in

[src/step-function.ts:700](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/step-function.ts#L700)

___

### toString

▸ **toString**(): `string`

Returns a string representation of this construct.

**`stability`** stable

#### Returns

`string`

#### Inherited from

BaseStepFunction.toString

#### Defined in

node_modules/constructs/lib/construct.d.ts:319

___

### isConstruct

▸ `Static` **isConstruct**(`x`): x is Construct

(deprecated) Checks if `x` is a construct.

**`deprecated`** use `x instanceof Construct` instead

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `x` | `any` | Any object. |

#### Returns

x is Construct

true if `x` is an object created from a class which extends `Construct`.

#### Inherited from

BaseStepFunction.isConstruct

#### Defined in

node_modules/constructs/lib/construct.d.ts:299

___

### isResource

▸ `Static` **isResource**(`construct`): construct is CfnResource

Check whether the given construct is a Resource

#### Parameters

| Name | Type |
| :------ | :------ |
| `construct` | `IConstruct` |

#### Returns

construct is CfnResource

#### Inherited from

BaseStepFunction.isResource

#### Defined in

node_modules/aws-cdk-lib/core/lib/resource.d.ts:106
