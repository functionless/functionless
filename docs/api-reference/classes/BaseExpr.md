[functionless](../README.md) / [Exports](../modules.md) / BaseExpr

# Class: BaseExpr<Kind, Parent\>

## Type parameters

| Name | Type |
| :------ | :------ |
| `Kind` | extends `FunctionlessNode`[``"kind"``] |
| `Parent` | extends `FunctionlessNode` \| `undefined` = [`ExprStmt`](ExprStmt.md) \| [`VariableStmt`](VariableStmt.md) \| [`ReturnStmt`](ReturnStmt.md) \| [`Expr`](../modules.md#expr) \| `undefined` |

## Hierarchy

- `BaseNode`<`Kind`, `Parent`\>

  ↳ **`BaseExpr`**

  ↳↳ [`FunctionExpr`](FunctionExpr.md)

  ↳↳ [`ReferenceExpr`](ReferenceExpr.md)

  ↳↳ [`Identifier`](Identifier.md)

  ↳↳ [`PropAccessExpr`](PropAccessExpr.md)

  ↳↳ [`ElementAccessExpr`](ElementAccessExpr.md)

  ↳↳ [`Argument`](Argument.md)

  ↳↳ [`CallExpr`](CallExpr.md)

  ↳↳ [`NewExpr`](NewExpr.md)

  ↳↳ [`ConditionExpr`](ConditionExpr.md)

  ↳↳ [`BinaryExpr`](BinaryExpr.md)

  ↳↳ [`UnaryExpr`](UnaryExpr.md)

  ↳↳ [`NullLiteralExpr`](NullLiteralExpr.md)

  ↳↳ [`UndefinedLiteralExpr`](UndefinedLiteralExpr.md)

  ↳↳ [`BooleanLiteralExpr`](BooleanLiteralExpr.md)

  ↳↳ [`NumberLiteralExpr`](NumberLiteralExpr.md)

  ↳↳ [`StringLiteralExpr`](StringLiteralExpr.md)

  ↳↳ [`ArrayLiteralExpr`](ArrayLiteralExpr.md)

  ↳↳ [`ObjectLiteralExpr`](ObjectLiteralExpr.md)

  ↳↳ [`PropAssignExpr`](PropAssignExpr.md)

  ↳↳ [`ComputedPropertyNameExpr`](ComputedPropertyNameExpr.md)

  ↳↳ [`SpreadAssignExpr`](SpreadAssignExpr.md)

  ↳↳ [`SpreadElementExpr`](SpreadElementExpr.md)

  ↳↳ [`TemplateExpr`](TemplateExpr.md)

  ↳↳ [`TypeOfExpr`](TypeOfExpr.md)

## Table of contents

### Constructors

- [constructor](BaseExpr.md#constructor)

### Properties

- [children](BaseExpr.md#children)
- [kind](BaseExpr.md#kind)
- [nodeKind](BaseExpr.md#nodekind)
- [parent](BaseExpr.md#parent)

### Methods

- [as](BaseExpr.md#as)
- [clone](BaseExpr.md#clone)
- [collectChildren](BaseExpr.md#collectchildren)
- [contains](BaseExpr.md#contains)
- [exit](BaseExpr.md#exit)
- [findCatchClause](BaseExpr.md#findcatchclause)
- [findChildren](BaseExpr.md#findchildren)
- [findParent](BaseExpr.md#findparent)
- [getLexicalScope](BaseExpr.md#getlexicalscope)
- [getVisibleNames](BaseExpr.md#getvisiblenames)
- [is](BaseExpr.md#is)
- [isTerminal](BaseExpr.md#isterminal)
- [setParent](BaseExpr.md#setparent)
- [step](BaseExpr.md#step)
- [throw](BaseExpr.md#throw)

## Constructors

### constructor

• **new BaseExpr**<`Kind`, `Parent`\>(`kind`)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Kind` | extends ``"FunctionDecl"`` \| ``"CallExpr"`` \| ``"ParameterDecl"`` \| ``"Argument"`` \| ``"ArrayLiteralExpr"`` \| ``"BinaryExpr"`` \| ``"BooleanLiteralExpr"`` \| ``"ConditionExpr"`` \| ``"ComputedPropertyNameExpr"`` \| ``"FunctionExpr"`` \| ``"ElementAccessExpr"`` \| ``"Identifier"`` \| ``"NewExpr"`` \| ``"NullLiteralExpr"`` \| ``"NumberLiteralExpr"`` \| ``"ObjectLiteralExpr"`` \| ``"PropAccessExpr"`` \| ``"PropAssignExpr"`` \| ``"ReferenceExpr"`` \| ``"SpreadAssignExpr"`` \| ``"SpreadElementExpr"`` \| ``"StringLiteralExpr"`` \| ``"TemplateExpr"`` \| ``"TypeOfExpr"`` \| ``"UnaryExpr"`` \| ``"UndefinedLiteralExpr"`` \| ``"BreakStmt"`` \| ``"BlockStmt"`` \| ``"CatchClause"`` \| ``"ContinueStmt"`` \| ``"DoStmt"`` \| ``"ExprStmt"`` \| ``"ForInStmt"`` \| ``"ForOfStmt"`` \| ``"IfStmt"`` \| ``"ReturnStmt"`` \| ``"ThrowStmt"`` \| ``"TryStmt"`` \| ``"VariableStmt"`` \| ``"WhileStmt"`` \| ``"Err"`` |
| `Parent` | extends `undefined` \| `FunctionlessNode` = `undefined` \| [`Expr`](../modules.md#expr) \| [`ExprStmt`](ExprStmt.md) \| [`ReturnStmt`](ReturnStmt.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `kind` | `Kind` |

#### Inherited from

BaseNode<Kind, Parent\>.constructor

#### Defined in

[src/node.ts:31](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L31)

## Properties

### children

• `Readonly` **children**: `FunctionlessNode`[] = `[]`

The immediate Child nodes contained within this Node.

#### Inherited from

BaseNode.children

#### Defined in

[src/node.ts:29](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L29)

___

### kind

• `Readonly` **kind**: `Kind`

#### Inherited from

BaseNode.kind

___

### nodeKind

• `Readonly` **nodeKind**: ``"Expr"``

#### Overrides

BaseNode.nodeKind

#### Defined in

[src/expression.ts:100](https://github.com/sam-goodwin/functionless/blob/a9095de/src/expression.ts#L100)

___

### parent

• **parent**: `Parent`

#### Inherited from

BaseNode.parent

#### Defined in

[src/node.ts:24](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L24)

## Methods

### as

▸ **as**<`K`\>(`kind`): `Extract`<[`BaseExpr`](BaseExpr.md)<`Kind`, `Parent`\>, { `kind`: `K`  }\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends ``"FunctionDecl"`` \| ``"CallExpr"`` \| ``"ParameterDecl"`` \| ``"Argument"`` \| ``"ArrayLiteralExpr"`` \| ``"BinaryExpr"`` \| ``"BooleanLiteralExpr"`` \| ``"ConditionExpr"`` \| ``"ComputedPropertyNameExpr"`` \| ``"FunctionExpr"`` \| ``"ElementAccessExpr"`` \| ``"Identifier"`` \| ``"NewExpr"`` \| ``"NullLiteralExpr"`` \| ``"NumberLiteralExpr"`` \| ``"ObjectLiteralExpr"`` \| ``"PropAccessExpr"`` \| ``"PropAssignExpr"`` \| ``"ReferenceExpr"`` \| ``"SpreadAssignExpr"`` \| ``"SpreadElementExpr"`` \| ``"StringLiteralExpr"`` \| ``"TemplateExpr"`` \| ``"TypeOfExpr"`` \| ``"UnaryExpr"`` \| ``"UndefinedLiteralExpr"`` \| ``"BreakStmt"`` \| ``"BlockStmt"`` \| ``"CatchClause"`` \| ``"ContinueStmt"`` \| ``"DoStmt"`` \| ``"ExprStmt"`` \| ``"ForInStmt"`` \| ``"ForOfStmt"`` \| ``"IfStmt"`` \| ``"ReturnStmt"`` \| ``"ThrowStmt"`` \| ``"TryStmt"`` \| ``"VariableStmt"`` \| ``"WhileStmt"`` \| ``"Err"`` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `kind` | `K` |

#### Returns

`Extract`<[`BaseExpr`](BaseExpr.md)<`Kind`, `Parent`\>, { `kind`: `K`  }\>

#### Inherited from

BaseNode.as

#### Defined in

[src/node.ts:42](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L42)

___

### clone

▸ `Abstract` **clone**(): [`BaseExpr`](BaseExpr.md)<`Kind`, `Parent`\>

#### Returns

[`BaseExpr`](BaseExpr.md)<`Kind`, `Parent`\>

#### Inherited from

BaseNode.clone

#### Defined in

[src/node.ts:33](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L33)

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

[src/node.ts:62](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L62)

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

[src/node.ts:107](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L107)

___

### exit

▸ **exit**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run after exiting the scope of this Node.

#### Inherited from

BaseNode.exit

#### Defined in

[src/node.ts:173](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L173)

___

### findCatchClause

▸ **findCatchClause**(): `undefined` \| [`CatchClause`](CatchClause.md)

Finds the [CatchClause](CatchClause.md) that this Node should throw to.

#### Returns

`undefined` \| [`CatchClause`](CatchClause.md)

#### Inherited from

BaseNode.findCatchClause

#### Defined in

[src/node.ts:84](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L84)

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

[src/node.ts:56](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L56)

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

[src/node.ts:69](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L69)

___

### getLexicalScope

▸ **getLexicalScope**(): `Map`<`string`, [`ParameterDecl`](ParameterDecl.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

#### Returns

`Map`<`string`, [`ParameterDecl`](ParameterDecl.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

a mapping of name to the node visible in this node's scope.

#### Inherited from

BaseNode.getLexicalScope

#### Defined in

[src/node.ts:278](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L278)

___

### getVisibleNames

▸ **getVisibleNames**(): `string`[]

#### Returns

`string`[]

an array of all the visible names in this node's scope.

#### Inherited from

BaseNode.getVisibleNames

#### Defined in

[src/node.ts:271](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L271)

___

### is

▸ **is**<`N`\>(`is`): this is N

#### Type parameters

| Name | Type |
| :------ | :------ |
| `N` | extends [`BaseExpr`](BaseExpr.md)<`Kind`, `Parent`, `N`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `is` | (`node`: [`BaseExpr`](BaseExpr.md)<`Kind`, `Parent`\>) => node is N |

#### Returns

this is N

#### Inherited from

BaseNode.is

#### Defined in

[src/node.ts:52](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L52)

___

### isTerminal

▸ **isTerminal**(): `boolean`

#### Returns

`boolean`

checks if this Node is terminal - meaning all branches explicitly return a value

#### Inherited from

BaseNode.isTerminal

#### Defined in

[src/node.ts:315](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L315)

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

[src/node.ts:35](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L35)

___

### step

▸ **step**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run immediately after this Node.

#### Inherited from

BaseNode.step

#### Defined in

[src/node.ts:137](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L137)

___

### throw

▸ **throw**(): `undefined` \| [`BlockStmt`](BlockStmt.md) \| [`CatchClause`](CatchClause.md)

#### Returns

`undefined` \| [`BlockStmt`](BlockStmt.md) \| [`CatchClause`](CatchClause.md)

the [Stmt](../modules.md#stmt) that will be run if an error was raised from this Node.

#### Inherited from

BaseNode.throw

#### Defined in

[src/node.ts:215](https://github.com/sam-goodwin/functionless/blob/a9095de/src/node.ts#L215)
