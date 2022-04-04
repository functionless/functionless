[functionless](../README.md) / [Exports](../modules.md) / FinallyBlock

# Interface: FinallyBlock

## Hierarchy

- [`BlockStmt`](../classes/BlockStmt.md)

  ↳ **`FinallyBlock`**

## Table of contents

### Properties

- [children](FinallyBlock.md#children)
- [kind](FinallyBlock.md#kind)
- [next](FinallyBlock.md#next)
- [nodeKind](FinallyBlock.md#nodekind)
- [parent](FinallyBlock.md#parent)
- [prev](FinallyBlock.md#prev)
- [statements](FinallyBlock.md#statements)

### Accessors

- [firstStmt](FinallyBlock.md#firststmt)
- [lastStmt](FinallyBlock.md#laststmt)

### Methods

- [as](FinallyBlock.md#as)
- [clone](FinallyBlock.md#clone)
- [collectChildren](FinallyBlock.md#collectchildren)
- [contains](FinallyBlock.md#contains)
- [exit](FinallyBlock.md#exit)
- [findCatchClause](FinallyBlock.md#findcatchclause)
- [findChildren](FinallyBlock.md#findchildren)
- [findParent](FinallyBlock.md#findparent)
- [getLexicalScope](FinallyBlock.md#getlexicalscope)
- [getVisibleNames](FinallyBlock.md#getvisiblenames)
- [is](FinallyBlock.md#is)
- [isEmpty](FinallyBlock.md#isempty)
- [isFinallyBlock](FinallyBlock.md#isfinallyblock)
- [isNotEmpty](FinallyBlock.md#isnotempty)
- [isTerminal](FinallyBlock.md#isterminal)
- [setParent](FinallyBlock.md#setparent)
- [step](FinallyBlock.md#step)
- [throw](FinallyBlock.md#throw)

## Properties

### children

• `Readonly` **children**: `FunctionlessNode`[] = `[]`

The immediate Child nodes contained within this Node.

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[children](../classes/BlockStmt.md#children)

#### Defined in

[src/node.ts:29](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L29)

___

### kind

• `Readonly` **kind**: ``"BlockStmt"``

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[kind](../classes/BlockStmt.md#kind)

___

### next

• **next**: `undefined` \| [`Stmt`](../modules.md#stmt)

Node that is subsequent to this node.

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[next](../classes/BlockStmt.md#next)

#### Defined in

[src/statement.ts:56](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/statement.ts#L56)

___

### nodeKind

• `Readonly` **nodeKind**: ``"Stmt"``

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[nodeKind](../classes/BlockStmt.md#nodekind)

#### Defined in

[src/statement.ts:47](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/statement.ts#L47)

___

### parent

• **parent**: [`TryStmt`](../classes/TryStmt.md) & { `finallyBlock`: [`FinallyBlock`](FinallyBlock.md)  }

#### Overrides

[BlockStmt](../classes/BlockStmt.md).[parent](../classes/BlockStmt.md#parent)

#### Defined in

[src/statement.ts:261](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/statement.ts#L261)

___

### prev

• **prev**: `undefined` \| [`Stmt`](../modules.md#stmt)

Node that is prior to this node.

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[prev](../classes/BlockStmt.md#prev)

#### Defined in

[src/statement.ts:52](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/statement.ts#L52)

___

### statements

• `Readonly` **statements**: [`Stmt`](../modules.md#stmt)[]

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[statements](../classes/BlockStmt.md#statements)

## Accessors

### firstStmt

• `get` **firstStmt**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

#### Inherited from

BlockStmt.firstStmt

#### Defined in

[src/statement.ts:139](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/statement.ts#L139)

___

### lastStmt

• `get` **lastStmt**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

#### Inherited from

BlockStmt.lastStmt

#### Defined in

[src/statement.ts:143](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/statement.ts#L143)

## Methods

### as

▸ **as**<`K`\>(`kind`): `Extract`<[`FinallyBlock`](FinallyBlock.md), { `kind`: `K`  }\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends ``"FunctionDecl"`` \| ``"CallExpr"`` \| ``"ParameterDecl"`` \| ``"Argument"`` \| ``"ArrayLiteralExpr"`` \| ``"BinaryExpr"`` \| ``"BooleanLiteralExpr"`` \| ``"ConditionExpr"`` \| ``"ComputedPropertyNameExpr"`` \| ``"FunctionExpr"`` \| ``"ElementAccessExpr"`` \| ``"Identifier"`` \| ``"NewExpr"`` \| ``"NullLiteralExpr"`` \| ``"NumberLiteralExpr"`` \| ``"ObjectLiteralExpr"`` \| ``"PropAccessExpr"`` \| ``"PropAssignExpr"`` \| ``"ReferenceExpr"`` \| ``"SpreadAssignExpr"`` \| ``"SpreadElementExpr"`` \| ``"StringLiteralExpr"`` \| ``"TemplateExpr"`` \| ``"TypeOfExpr"`` \| ``"UnaryExpr"`` \| ``"UndefinedLiteralExpr"`` \| ``"BreakStmt"`` \| ``"BlockStmt"`` \| ``"CatchClause"`` \| ``"ContinueStmt"`` \| ``"DoStmt"`` \| ``"ExprStmt"`` \| ``"ForInStmt"`` \| ``"ForOfStmt"`` \| ``"IfStmt"`` \| ``"ReturnStmt"`` \| ``"ThrowStmt"`` \| ``"TryStmt"`` \| ``"VariableStmt"`` \| ``"WhileStmt"`` \| ``"Err"`` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `kind` | `K` |

#### Returns

`Extract`<[`FinallyBlock`](FinallyBlock.md), { `kind`: `K`  }\>

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[as](../classes/BlockStmt.md#as)

#### Defined in

[src/node.ts:42](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L42)

___

### clone

▸ **clone**(): [`FinallyBlock`](FinallyBlock.md)

#### Returns

[`FinallyBlock`](FinallyBlock.md)

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[clone](../classes/BlockStmt.md#clone)

#### Defined in

[src/statement.ts:119](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/statement.ts#L119)

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

[BlockStmt](../classes/BlockStmt.md).[collectChildren](../classes/BlockStmt.md#collectchildren)

#### Defined in

[src/node.ts:62](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L62)

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

[BlockStmt](../classes/BlockStmt.md).[contains](../classes/BlockStmt.md#contains)

#### Defined in

[src/node.ts:107](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L107)

___

### exit

▸ **exit**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run after exiting the scope of this Node.

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[exit](../classes/BlockStmt.md#exit)

#### Defined in

[src/node.ts:173](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L173)

___

### findCatchClause

▸ **findCatchClause**(): `undefined` \| [`CatchClause`](../classes/CatchClause.md)

Finds the [CatchClause](../classes/CatchClause.md) that this Node should throw to.

#### Returns

`undefined` \| [`CatchClause`](../classes/CatchClause.md)

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[findCatchClause](../classes/BlockStmt.md#findcatchclause)

#### Defined in

[src/node.ts:84](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L84)

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

[BlockStmt](../classes/BlockStmt.md).[findChildren](../classes/BlockStmt.md#findchildren)

#### Defined in

[src/node.ts:56](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L56)

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

[BlockStmt](../classes/BlockStmt.md).[findParent](../classes/BlockStmt.md#findparent)

#### Defined in

[src/node.ts:69](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L69)

___

### getLexicalScope

▸ **getLexicalScope**(): `Map`<`string`, [`ParameterDecl`](../classes/ParameterDecl.md) \| [`VariableStmt`](../classes/VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

#### Returns

`Map`<`string`, [`ParameterDecl`](../classes/ParameterDecl.md) \| [`VariableStmt`](../classes/VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

a mapping of name to the node visible in this node's scope.

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[getLexicalScope](../classes/BlockStmt.md#getlexicalscope)

#### Defined in

[src/node.ts:278](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L278)

___

### getVisibleNames

▸ **getVisibleNames**(): `string`[]

#### Returns

`string`[]

an array of all the visible names in this node's scope.

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[getVisibleNames](../classes/BlockStmt.md#getvisiblenames)

#### Defined in

[src/node.ts:271](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L271)

___

### is

▸ **is**<`N`\>(`is`): this is N

#### Type parameters

| Name | Type |
| :------ | :------ |
| `N` | extends [`FinallyBlock`](FinallyBlock.md)<`N`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `is` | (`node`: [`FinallyBlock`](FinallyBlock.md)) => node is N |

#### Returns

this is N

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[is](../classes/BlockStmt.md#is)

#### Defined in

[src/node.ts:52](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L52)

___

### isEmpty

▸ **isEmpty**(): this is Object

#### Returns

this is Object

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[isEmpty](../classes/BlockStmt.md#isempty)

#### Defined in

[src/statement.ts:127](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/statement.ts#L127)

___

### isFinallyBlock

▸ **isFinallyBlock**(): this is FinallyBlock

#### Returns

this is FinallyBlock

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[isFinallyBlock](../classes/BlockStmt.md#isfinallyblock)

#### Defined in

[src/statement.ts:123](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/statement.ts#L123)

___

### isNotEmpty

▸ **isNotEmpty**(): this is Object

#### Returns

this is Object

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[isNotEmpty](../classes/BlockStmt.md#isnotempty)

#### Defined in

[src/statement.ts:133](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/statement.ts#L133)

___

### isTerminal

▸ **isTerminal**(): `boolean`

#### Returns

`boolean`

checks if this Node is terminal - meaning all branches explicitly return a value

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[isTerminal](../classes/BlockStmt.md#isterminal)

#### Defined in

[src/node.ts:315](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L315)

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

[BlockStmt](../classes/BlockStmt.md).[setParent](../classes/BlockStmt.md#setparent)

#### Defined in

[src/node.ts:35](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L35)

___

### step

▸ **step**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run immediately after this Node.

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[step](../classes/BlockStmt.md#step)

#### Defined in

[src/node.ts:137](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L137)

___

### throw

▸ **throw**(): `undefined` \| [`BlockStmt`](../classes/BlockStmt.md) \| [`CatchClause`](../classes/CatchClause.md)

#### Returns

`undefined` \| [`BlockStmt`](../classes/BlockStmt.md) \| [`CatchClause`](../classes/CatchClause.md)

the [Stmt](../modules.md#stmt) that will be run if an error was raised from this Node.

#### Inherited from

[BlockStmt](../classes/BlockStmt.md).[throw](../classes/BlockStmt.md#throw)

#### Defined in

[src/node.ts:215](https://github.com/sam-goodwin/functionless/blob/8f02ec6/src/node.ts#L215)
