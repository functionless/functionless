[functionless](../README.md) / [Exports](../modules.md) / AppsyncContext

# Interface: AppsyncContext<Arguments, Source\>

The shape of the AWS Appsync `$context` variable.

Both the `arguments` and `stash` fields are purposely omitted since they are used internally
by the TypeScript->VTL conversion logic.

**`see`** https://docs.aws.amazon.com/appsync/latest/devguide/resolver-context-reference.html

## Type parameters

| Name | Type |
| :------ | :------ |
| `Arguments` | extends [`ResolverArguments`](ResolverArguments.md) |
| `Source` | `undefined` |

## Hierarchy

- `Omit`<`AppSyncResolverEvent`<`never`, `Source`\>, ``"arguments"`` \| ``"stash"``\>

  ↳ **`AppsyncContext`**

## Table of contents

### Properties

- [arguments](AppsyncContext.md#arguments)
- [identity](AppsyncContext.md#identity)
- [info](AppsyncContext.md#info)
- [prev](AppsyncContext.md#prev)
- [request](AppsyncContext.md#request)
- [source](AppsyncContext.md#source)

## Properties

### arguments

• **arguments**: `Arguments`

#### Defined in

[src/appsync.ts:28](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/appsync.ts#L28)

___

### identity

• `Optional` **identity**: `AppSyncIdentity`

#### Inherited from

Omit.identity

#### Defined in

node_modules/@types/aws-lambda/trigger/appsync-resolver.d.ts:49

___

### info

• **info**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `fieldName` | `string` |
| `parentTypeName` | `string` |
| `selectionSetGraphQL` | `string` |
| `selectionSetList` | `string`[] |
| `variables` | { `[key: string]`: `any`;  } |

#### Inherited from

Omit.info

#### Defined in

node_modules/@types/aws-lambda/trigger/appsync-resolver.d.ts:54

___

### prev

• **prev**: ``null`` \| { `result`: { `[key: string]`: `any`;  }  }

#### Inherited from

Omit.prev

#### Defined in

node_modules/@types/aws-lambda/trigger/appsync-resolver.d.ts:61

___

### request

• **request**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `headers` | `AppSyncResolverEventHeaders` |

#### Inherited from

Omit.request

#### Defined in

node_modules/@types/aws-lambda/trigger/appsync-resolver.d.ts:51

___

### source

• **source**: `Source`

#### Inherited from

Omit.source

#### Defined in

node_modules/@types/aws-lambda/trigger/appsync-resolver.d.ts:50
