[functionless](../README.md) / [Exports](../modules.md) / FunctionDecl

# Class: FunctionDecl<F\>

## Type parameters

| Name | Type |
| :------ | :------ |
| `F` | extends [`AnyFunction`](../modules.md#anyfunction) = [`AnyFunction`](../modules.md#anyfunction) |

## Hierarchy

- `BaseDecl`<``"FunctionDecl"``, `undefined`\>

  ↳ **`FunctionDecl`**

## Table of contents

### Constructors

- [constructor](FunctionDecl.md#constructor)

### Properties

- [\_functionBrand](FunctionDecl.md#_functionbrand)
- [body](FunctionDecl.md#body)
- [children](FunctionDecl.md#children)
- [kind](FunctionDecl.md#kind)
- [nodeKind](FunctionDecl.md#nodekind)
- [parameters](FunctionDecl.md#parameters)
- [parent](FunctionDecl.md#parent)

### Methods

- [as](FunctionDecl.md#as)
- [clone](FunctionDecl.md#clone)
- [collectChildren](FunctionDecl.md#collectchildren)
- [contains](FunctionDecl.md#contains)
- [exit](FunctionDecl.md#exit)
- [findCatchClause](FunctionDecl.md#findcatchclause)
- [findChildren](FunctionDecl.md#findchildren)
- [findParent](FunctionDecl.md#findparent)
- [getLexicalScope](FunctionDecl.md#getlexicalscope)
- [getVisibleNames](FunctionDecl.md#getvisiblenames)
- [is](FunctionDecl.md#is)
- [isTerminal](FunctionDecl.md#isterminal)
- [setParent](FunctionDecl.md#setparent)
- [step](FunctionDecl.md#step)
- [throw](FunctionDecl.md#throw)

## Constructors

### constructor

• **new FunctionDecl**<`F`\>(`parameters`, `body`)

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

BaseDecl&lt;
  &quot;FunctionDecl&quot;,
  undefined
\&gt;.constructor

#### Defined in

[src/declaration.ts:26](https://github.com/sam-goodwin/functionless/blob/3947743/src/declaration.ts#L26)

## Properties

### \_functionBrand

• `Optional` `Readonly` **\_functionBrand**: `F`

#### Defined in

[src/declaration.ts:25](https://github.com/sam-goodwin/functionless/blob/3947743/src/declaration.ts#L25)

___

### body

• `Readonly` **body**: [`BlockStmt`](BlockStmt.md)

___

### children

• `Readonly` **children**: `FunctionlessNode`[] = `[]`

The immediate Child nodes contained within this Node.

#### Inherited from

BaseDecl.children

#### Defined in

[src/node.ts:29](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L29)

___

### kind

• `Readonly` **kind**: ``"FunctionDecl"``

#### Inherited from

BaseDecl.kind

___

### nodeKind

• `Readonly` **nodeKind**: ``"Decl"``

#### Inherited from

BaseDecl.nodeKind

#### Defined in

[src/declaration.ts:18](https://github.com/sam-goodwin/functionless/blob/3947743/src/declaration.ts#L18)

___

### parameters

• `Readonly` **parameters**: [`ParameterDecl`](ParameterDecl.md)[]

___

### parent

• **parent**: `undefined`

#### Inherited from

BaseDecl.parent

#### Defined in

[src/node.ts:24](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L24)

## Methods

### as

▸ **as**<`K`\>(`kind`): `Extract`<[`FunctionDecl`](FunctionDecl.md)<`F`\>, { `kind`: `K`  }\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends ``"FunctionDecl"`` \| ``"CallExpr"`` \| ``"ParameterDecl"`` \| ``"Argument"`` \| ``"ArrayLiteralExpr"`` \| ``"BinaryExpr"`` \| ``"BooleanLiteralExpr"`` \| ``"ConditionExpr"`` \| ``"ComputedPropertyNameExpr"`` \| ``"FunctionExpr"`` \| ``"ElementAccessExpr"`` \| ``"Identifier"`` \| ``"NewExpr"`` \| ``"NullLiteralExpr"`` \| ``"NumberLiteralExpr"`` \| ``"ObjectLiteralExpr"`` \| ``"PropAccessExpr"`` \| ``"PropAssignExpr"`` \| ``"ReferenceExpr"`` \| ``"SpreadAssignExpr"`` \| ``"SpreadElementExpr"`` \| ``"StringLiteralExpr"`` \| ``"TemplateExpr"`` \| ``"TypeOfExpr"`` \| ``"UnaryExpr"`` \| ``"UndefinedLiteralExpr"`` \| ``"BreakStmt"`` \| ``"BlockStmt"`` \| ``"CatchClause"`` \| ``"ContinueStmt"`` \| ``"DoStmt"`` \| ``"ExprStmt"`` \| ``"ForInStmt"`` \| ``"ForOfStmt"`` \| ``"IfStmt"`` \| ``"ReturnStmt"`` \| ``"ThrowStmt"`` \| ``"TryStmt"`` \| ``"VariableStmt"`` \| ``"WhileStmt"`` \| ``"Err"`` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `kind` | `K` |

#### Returns

`Extract`<[`FunctionDecl`](FunctionDecl.md)<`F`\>, { `kind`: `K`  }\>

#### Inherited from

BaseDecl.as

#### Defined in

[src/node.ts:42](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L42)

___

### clone

▸ **clone**(): [`FunctionDecl`](FunctionDecl.md)<`F`\>

#### Returns

[`FunctionDecl`](FunctionDecl.md)<`F`\>

#### Overrides

BaseDecl.clone

#### Defined in

[src/declaration.ts:32](https://github.com/sam-goodwin/functionless/blob/3947743/src/declaration.ts#L32)

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

BaseDecl.collectChildren

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

BaseDecl.contains

#### Defined in

[src/node.ts:107](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L107)

___

### exit

▸ **exit**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run after exiting the scope of this Node.

#### Inherited from

BaseDecl.exit

#### Defined in

[src/node.ts:173](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L173)

___

### findCatchClause

▸ **findCatchClause**(): `undefined` \| [`CatchClause`](CatchClause.md)

Finds the [CatchClause](CatchClause.md) that this Node should throw to.

#### Returns

`undefined` \| [`CatchClause`](CatchClause.md)

#### Inherited from

BaseDecl.findCatchClause

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

BaseDecl.findChildren

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

BaseDecl.findParent

#### Defined in

[src/node.ts:69](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L69)

___

### getLexicalScope

▸ **getLexicalScope**(): `Map`<`string`, [`ParameterDecl`](ParameterDecl.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

#### Returns

`Map`<`string`, [`ParameterDecl`](ParameterDecl.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

a mapping of name to the node visible in this node's scope.

#### Inherited from

BaseDecl.getLexicalScope

#### Defined in

[src/node.ts:278](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L278)

___

### getVisibleNames

▸ **getVisibleNames**(): `string`[]

#### Returns

`string`[]

an array of all the visible names in this node's scope.

#### Inherited from

BaseDecl.getVisibleNames

#### Defined in

[src/node.ts:271](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L271)

___

### is

▸ **is**<`N`\>(`is`): this is N

#### Type parameters

| Name | Type |
| :------ | :------ |
| `N` | extends [`FunctionDecl`](FunctionDecl.md)<`F`, `N`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `is` | (`node`: [`FunctionDecl`](FunctionDecl.md)<`F`\>) => node is N |

#### Returns

this is N

#### Inherited from

BaseDecl.is

#### Defined in

[src/node.ts:52](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L52)

___

### isTerminal

▸ **isTerminal**(): `boolean`

#### Returns

`boolean`

checks if this Node is terminal - meaning all branches explicitly return a value

#### Inherited from

BaseDecl.isTerminal

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

BaseDecl.setParent

#### Defined in

[src/node.ts:35](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L35)

___

### step

▸ **step**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run immediately after this Node.

#### Inherited from

BaseDecl.step

#### Defined in

[src/node.ts:137](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L137)

___

### throw

▸ **throw**(): `undefined` \| [`BlockStmt`](BlockStmt.md) \| [`CatchClause`](CatchClause.md)

#### Returns

`undefined` \| [`BlockStmt`](BlockStmt.md) \| [`CatchClause`](CatchClause.md)

the [Stmt](../modules.md#stmt) that will be run if an error was raised from this Node.

#### Inherited from

BaseDecl.throw

#### Defined in

[src/node.ts:215](https://github.com/sam-goodwin/functionless/blob/3947743/src/node.ts#L215)
