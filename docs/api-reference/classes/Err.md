[functionless](../README.md) / [Exports](../modules.md) / Err

# Class: Err

## Hierarchy

- `BaseNode`<``"Err"``\>

  ↳ **`Err`**

## Table of contents

### Constructors

- [constructor](Err.md#constructor)

### Properties

- [children](Err.md#children)
- [error](Err.md#error)
- [kind](Err.md#kind)
- [nodeKind](Err.md#nodekind)
- [parent](Err.md#parent)

### Methods

- [as](Err.md#as)
- [clone](Err.md#clone)
- [collectChildren](Err.md#collectchildren)
- [contains](Err.md#contains)
- [exit](Err.md#exit)
- [findCatchClause](Err.md#findcatchclause)
- [findChildren](Err.md#findchildren)
- [findParent](Err.md#findparent)
- [getLexicalScope](Err.md#getlexicalscope)
- [getVisibleNames](Err.md#getvisiblenames)
- [is](Err.md#is)
- [isTerminal](Err.md#isterminal)
- [setParent](Err.md#setparent)
- [step](Err.md#step)
- [throw](Err.md#throw)

## Constructors

### constructor

• **new Err**(`error`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `error` | `Error` |

#### Overrides

BaseNode&lt;&quot;Err&quot;\&gt;.constructor

#### Defined in

[src/error.ts:8](https://github.com/sam-goodwin/functionless/blob/261ad48/src/error.ts#L8)

## Properties

### children

• `Readonly` **children**: `FunctionlessNode`[] = `[]`

The immediate Child nodes contained within this Node.

#### Inherited from

BaseNode.children

#### Defined in

[src/node.ts:29](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L29)

___

### error

• `Readonly` **error**: `Error`

___

### kind

• `Readonly` **kind**: ``"Err"``

#### Inherited from

BaseNode.kind

___

### nodeKind

• `Readonly` **nodeKind**: ``"Err"``

#### Overrides

BaseNode.nodeKind

#### Defined in

[src/error.ts:6](https://github.com/sam-goodwin/functionless/blob/261ad48/src/error.ts#L6)

___

### parent

• **parent**: `undefined` \| `FunctionlessNode`

#### Inherited from

BaseNode.parent

#### Defined in

[src/node.ts:24](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L24)

## Methods

### as

▸ **as**<`K`\>(`kind`): `Extract`<[`Err`](Err.md), { `kind`: `K`  }\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends ``"FunctionDecl"`` \| ``"CallExpr"`` \| ``"ParameterDecl"`` \| ``"Argument"`` \| ``"ArrayLiteralExpr"`` \| ``"BinaryExpr"`` \| ``"BooleanLiteralExpr"`` \| ``"ConditionExpr"`` \| ``"ComputedPropertyNameExpr"`` \| ``"FunctionExpr"`` \| ``"ElementAccessExpr"`` \| ``"Identifier"`` \| ``"NewExpr"`` \| ``"NullLiteralExpr"`` \| ``"NumberLiteralExpr"`` \| ``"ObjectLiteralExpr"`` \| ``"PropAccessExpr"`` \| ``"PropAssignExpr"`` \| ``"ReferenceExpr"`` \| ``"SpreadAssignExpr"`` \| ``"SpreadElementExpr"`` \| ``"StringLiteralExpr"`` \| ``"TemplateExpr"`` \| ``"TypeOfExpr"`` \| ``"UnaryExpr"`` \| ``"UndefinedLiteralExpr"`` \| ``"BreakStmt"`` \| ``"BlockStmt"`` \| ``"CatchClause"`` \| ``"ContinueStmt"`` \| ``"DoStmt"`` \| ``"ExprStmt"`` \| ``"ForInStmt"`` \| ``"ForOfStmt"`` \| ``"IfStmt"`` \| ``"ReturnStmt"`` \| ``"ThrowStmt"`` \| ``"TryStmt"`` \| ``"VariableStmt"`` \| ``"WhileStmt"`` \| ``"Err"`` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `kind` | `K` |

#### Returns

`Extract`<[`Err`](Err.md), { `kind`: `K`  }\>

#### Inherited from

BaseNode.as

#### Defined in

[src/node.ts:42](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L42)

___

### clone

▸ **clone**(): [`Err`](Err.md)

#### Returns

[`Err`](Err.md)

#### Overrides

BaseNode.clone

#### Defined in

[src/error.ts:12](https://github.com/sam-goodwin/functionless/blob/261ad48/src/error.ts#L12)

___

### collectChildren

▸ **collectChildren**<`T`\>(`f`): `T`[]

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `f` | (`node`: `FunctionlessNode`) => `T`[] |

#### Returns

`T`[]

#### Inherited from

BaseNode.collectChildren

#### Defined in

[src/node.ts:62](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L62)

___

### contains

▸ **contains**(`node`, `alg?`): `boolean`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `node` | `FunctionlessNode` | `undefined` |
| `alg` | ``"dfs"`` \| ``"bfs"`` | `"dfs"` |

#### Returns

`boolean`

#### Inherited from

BaseNode.contains

#### Defined in

[src/node.ts:107](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L107)

___

### exit

▸ **exit**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run after exiting the scope of this Node.

#### Inherited from

BaseNode.exit

#### Defined in

[src/node.ts:173](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L173)

___

### findCatchClause

▸ **findCatchClause**(): `undefined` \| [`CatchClause`](CatchClause.md)

Finds the [CatchClause](CatchClause.md) that this Node should throw to.

#### Returns

`undefined` \| [`CatchClause`](CatchClause.md)

#### Inherited from

BaseNode.findCatchClause

#### Defined in

[src/node.ts:84](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L84)

___

### findChildren

▸ **findChildren**<`N`\>(`is`): `N`[]

#### Type parameters

| Name | Type |
| :------ | :------ |
| `N` | extends `FunctionlessNode` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `is` | (`node`: `FunctionlessNode`) => node is N |

#### Returns

`N`[]

#### Inherited from

BaseNode.findChildren

#### Defined in

[src/node.ts:56](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L56)

___

### findParent

▸ **findParent**<`N`\>(`is`): `undefined` \| `N`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `N` | extends `FunctionlessNode` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `is` | (`node`: `FunctionlessNode`) => node is N |

#### Returns

`undefined` \| `N`

#### Inherited from

BaseNode.findParent

#### Defined in

[src/node.ts:69](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L69)

___

### getLexicalScope

▸ **getLexicalScope**(): `Map`<`string`, [`ParameterDecl`](ParameterDecl.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

#### Returns

`Map`<`string`, [`ParameterDecl`](ParameterDecl.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

a mapping of name to the node visible in this node's scope.

#### Inherited from

BaseNode.getLexicalScope

#### Defined in

[src/node.ts:278](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L278)

___

### getVisibleNames

▸ **getVisibleNames**(): `string`[]

#### Returns

`string`[]

an array of all the visible names in this node's scope.

#### Inherited from

BaseNode.getVisibleNames

#### Defined in

[src/node.ts:271](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L271)

___

### is

▸ **is**<`N`\>(`is`): this is N

#### Type parameters

| Name | Type |
| :------ | :------ |
| `N` | extends [`Err`](Err.md)<`N`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `is` | (`node`: [`Err`](Err.md)) => node is N |

#### Returns

this is N

#### Inherited from

BaseNode.is

#### Defined in

[src/node.ts:52](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L52)

___

### isTerminal

▸ **isTerminal**(): `boolean`

#### Returns

`boolean`

checks if this Node is terminal - meaning all branches explicitly return a value

#### Inherited from

BaseNode.isTerminal

#### Defined in

[src/node.ts:315](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L315)

___

### setParent

▸ **setParent**(`parent`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `parent` | `undefined` \| `FunctionlessNode` |

#### Returns

`void`

#### Inherited from

BaseNode.setParent

#### Defined in

[src/node.ts:35](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L35)

___

### step

▸ **step**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run immediately after this Node.

#### Inherited from

BaseNode.step

#### Defined in

[src/node.ts:137](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L137)

___

### throw

▸ **throw**(): `undefined` \| [`BlockStmt`](BlockStmt.md) \| [`CatchClause`](CatchClause.md)

#### Returns

`undefined` \| [`BlockStmt`](BlockStmt.md) \| [`CatchClause`](CatchClause.md)

the [Stmt](../modules.md#stmt) that will be run if an error was raised from this Node.

#### Inherited from

BaseNode.throw

#### Defined in

[src/node.ts:215](https://github.com/sam-goodwin/functionless/blob/261ad48/src/node.ts#L215)
