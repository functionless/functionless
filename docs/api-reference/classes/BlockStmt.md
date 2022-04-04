[functionless](../README.md) / [Exports](../modules.md) / BlockStmt

# Class: BlockStmt

## Hierarchy

- [`BaseStmt`](BaseStmt.md)<``"BlockStmt"``, [`BlockStmtParent`](../modules.md#blockstmtparent)\>

  ↳ **`BlockStmt`**

  ↳↳ [`FinallyBlock`](../interfaces/FinallyBlock.md)

## Table of contents

### Constructors

- [constructor](BlockStmt.md#constructor)

### Properties

- [children](BlockStmt.md#children)
- [kind](BlockStmt.md#kind)
- [next](BlockStmt.md#next)
- [nodeKind](BlockStmt.md#nodekind)
- [parent](BlockStmt.md#parent)
- [prev](BlockStmt.md#prev)
- [statements](BlockStmt.md#statements)

### Accessors

- [firstStmt](BlockStmt.md#firststmt)
- [lastStmt](BlockStmt.md#laststmt)

### Methods

- [as](BlockStmt.md#as)
- [clone](BlockStmt.md#clone)
- [collectChildren](BlockStmt.md#collectchildren)
- [contains](BlockStmt.md#contains)
- [exit](BlockStmt.md#exit)
- [findCatchClause](BlockStmt.md#findcatchclause)
- [findChildren](BlockStmt.md#findchildren)
- [findParent](BlockStmt.md#findparent)
- [getLexicalScope](BlockStmt.md#getlexicalscope)
- [getVisibleNames](BlockStmt.md#getvisiblenames)
- [is](BlockStmt.md#is)
- [isEmpty](BlockStmt.md#isempty)
- [isFinallyBlock](BlockStmt.md#isfinallyblock)
- [isNotEmpty](BlockStmt.md#isnotempty)
- [isTerminal](BlockStmt.md#isterminal)
- [setParent](BlockStmt.md#setparent)
- [step](BlockStmt.md#step)
- [throw](BlockStmt.md#throw)

## Constructors

### constructor

• **new BlockStmt**(`statements`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `statements` | [`Stmt`](../modules.md#stmt)[] |

#### Overrides

[BaseStmt](BaseStmt.md).[constructor](BaseStmt.md#constructor)

#### Defined in

[src/statement.ts:110](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L110)

## Properties

### children

• `Readonly` **children**: `FunctionlessNode`[] = `[]`

The immediate Child nodes contained within this Node.

#### Inherited from

[BaseStmt](BaseStmt.md).[children](BaseStmt.md#children)

#### Defined in

[src/node.ts:29](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L29)

___

### kind

• `Readonly` **kind**: ``"BlockStmt"``

#### Inherited from

[BaseStmt](BaseStmt.md).[kind](BaseStmt.md#kind)

___

### next

• **next**: `undefined` \| [`Stmt`](../modules.md#stmt)

Node that is subsequent to this node.

#### Inherited from

[BaseStmt](BaseStmt.md).[next](BaseStmt.md#next)

#### Defined in

[src/statement.ts:56](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L56)

___

### nodeKind

• `Readonly` **nodeKind**: ``"Stmt"``

#### Inherited from

[BaseStmt](BaseStmt.md).[nodeKind](BaseStmt.md#nodekind)

#### Defined in

[src/statement.ts:47](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L47)

___

### parent

• **parent**: [`BlockStmtParent`](../modules.md#blockstmtparent)

#### Inherited from

[BaseStmt](BaseStmt.md).[parent](BaseStmt.md#parent)

#### Defined in

[src/node.ts:24](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L24)

___

### prev

• **prev**: `undefined` \| [`Stmt`](../modules.md#stmt)

Node that is prior to this node.

#### Inherited from

[BaseStmt](BaseStmt.md).[prev](BaseStmt.md#prev)

#### Defined in

[src/statement.ts:52](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L52)

___

### statements

• `Readonly` **statements**: [`Stmt`](../modules.md#stmt)[]

## Accessors

### firstStmt

• `get` **firstStmt**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

#### Defined in

[src/statement.ts:139](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L139)

___

### lastStmt

• `get` **lastStmt**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

#### Defined in

[src/statement.ts:143](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L143)

## Methods

### as

▸ **as**<`K`\>(`kind`): `Extract`<[`BlockStmt`](BlockStmt.md), { `kind`: `K`  }\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends ``"FunctionDecl"`` \| ``"CallExpr"`` \| ``"ParameterDecl"`` \| ``"Argument"`` \| ``"ArrayLiteralExpr"`` \| ``"BinaryExpr"`` \| ``"BooleanLiteralExpr"`` \| ``"ConditionExpr"`` \| ``"ComputedPropertyNameExpr"`` \| ``"FunctionExpr"`` \| ``"ElementAccessExpr"`` \| ``"Identifier"`` \| ``"NewExpr"`` \| ``"NullLiteralExpr"`` \| ``"NumberLiteralExpr"`` \| ``"ObjectLiteralExpr"`` \| ``"PropAccessExpr"`` \| ``"PropAssignExpr"`` \| ``"ReferenceExpr"`` \| ``"SpreadAssignExpr"`` \| ``"SpreadElementExpr"`` \| ``"StringLiteralExpr"`` \| ``"TemplateExpr"`` \| ``"TypeOfExpr"`` \| ``"UnaryExpr"`` \| ``"UndefinedLiteralExpr"`` \| ``"BreakStmt"`` \| ``"BlockStmt"`` \| ``"CatchClause"`` \| ``"ContinueStmt"`` \| ``"DoStmt"`` \| ``"ExprStmt"`` \| ``"ForInStmt"`` \| ``"ForOfStmt"`` \| ``"IfStmt"`` \| ``"ReturnStmt"`` \| ``"ThrowStmt"`` \| ``"TryStmt"`` \| ``"VariableStmt"`` \| ``"WhileStmt"`` \| ``"Err"`` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `kind` | `K` |

#### Returns

`Extract`<[`BlockStmt`](BlockStmt.md), { `kind`: `K`  }\>

#### Inherited from

[BaseStmt](BaseStmt.md).[as](BaseStmt.md#as)

#### Defined in

[src/node.ts:42](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L42)

___

### clone

▸ **clone**(): [`BlockStmt`](BlockStmt.md)

#### Returns

[`BlockStmt`](BlockStmt.md)

#### Overrides

[BaseStmt](BaseStmt.md).[clone](BaseStmt.md#clone)

#### Defined in

[src/statement.ts:119](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L119)

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

[BaseStmt](BaseStmt.md).[collectChildren](BaseStmt.md#collectchildren)

#### Defined in

[src/node.ts:62](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L62)

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

[BaseStmt](BaseStmt.md).[contains](BaseStmt.md#contains)

#### Defined in

[src/node.ts:107](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L107)

___

### exit

▸ **exit**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run after exiting the scope of this Node.

#### Inherited from

[BaseStmt](BaseStmt.md).[exit](BaseStmt.md#exit)

#### Defined in

[src/node.ts:173](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L173)

___

### findCatchClause

▸ **findCatchClause**(): `undefined` \| [`CatchClause`](CatchClause.md)

Finds the [CatchClause](CatchClause.md) that this Node should throw to.

#### Returns

`undefined` \| [`CatchClause`](CatchClause.md)

#### Inherited from

[BaseStmt](BaseStmt.md).[findCatchClause](BaseStmt.md#findcatchclause)

#### Defined in

[src/node.ts:84](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L84)

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

[BaseStmt](BaseStmt.md).[findChildren](BaseStmt.md#findchildren)

#### Defined in

[src/node.ts:56](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L56)

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

[BaseStmt](BaseStmt.md).[findParent](BaseStmt.md#findparent)

#### Defined in

[src/node.ts:69](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L69)

___

### getLexicalScope

▸ **getLexicalScope**(): `Map`<`string`, [`ParameterDecl`](ParameterDecl.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

#### Returns

`Map`<`string`, [`ParameterDecl`](ParameterDecl.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

a mapping of name to the node visible in this node's scope.

#### Inherited from

[BaseStmt](BaseStmt.md).[getLexicalScope](BaseStmt.md#getlexicalscope)

#### Defined in

[src/node.ts:278](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L278)

___

### getVisibleNames

▸ **getVisibleNames**(): `string`[]

#### Returns

`string`[]

an array of all the visible names in this node's scope.

#### Inherited from

[BaseStmt](BaseStmt.md).[getVisibleNames](BaseStmt.md#getvisiblenames)

#### Defined in

[src/node.ts:271](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L271)

___

### is

▸ **is**<`N`\>(`is`): this is N

#### Type parameters

| Name | Type |
| :------ | :------ |
| `N` | extends [`BlockStmt`](BlockStmt.md)<`N`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `is` | (`node`: [`BlockStmt`](BlockStmt.md)) => node is N |

#### Returns

this is N

#### Inherited from

[BaseStmt](BaseStmt.md).[is](BaseStmt.md#is)

#### Defined in

[src/node.ts:52](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L52)

___

### isEmpty

▸ **isEmpty**(): this is Object

#### Returns

this is Object

#### Defined in

[src/statement.ts:127](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L127)

___

### isFinallyBlock

▸ **isFinallyBlock**(): this is FinallyBlock

#### Returns

this is FinallyBlock

#### Defined in

[src/statement.ts:123](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L123)

___

### isNotEmpty

▸ **isNotEmpty**(): this is Object

#### Returns

this is Object

#### Defined in

[src/statement.ts:133](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L133)

___

### isTerminal

▸ **isTerminal**(): `boolean`

#### Returns

`boolean`

checks if this Node is terminal - meaning all branches explicitly return a value

#### Inherited from

[BaseStmt](BaseStmt.md).[isTerminal](BaseStmt.md#isterminal)

#### Defined in

[src/node.ts:315](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L315)

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

[BaseStmt](BaseStmt.md).[setParent](BaseStmt.md#setparent)

#### Defined in

[src/node.ts:35](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L35)

___

### step

▸ **step**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run immediately after this Node.

#### Inherited from

[BaseStmt](BaseStmt.md).[step](BaseStmt.md#step)

#### Defined in

[src/node.ts:137](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L137)

___

### throw

▸ **throw**(): `undefined` \| [`BlockStmt`](BlockStmt.md) \| [`CatchClause`](CatchClause.md)

#### Returns

`undefined` \| [`BlockStmt`](BlockStmt.md) \| [`CatchClause`](CatchClause.md)

the [Stmt](../modules.md#stmt) that will be run if an error was raised from this Node.

#### Inherited from

[BaseStmt](BaseStmt.md).[throw](BaseStmt.md#throw)

#### Defined in

[src/node.ts:215](https://github.com/sam-goodwin/functionless/blob/6691871/src/node.ts#L215)
