[functionless](../README.md) / [Exports](../modules.md) / SynthesizedAppsyncResolver

# Class: SynthesizedAppsyncResolver

An {@link appsync.Resolver} synthesized by a [AppsyncResolver](AppsyncResolver.md).

## Hierarchy

- `Resolver`

  ↳ **`SynthesizedAppsyncResolver`**

## Table of contents

### Constructors

- [constructor](SynthesizedAppsyncResolver.md#constructor)

### Properties

- [arn](SynthesizedAppsyncResolver.md#arn)
- [node](SynthesizedAppsyncResolver.md#node)
- [templates](SynthesizedAppsyncResolver.md#templates)

### Methods

- [toString](SynthesizedAppsyncResolver.md#tostring)
- [isConstruct](SynthesizedAppsyncResolver.md#isconstruct)

## Constructors

### constructor

• **new SynthesizedAppsyncResolver**(`scope`, `id`, `props`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `scope` | `Construct` |
| `id` | `string` |
| `props` | [`SynthesizedAppsyncResolverProps`](../interfaces/SynthesizedAppsyncResolverProps.md) |

#### Overrides

appsync.Resolver.constructor

#### Defined in

[src/appsync.ts:67](https://github.com/sam-goodwin/functionless/blob/6691871/src/appsync.ts#L67)

## Properties

### arn

• `Readonly` **arn**: `string`

the ARN of the resolver

#### Inherited from

appsync.Resolver.arn

#### Defined in

node_modules/@aws-cdk/aws-appsync-alpha/lib/resolver.d.ts:72

___

### node

• `Readonly` **node**: `Node`

The tree node.

**`stability`** stable

#### Inherited from

appsync.Resolver.node

#### Defined in

node_modules/constructs/lib/construct.d.ts:305

___

### templates

• `Readonly` **templates**: `string`[]

All of the Request and Response Mapping templates in the order they are executed by the AppSync service.

#### Defined in

[src/appsync.ts:65](https://github.com/sam-goodwin/functionless/blob/6691871/src/appsync.ts#L65)

## Methods

### toString

▸ **toString**(): `string`

Returns a string representation of this construct.

**`stability`** stable

#### Returns

`string`

#### Inherited from

appsync.Resolver.toString

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

appsync.Resolver.isConstruct

#### Defined in

node_modules/constructs/lib/construct.d.ts:299
