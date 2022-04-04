[functionless](../README.md) / [Exports](../modules.md) / ParameterDecl

# Class: ParameterDecl

## Hierarchy

- `BaseDecl`<``"ParameterDecl"``, [`FunctionDecl`](FunctionDecl.md) \| [`FunctionExpr`](FunctionExpr.md)\>

  ↳ **`ParameterDecl`**

## Table of contents

### Constructors

- [constructor](ParameterDecl.md#constructor)

### Properties

- [children](ParameterDecl.md#children)
- [kind](ParameterDecl.md#kind)
- [name](ParameterDecl.md#name)
- [nodeKind](ParameterDecl.md#nodekind)
- [parent](ParameterDecl.md#parent)

### Methods

- [as](ParameterDecl.md#as)
- [clone](ParameterDecl.md#clone)
- [collectChildren](ParameterDecl.md#collectchildren)
- [contains](ParameterDecl.md#contains)
- [exit](ParameterDecl.md#exit)
- [findCatchClause](ParameterDecl.md#findcatchclause)
- [findChildren](ParameterDecl.md#findchildren)
- [findParent](ParameterDecl.md#findparent)
- [getLexicalScope](ParameterDecl.md#getlexicalscope)
- [getVisibleNames](ParameterDecl.md#getvisiblenames)
- [is](ParameterDecl.md#is)
- [isTerminal](ParameterDecl.md#isterminal)
- [setParent](ParameterDecl.md#setparent)
- [step](ParameterDecl.md#step)
- [throw](ParameterDecl.md#throw)

## Constructors

### constructor

• **new ParameterDecl**(`name`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Overrides

BaseDecl&lt;
  &quot;ParameterDecl&quot;,
  FunctionDecl \| FunctionExpr
\&gt;.constructor

#### Defined in

[src/declaration.ts:46](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/declaration.ts#L46)

## Properties

### children

• `Readonly` **children**: `FunctionlessNode`[] = `[]`

The immediate Child nodes contained within this Node.

#### Inherited from

BaseDecl.children

#### Defined in

[src/node.ts:29](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L29)

___

### kind

• `Readonly` **kind**: ``"ParameterDecl"``

#### Inherited from

BaseDecl.kind

___

### name

• `Readonly` **name**: `string`

___

### nodeKind

• `Readonly` **nodeKind**: ``"Decl"``

#### Inherited from

BaseDecl.nodeKind

#### Defined in

[src/declaration.ts:18](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/declaration.ts#L18)

___

### parent

• **parent**: [`FunctionDecl`](FunctionDecl.md)<[`AnyFunction`](../modules.md#anyfunction)\> \| [`FunctionExpr`](FunctionExpr.md)<[`AnyFunction`](../modules.md#anyfunction)\>

#### Inherited from

BaseDecl.parent

#### Defined in

[src/node.ts:24](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L24)

## Methods

### as

▸ **as**<`K`\>(`kind`): `Extract`<[`ParameterDecl`](ParameterDecl.md), { `kind`: `K`  }\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends ``"FunctionDecl"`` \| ``"CallExpr"`` \| ``"ParameterDecl"`` \| ``"Argument"`` \| ``"ArrayLiteralExpr"`` \| ``"BinaryExpr"`` \| ``"BooleanLiteralExpr"`` \| ``"ConditionExpr"`` \| ``"ComputedPropertyNameExpr"`` \| ``"FunctionExpr"`` \| ``"ElementAccessExpr"`` \| ``"Identifier"`` \| ``"NewExpr"`` \| ``"NullLiteralExpr"`` \| ``"NumberLiteralExpr"`` \| ``"ObjectLiteralExpr"`` \| ``"PropAccessExpr"`` \| ``"PropAssignExpr"`` \| ``"ReferenceExpr"`` \| ``"SpreadAssignExpr"`` \| ``"SpreadElementExpr"`` \| ``"StringLiteralExpr"`` \| ``"TemplateExpr"`` \| ``"TypeOfExpr"`` \| ``"UnaryExpr"`` \| ``"UndefinedLiteralExpr"`` \| ``"BreakStmt"`` \| ``"BlockStmt"`` \| ``"CatchClause"`` \| ``"ContinueStmt"`` \| ``"DoStmt"`` \| ``"ExprStmt"`` \| ``"ForInStmt"`` \| ``"ForOfStmt"`` \| ``"IfStmt"`` \| ``"ReturnStmt"`` \| ``"ThrowStmt"`` \| ``"TryStmt"`` \| ``"VariableStmt"`` \| ``"WhileStmt"`` \| ``"Err"`` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `kind` | `K` |

#### Returns

`Extract`<[`ParameterDecl`](ParameterDecl.md), { `kind`: `K`  }\>

#### Inherited from

BaseDecl.as

#### Defined in

[src/node.ts:42](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L42)

___

### clone

▸ **clone**(): [`ParameterDecl`](ParameterDecl.md)

#### Returns

[`ParameterDecl`](ParameterDecl.md)

#### Overrides

BaseDecl.clone

#### Defined in

[src/declaration.ts:50](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/declaration.ts#L50)

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

[src/node.ts:62](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L62)

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

[src/node.ts:107](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L107)

___

### exit

▸ **exit**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run after exiting the scope of this Node.

#### Inherited from

BaseDecl.exit

#### Defined in

[src/node.ts:173](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L173)

___

### findCatchClause

▸ **findCatchClause**(): `undefined` \| [`CatchClause`](CatchClause.md)

Finds the [CatchClause](CatchClause.md) that this Node should throw to.

#### Returns

`undefined` \| [`CatchClause`](CatchClause.md)

#### Inherited from

BaseDecl.findCatchClause

#### Defined in

[src/node.ts:84](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L84)

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

[src/node.ts:56](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L56)

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

[src/node.ts:69](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L69)

___

### getLexicalScope

▸ **getLexicalScope**(): `Map`<`string`, [`ParameterDecl`](ParameterDecl.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

#### Returns

`Map`<`string`, [`ParameterDecl`](ParameterDecl.md) \| [`VariableStmt`](VariableStmt.md)<`undefined` \| [`Expr`](../modules.md#expr)\>\>

a mapping of name to the node visible in this node's scope.

#### Inherited from

BaseDecl.getLexicalScope

#### Defined in

[src/node.ts:278](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L278)

___

### getVisibleNames

▸ **getVisibleNames**(): `string`[]

#### Returns

`string`[]

an array of all the visible names in this node's scope.

#### Inherited from

BaseDecl.getVisibleNames

#### Defined in

[src/node.ts:271](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L271)

___

### is

▸ **is**<`N`\>(`is`): this is N

#### Type parameters

| Name | Type |
| :------ | :------ |
| `N` | extends [`ParameterDecl`](ParameterDecl.md)<`N`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `is` | (`node`: [`ParameterDecl`](ParameterDecl.md)) => node is N |

#### Returns

this is N

#### Inherited from

BaseDecl.is

#### Defined in

[src/node.ts:52](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L52)

___

### isTerminal

▸ **isTerminal**(): `boolean`

#### Returns

`boolean`

checks if this Node is terminal - meaning all branches explicitly return a value

#### Inherited from

BaseDecl.isTerminal

#### Defined in

[src/node.ts:315](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L315)

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

[src/node.ts:35](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L35)

___

### step

▸ **step**(): `undefined` \| [`Stmt`](../modules.md#stmt)

#### Returns

`undefined` \| [`Stmt`](../modules.md#stmt)

the [Stmt](../modules.md#stmt) that will be run immediately after this Node.

#### Inherited from

BaseDecl.step

#### Defined in

[src/node.ts:137](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L137)

___

### throw

▸ **throw**(): `undefined` \| [`BlockStmt`](BlockStmt.md) \| [`CatchClause`](CatchClause.md)

#### Returns

`undefined` \| [`BlockStmt`](BlockStmt.md) \| [`CatchClause`](CatchClause.md)

the [Stmt](../modules.md#stmt) that will be run if an error was raised from this Node.

#### Inherited from

BaseDecl.throw

#### Defined in

[src/node.ts:215](https://github.com/sam-goodwin/functionless/blob/d22ce12/src/node.ts#L215)
