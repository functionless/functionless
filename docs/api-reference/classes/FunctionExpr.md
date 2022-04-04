[functionless](../README.md) / [Exports](../modules.md) / FunctionExpr

# Class: FunctionExpr<F\>

## Type parameters

| Name | Type |
| :------ | :------ |
| `F` | extends [`AnyFunction`](../modules.md#anyfunction) = [`AnyFunction`](../modules.md#anyfunction) |

## Hierarchy

- [`BaseExpr`](BaseExpr.md)<``"FunctionExpr"``\>

  ↳ **`FunctionExpr`**

## Table of contents

### Constructors

- [constructor](FunctionExpr.md#constructor)

### Properties

- [\_functionBrand](FunctionExpr.md#_functionbrand)
- [body](FunctionExpr.md#body)
- [children](FunctionExpr.md#children)
- [kind](FunctionExpr.md#kind)
- [nodeKind](FunctionExpr.md#nodekind)
- [parameters](FunctionExpr.md#parameters)
- [parent](FunctionExpr.md#parent)

### Methods

- [as](FunctionExpr.md#as)
- [clone](FunctionExpr.md#clone)
- [collectChildren](FunctionExpr.md#collectchildren)
- [contains](FunctionExpr.md#contains)
- [exit](FunctionExpr.md#exit)
- [findCatchClause](FunctionExpr.md#findcatchclause)
- [findChildren](FunctionExpr.md#findchildren)
- [findParent](FunctionExpr.md#findparent)
- [getLexicalScope](FunctionExpr.md#getlexicalscope)
- [getVisibleNames](FunctionExpr.md#getvisiblenames)
- [is](FunctionExpr.md#is)
- [isTerminal](FunctionExpr.md#isterminal)
- [setParent](FunctionExpr.md#setparent)
- [step](FunctionExpr.md#step)
- [throw](FunctionExpr.md#throw)

## Constructors

### constructor

• **new FunctionExpr**<`F`\>(`parameters`, `body`)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `F` | extends [`AnyFunction`](../modules.md#anyfunction) = [`AnyFunction`](../modules.md#anyfunction) |

#### Parameters

| Name | Type |
| :------ | :------ |
| `parameters` | [`ParameterDecl`](ParameterDecl.md)[] |
| `body` | [`BlockStmt`](BlockStmt.md) |

#### Overrides

[BaseExpr](BaseExpr.md).[constructor](BaseExpr.md#constructor)

#### Defined in

[src/expression.ts:109](https://github.com/sam-goodwin/functionless/blob/3947743/src/expression.ts#L109)

## Properties

### \_functionBrand

• `Optional` `Readonly` **\_functionBrand**: `F`

#### Defined in

[src/expression.ts:108](https://github.com/sam-goodwin/functionless/blob/3947743/src/expression.ts#L108)

___

### body

• `Readonly` **body**: [`BlockStmt`](BlockStmt.md)

___

### children

• `Readonly` **children**: `FunctionlessNode`[] = `[]`

The immediate Child nodes contained within this Node.

#### Inherited from

[BaseExpr](BaseExpr.md).[children](BaseExpr.md#children)

#### Defined in

[src/node.ts:29](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L29)

___

### kind

• `Readonly` **kind**: ``"FunctionExpr"``

#### Inherited from

[BaseExpr](BaseExpr.md).[kind](BaseExpr.md#kind)

___

### nodeKind

• `Readonly` **nodeKind**: ``"Expr"``

#### Inherited from

[BaseExpr](BaseExpr.md).[nodeKind](BaseExpr.md#nodekind)

#### Defined in

[src/expression.ts:100](https://github.com/sam-goodwin/functionless/blob/3947743/src/expression.ts#L100)

___

### parameters

• `Readonly` **parameters**: [`ParameterDecl`](ParameterDecl.md)[]

___

### parent

• **parent**: `undefined` \| [`Expr`](../modules.md#expr) \| [`ExprStmt`](ExprStmt.md) \| [`ReturnStmt`](ReturnStmt.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>

#### Inherited from

[BaseExpr](BaseExpr.md).[parent](BaseExpr.md#parent)

#### Defined in

[src/node.ts:24](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L24)

## Methods

### as

▸ **as**<`K`\>(`kind`): `Extract`<[`FunctionExpr`](FunctionExpr.md)<`F`\>, { `kind`: `K`  }\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends ``"FunctionDecl"`` \| ``"CallExpr"`` \| ``"ParameterDecl"`` \| ``"Argument"`` \| ``"ArrayLiteralExpr"`` \| ``"BinaryExpr"`` \| ``"BooleanLiteralExpr"`` \| ``"ConditionExpr"`` \| ``"ComputedPropertyNameExpr"`` \| ``"FunctionExpr"`` \| ``"ElementAccessExpr"`` \| ``"Identifier"`` \| ``"NewExpr"`` \| ``"NullLiteralExpr"`` \| ``"NumberLiteralExpr"`` \| ``"ObjectLiteralExpr"`` \| ``"PropAccessExpr"`` \| ``"PropAssignExpr"`` \| ``"ReferenceExpr"`` \| ``"SpreadAssignExpr"`` \| ``"SpreadElementExpr"`` \| ``"StringLiteralExpr"`` \| ``"TemplateExpr"`` \| ``"TypeOfExpr"`` \| ``"UnaryExpr"`` \| ``"UndefinedLiteralExpr"`` \| ``"BreakStmt"`` \| ``"BlockStmt"`` \| ``"CatchClause"`` \| ``"ContinueStmt"`` \| ``"DoStmt"`` \| ``"ExprStmt"`` \| ``"ForInStmt"`` \| ``"ForOfStmt"`` \| ``"IfStmt"`` \| ``"ReturnStmt"`` \| ``"ThrowStmt"`` \| ``"TryStmt"`` \| ``"VariableStmt"`` \| ``"WhileStmt"`` \| ``"Err"`` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `kind` | `K` |

#### Returns

`Extract`<[`FunctionExpr`](FunctionExpr.md)<`F`\>, { `kind`: `K`  }\>

#### Inherited from

[BaseExpr](BaseExpr.md).[as](BaseExpr.md#as)

#### Defined in

[src/node.ts:42](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L42)

___

### clone

▸ **clone**(): [`FunctionExpr`](FunctionExpr.md)<`F`\>

#### Returns

[`FunctionExpr`](FunctionExpr.md)<`F`\>

#### Overrides

[BaseExpr](BaseExpr.md).[clone](BaseExpr.md#clone)

#### Defined in

[src/expression.ts:115](https://github.com/sam-goodwin/functionless/blob/3947743/src/expression.ts#L115)

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

[BaseExpr](BaseExpr.md).[collectChildren](BaseExpr.md#collectchildren)

#### Defined in

[src/node.ts:62](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L62)

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

[BaseExpr](BaseExpr.md).[contains](BaseExpr.md#contains)

#### Defined in

[src/node.ts:107](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L107)

___

### exit

▸ **exit**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run after exiting the scope of this Node.

#### Inherited from

[BaseExpr](BaseExpr.md).[exit](BaseExpr.md#exit)

#### Defined in

[src/node.ts:173](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L173)

___

### findCatchClause

▸ **findCatchClause**(): `undefined` \| [`CatchClause`](CatchClause.md)

Finds the [CatchClause](CatchClause.md) that this Node should throw to.

#### Returns

`undefined` \| [`CatchClause`](CatchClause.md)

#### Inherited from

[BaseExpr](BaseExpr.md).[findCatchClause](BaseExpr.md#findcatchclause)

#### Defined in

[src/node.ts:84](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L84)

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

[BaseExpr](BaseExpr.md).[findChildren](BaseExpr.md#findchildren)

#### Defined in

[src/node.ts:56](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L56)

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

[BaseExpr](BaseExpr.md).[findParent](BaseExpr.md#findparent)

#### Defined in

[src/node.ts:69](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L69)

___

### getLexicalScope

▸ **getLexicalScope**(): `Map`<`string`, [`ParameterDecl`](ParameterDecl.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

#### Returns

`Map`<`string`, [`ParameterDecl`](ParameterDecl.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

a mapping of name to the node visible in this node's scope.

#### Inherited from

[BaseExpr](BaseExpr.md).[getLexicalScope](BaseExpr.md#getlexicalscope)

#### Defined in

[src/node.ts:278](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L278)

___

### getVisibleNames

▸ **getVisibleNames**(): `string`[]

#### Returns

`string`[]

an array of all the visible names in this node's scope.

#### Inherited from

[BaseExpr](BaseExpr.md).[getVisibleNames](BaseExpr.md#getvisiblenames)

#### Defined in

[src/node.ts:271](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L271)

___

### is

▸ **is**<`N`\>(`is`): this is N

#### Type parameters

| Name | Type |
| :------ | :------ |
| `N` | extends [`FunctionExpr`](FunctionExpr.md)<`F`, `N`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `is` | (`node`: [`FunctionExpr`](FunctionExpr.md)<`F`\>) => node is N |

#### Returns

this is N

#### Inherited from

[BaseExpr](BaseExpr.md).[is](BaseExpr.md#is)

#### Defined in

[src/node.ts:52](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L52)

___

### isTerminal

▸ **isTerminal**(): `boolean`

#### Returns

`boolean`

checks if this Node is terminal - meaning all branches explicitly return a value

#### Inherited from

[BaseExpr](BaseExpr.md).[isTerminal](BaseExpr.md#isterminal)

#### Defined in

[src/node.ts:315](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L315)

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

[BaseExpr](BaseExpr.md).[setParent](BaseExpr.md#setparent)

#### Defined in

[src/node.ts:35](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L35)

___

### step

▸ **step**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run immediately after this Node.

#### Inherited from

[BaseExpr](BaseExpr.md).[step](BaseExpr.md#step)

#### Defined in

[src/node.ts:137](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L137)

___

### throw

▸ **throw**(): `undefined` \| [`BlockStmt`](BlockStmt.md) \| [`CatchClause`](CatchClause.md)

#### Returns

`undefined` \| [`BlockStmt`](BlockStmt.md) \| [`CatchClause`](CatchClause.md)

the [Stmt](../modules.md#stmt) that will be run if an error was raised from this Node.

#### Inherited from

[BaseExpr](BaseExpr.md).[throw](BaseExpr.md#throw)

#### Defined in

[src/node.ts:215](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L215)
