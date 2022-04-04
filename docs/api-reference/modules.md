[functionless](README.md) / Exports

# functionless

## Table of contents

### Namespaces

- [$AWS](modules/AWS.md)
- [$SFN](modules/SFN.md)

### Classes

- [AppsyncResolver](classes/AppsyncResolver.md)
- [Argument](classes/Argument.md)
- [ArrayLiteralExpr](classes/ArrayLiteralExpr.md)
- [BaseExpr](classes/BaseExpr.md)
- [BaseStmt](classes/BaseStmt.md)
- [BinaryExpr](classes/BinaryExpr.md)
- [BlockStmt](classes/BlockStmt.md)
- [BooleanLiteralExpr](classes/BooleanLiteralExpr.md)
- [BreakStmt](classes/BreakStmt.md)
- [CallExpr](classes/CallExpr.md)
- [CatchClause](classes/CatchClause.md)
- [ComputedPropertyNameExpr](classes/ComputedPropertyNameExpr.md)
- [ConditionExpr](classes/ConditionExpr.md)
- [ContinueStmt](classes/ContinueStmt.md)
- [DoStmt](classes/DoStmt.md)
- [ElementAccessExpr](classes/ElementAccessExpr.md)
- [Err](classes/Err.md)
- [ExprStmt](classes/ExprStmt.md)
- [ExpressStepFunction](classes/ExpressStepFunction.md)
- [ForInStmt](classes/ForInStmt.md)
- [ForOfStmt](classes/ForOfStmt.md)
- [Function](classes/Function.md)
- [FunctionDecl](classes/FunctionDecl.md)
- [FunctionExpr](classes/FunctionExpr.md)
- [Identifier](classes/Identifier.md)
- [IfStmt](classes/IfStmt.md)
- [NewExpr](classes/NewExpr.md)
- [NullLiteralExpr](classes/NullLiteralExpr.md)
- [NumberLiteralExpr](classes/NumberLiteralExpr.md)
- [ObjectLiteralExpr](classes/ObjectLiteralExpr.md)
- [ParameterDecl](classes/ParameterDecl.md)
- [PropAccessExpr](classes/PropAccessExpr.md)
- [PropAssignExpr](classes/PropAssignExpr.md)
- [ReferenceExpr](classes/ReferenceExpr.md)
- [ReturnStmt](classes/ReturnStmt.md)
- [SpreadAssignExpr](classes/SpreadAssignExpr.md)
- [SpreadElementExpr](classes/SpreadElementExpr.md)
- [StepFunction](classes/StepFunction.md)
- [StringLiteralExpr](classes/StringLiteralExpr.md)
- [SynthesizedAppsyncResolver](classes/SynthesizedAppsyncResolver.md)
- [Table](classes/Table.md)
- [TemplateExpr](classes/TemplateExpr.md)
- [ThrowStmt](classes/ThrowStmt.md)
- [TryStmt](classes/TryStmt.md)
- [TypeOfExpr](classes/TypeOfExpr.md)
- [UnaryExpr](classes/UnaryExpr.md)
- [UndefinedLiteralExpr](classes/UndefinedLiteralExpr.md)
- [VariableStmt](classes/VariableStmt.md)
- [WhileStmt](classes/WhileStmt.md)

### Interfaces

- [$util](interfaces/util.md)
- [AppsyncContext](interfaces/AppsyncContext.md)
- [FinallyBlock](interfaces/FinallyBlock.md)
- [ResolverArguments](interfaces/ResolverArguments.md)
- [StepFunctionProps](interfaces/StepFunctionProps.md)
- [SyncExecutionFailedResult](interfaces/SyncExecutionFailedResult.md)
- [SyncExecutionSuccessResult](interfaces/SyncExecutionSuccessResult.md)
- [SynthesizedAppsyncResolverProps](interfaces/SynthesizedAppsyncResolverProps.md)
- [dynamodb](interfaces/dynamodb.md)
- [time](interfaces/time.md)

### Type aliases

- [AnyDepthArray](modules.md#anydeptharray)
- [AnyFunction](modules.md#anyfunction)
- [AnyLambda](modules.md#anylambda)
- [AnyStepFunction](modules.md#anystepfunction)
- [AnyTable](modules.md#anytable)
- [BinaryOp](modules.md#binaryop)
- [BlockStmtParent](modules.md#blockstmtparent)
- [CanReference](modules.md#canreference)
- [Decl](modules.md#decl)
- [DynamoExpression](modules.md#dynamoexpression)
- [Expr](modules.md#expr)
- [ObjectElementExpr](modules.md#objectelementexpr)
- [ResolverFunction](modules.md#resolverfunction)
- [Stmt](modules.md#stmt)
- [SyncExecutionResult](modules.md#syncexecutionresult)
- [UnaryOp](modules.md#unaryop)
- [VariableReference](modules.md#variablereference)
- [VariableStmtParent](modules.md#variablestmtparent)

### Variables

- [$util](modules.md#$util)

### Functions

- [anyOf](modules.md#anyof)
- [ensure](modules.md#ensure)
- [ensureItemOf](modules.md#ensureitemof)
- [findFunction](modules.md#findfunction)
- [findService](modules.md#findservice)
- [flatten](modules.md#flatten)
- [isArgument](modules.md#isargument)
- [isArrayLiteralExpr](modules.md#isarrayliteralexpr)
- [isBinaryExpr](modules.md#isbinaryexpr)
- [isBlockStmt](modules.md#isblockstmt)
- [isBooleanLiteral](modules.md#isbooleanliteral)
- [isBreakStmt](modules.md#isbreakstmt)
- [isCallExpr](modules.md#iscallexpr)
- [isCatchClause](modules.md#iscatchclause)
- [isComputedPropertyNameExpr](modules.md#iscomputedpropertynameexpr)
- [isConditionExpr](modules.md#isconditionexpr)
- [isContinueStmt](modules.md#iscontinuestmt)
- [isDecl](modules.md#isdecl)
- [isDoStmt](modules.md#isdostmt)
- [isElementAccessExpr](modules.md#iselementaccessexpr)
- [isErr](modules.md#iserr)
- [isExpr](modules.md#isexpr)
- [isExprStmt](modules.md#isexprstmt)
- [isForInStmt](modules.md#isforinstmt)
- [isForOfStmt](modules.md#isforofstmt)
- [isFunction](modules.md#isfunction)
- [isFunctionDecl](modules.md#isfunctiondecl)
- [isFunctionExpr](modules.md#isfunctionexpr)
- [isIdentifier](modules.md#isidentifier)
- [isIfStmt](modules.md#isifstmt)
- [isInTopLevelScope](modules.md#isintoplevelscope)
- [isLiteralExpr](modules.md#isliteralexpr)
- [isLiteralPrimitiveExpr](modules.md#isliteralprimitiveexpr)
- [isNewExpr](modules.md#isnewexpr)
- [isNullLiteralExpr](modules.md#isnullliteralexpr)
- [isNumberLiteralExpr](modules.md#isnumberliteralexpr)
- [isObjectElementExpr](modules.md#isobjectelementexpr)
- [isObjectLiteralExpr](modules.md#isobjectliteralexpr)
- [isParameterDecl](modules.md#isparameterdecl)
- [isPropAccessExpr](modules.md#ispropaccessexpr)
- [isPropAssignExpr](modules.md#ispropassignexpr)
- [isReferenceExpr](modules.md#isreferenceexpr)
- [isReturn](modules.md#isreturn)
- [isSpreadAssignExpr](modules.md#isspreadassignexpr)
- [isSpreadElementExpr](modules.md#isspreadelementexpr)
- [isStmt](modules.md#isstmt)
- [isStringLiteralExpr](modules.md#isstringliteralexpr)
- [isTable](modules.md#istable)
- [isTemplateExpr](modules.md#istemplateexpr)
- [isThrowStmt](modules.md#isthrowstmt)
- [isTryStmt](modules.md#istrystmt)
- [isTypeOfExpr](modules.md#istypeofexpr)
- [isUnaryExpr](modules.md#isunaryexpr)
- [isUndefinedLiteralExpr](modules.md#isundefinedliteralexpr)
- [isVariableReference](modules.md#isvariablereference)
- [isVariableStmt](modules.md#isvariablestmt)
- [isWhileStmt](modules.md#iswhilestmt)
- [reflect](modules.md#reflect)
- [toName](modules.md#toname)

## Type aliases

### AnyDepthArray

Ƭ **AnyDepthArray**<`T`\>: `T` \| `T`[] \| [`AnyDepthArray`](modules.md#anydeptharray)<`T`\>[]

#### Type parameters

| Name |
| :------ |
| `T` |

#### Defined in

[src/util.ts:120](https://github.com/sam-goodwin/functionless/blob/6691871/src/util.ts#L120)

___

### AnyFunction

Ƭ **AnyFunction**: (...`args`: `any`[]) => `any`

#### Type declaration

▸ (...`args`): `any`

##### Parameters

| Name | Type |
| :------ | :------ |
| `...args` | `any`[] |

##### Returns

`any`

#### Defined in

[src/util.ts:6](https://github.com/sam-goodwin/functionless/blob/6691871/src/util.ts#L6)

___

### AnyLambda

Ƭ **AnyLambda**: [`Function`](classes/Function.md)<`any`, `any`\>

#### Defined in

[src/function.ts:14](https://github.com/sam-goodwin/functionless/blob/6691871/src/function.ts#L14)

___

### AnyStepFunction

Ƭ **AnyStepFunction**: [`ExpressStepFunction`](classes/ExpressStepFunction.md)<[`AnyFunction`](modules.md#anyfunction)\> \| [`StepFunction`](classes/StepFunction.md)<[`AnyFunction`](modules.md#anyfunction)\>

#### Defined in

[src/step-function.ts:32](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L32)

___

### AnyTable

Ƭ **AnyTable**: [`Table`](classes/Table.md)<`object`, keyof `object`, keyof `object` \| `undefined`\>

#### Defined in

[src/table.ts:25](https://github.com/sam-goodwin/functionless/blob/6691871/src/table.ts#L25)

___

### BinaryOp

Ƭ **BinaryOp**: ``"="`` \| ``"+"`` \| ``"-"`` \| ``"=="`` \| ``"!="`` \| ``"<"`` \| ``"<="`` \| ``">"`` \| ``">="`` \| ``"&&"`` \| ``"||"``

#### Defined in

[src/expression.ts:269](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L269)

___

### BlockStmtParent

Ƭ **BlockStmtParent**: [`CatchClause`](classes/CatchClause.md) \| [`DoStmt`](classes/DoStmt.md) \| [`ForInStmt`](classes/ForInStmt.md) \| [`ForOfStmt`](classes/ForOfStmt.md) \| [`FunctionDecl`](classes/FunctionDecl.md) \| [`FunctionExpr`](classes/FunctionExpr.md) \| [`IfStmt`](classes/IfStmt.md) \| [`TryStmt`](classes/TryStmt.md) \| [`WhileStmt`](classes/WhileStmt.md)

#### Defined in

[src/statement.ts:98](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L98)

___

### CanReference

Ƭ **CanReference**: [`AnyTable`](modules.md#anytable) \| [`AnyLambda`](modules.md#anylambda) \| [`AnyStepFunction`](modules.md#anystepfunction) \| typeof [`$AWS`](modules/AWS.md)

#### Defined in

[src/expression.ts:125](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L125)

___

### Decl

Ƭ **Decl**: [`FunctionDecl`](classes/FunctionDecl.md) \| [`ParameterDecl`](classes/ParameterDecl.md)

#### Defined in

[src/declaration.ts:6](https://github.com/sam-goodwin/functionless/blob/6691871/src/declaration.ts#L6)

___

### DynamoExpression

Ƭ **DynamoExpression**<`Expression`\>: {} & `RenameKeys`<`ExpressionAttributeNames`<`Expression`\> & `ExpressionAttributeValues`<`Expression`, `JsonFormat.AttributeValue`\> & { `expression?`: `Expression`  }, { `ExpressionAttributeNames`: ``"expressionNames"`` ; `ExpressionAttributeValues`: ``"expressionValues"``  }\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Expression` | extends `string` \| `undefined` |

#### Defined in

[src/table.ts:299](https://github.com/sam-goodwin/functionless/blob/6691871/src/table.ts#L299)

___

### Expr

Ƭ **Expr**: [`Argument`](classes/Argument.md) \| [`ArrayLiteralExpr`](classes/ArrayLiteralExpr.md) \| [`BinaryExpr`](classes/BinaryExpr.md) \| [`BooleanLiteralExpr`](classes/BooleanLiteralExpr.md) \| [`CallExpr`](classes/CallExpr.md) \| [`ConditionExpr`](classes/ConditionExpr.md) \| [`ComputedPropertyNameExpr`](classes/ComputedPropertyNameExpr.md) \| [`FunctionExpr`](classes/FunctionExpr.md) \| [`ElementAccessExpr`](classes/ElementAccessExpr.md) \| [`FunctionExpr`](classes/FunctionExpr.md) \| [`Identifier`](classes/Identifier.md) \| [`NewExpr`](classes/NewExpr.md) \| [`NullLiteralExpr`](classes/NullLiteralExpr.md) \| [`NumberLiteralExpr`](classes/NumberLiteralExpr.md) \| [`ObjectLiteralExpr`](classes/ObjectLiteralExpr.md) \| [`PropAccessExpr`](classes/PropAccessExpr.md) \| [`PropAssignExpr`](classes/PropAssignExpr.md) \| [`ReferenceExpr`](classes/ReferenceExpr.md) \| [`SpreadAssignExpr`](classes/SpreadAssignExpr.md) \| [`SpreadElementExpr`](classes/SpreadElementExpr.md) \| [`StringLiteralExpr`](classes/StringLiteralExpr.md) \| [`TemplateExpr`](classes/TemplateExpr.md) \| [`TypeOfExpr`](classes/TypeOfExpr.md) \| [`UnaryExpr`](classes/UnaryExpr.md) \| [`UndefinedLiteralExpr`](classes/UndefinedLiteralExpr.md)

An [Expr](modules.md#expr) (Expression) is a Node that will be interpreted to a value.

#### Defined in

[src/expression.ts:18](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L18)

___

### ObjectElementExpr

Ƭ **ObjectElementExpr**: [`PropAssignExpr`](classes/PropAssignExpr.md) \| [`SpreadAssignExpr`](classes/SpreadAssignExpr.md)

#### Defined in

[src/expression.ts:395](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L395)

___

### ResolverFunction

Ƭ **ResolverFunction**<`Arguments`, `Result`, `Source`\>: (`$context`: [`AppsyncContext`](interfaces/AppsyncContext.md)<`Arguments`, `Source`\>) => `Result`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Arguments` | extends [`ResolverArguments`](interfaces/ResolverArguments.md) |
| `Result` | `Result` |
| `Source` | `Source` |

#### Type declaration

▸ (`$context`): `Result`

A [ResolverFunction](modules.md#resolverfunction) is a function that represents an AWS Appsync Resolver Pipeline.

**`tparam`** Arguments - an object describing the shape of `$context.arguments`.

**`tparam`** Result - the type of data returned by the Resolver.

**`tparam`** Source - the parent type of the Appsync Resolver.

##### Parameters

| Name | Type |
| :------ | :------ |
| `$context` | [`AppsyncContext`](interfaces/AppsyncContext.md)<`Arguments`, `Source`\> |

##### Returns

`Result`

#### Defined in

[src/appsync.ts:48](https://github.com/sam-goodwin/functionless/blob/6691871/src/appsync.ts#L48)

___

### Stmt

Ƭ **Stmt**: [`BreakStmt`](classes/BreakStmt.md) \| [`BlockStmt`](classes/BlockStmt.md) \| [`CatchClause`](classes/CatchClause.md) \| [`ContinueStmt`](classes/ContinueStmt.md) \| [`DoStmt`](classes/DoStmt.md) \| [`ExprStmt`](classes/ExprStmt.md) \| [`ForInStmt`](classes/ForInStmt.md) \| [`ForOfStmt`](classes/ForOfStmt.md) \| [`IfStmt`](classes/IfStmt.md) \| [`ReturnStmt`](classes/ReturnStmt.md) \| [`ThrowStmt`](classes/ThrowStmt.md) \| [`TryStmt`](classes/TryStmt.md) \| [`VariableStmt`](classes/VariableStmt.md) \| [`WhileStmt`](classes/WhileStmt.md)

A [Stmt](modules.md#stmt) (Statement) is unit of execution that does not yield any value. They are translated
to `#set`, `$util.qr` and `#return` directives.

#### Defined in

[src/statement.ts:9](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L9)

___

### SyncExecutionResult

Ƭ **SyncExecutionResult**<`T`\>: [`SyncExecutionFailedResult`](interfaces/SyncExecutionFailedResult.md) \| [`SyncExecutionSuccessResult`](interfaces/SyncExecutionSuccessResult.md)<`T`\>

#### Type parameters

| Name |
| :------ |
| `T` |

#### Defined in

[src/step-function.ts:913](https://github.com/sam-goodwin/functionless/blob/6691871/src/step-function.ts#L913)

___

### UnaryOp

Ƭ **UnaryOp**: ``"!"``

#### Defined in

[src/expression.ts:304](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L304)

___

### VariableReference

Ƭ **VariableReference**: [`Identifier`](classes/Identifier.md) \| [`PropAccessExpr`](classes/PropAccessExpr.md) \| [`ElementAccessExpr`](classes/ElementAccessExpr.md)

#### Defined in

[src/expression.ts:137](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L137)

___

### VariableStmtParent

Ƭ **VariableStmtParent**: [`ForInStmt`](classes/ForInStmt.md) \| [`ForOfStmt`](classes/ForOfStmt.md) \| [`FunctionDecl`](classes/FunctionDecl.md) \| [`FunctionExpr`](classes/FunctionExpr.md) \| [`CatchClause`](classes/CatchClause.md)

#### Defined in

[src/statement.ts:74](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L74)

## Variables

### $util

• `Const` **$util**: [`$util`](modules.md#$util)

A reference to the AWS Appsync `$util` variable globally available to all Resolvers.

Use the functions on `$util` to perform computations within an [AppsyncResolver](classes/AppsyncResolver.md). They
will be translated directly to calls within the Velocity Template Engine.

**`see`** https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference.html

#### Defined in

[src/appsync.ts:486](https://github.com/sam-goodwin/functionless/blob/6691871/src/appsync.ts#L486)

## Functions

### anyOf

▸ **anyOf**<`T`\>(...`fns`): (`a`: `any`) => a is EnsureOr<T\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends (`a`: `any`) => a is any[] |

#### Parameters

| Name | Type |
| :------ | :------ |
| `...fns` | `T` |

#### Returns

`fn`

▸ (`a`): a is EnsureOr<T\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

##### Returns

a is EnsureOr<T\>

#### Defined in

[src/util.ts:114](https://github.com/sam-goodwin/functionless/blob/6691871/src/util.ts#L114)

___

### ensure

▸ **ensure**<`T`\>(`a`, `is`, `message`): asserts a is T

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |
| `is` | (`a`: `any`) => a is T |
| `message` | `string` |

#### Returns

asserts a is T

#### Defined in

[src/util.ts:97](https://github.com/sam-goodwin/functionless/blob/6691871/src/util.ts#L97)

___

### ensureItemOf

▸ **ensureItemOf**<`T`\>(`arr`, `f`, `message`): asserts arr is T[]

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `arr` | `any`[] |
| `f` | (`item`: `any`) => item is T |
| `message` | `string` |

#### Returns

asserts arr is T[]

#### Defined in

[src/util.ts:87](https://github.com/sam-goodwin/functionless/blob/6691871/src/util.ts#L87)

___

### findFunction

▸ **findFunction**(`call`): (`call`: [`CallExpr`](classes/CallExpr.md), `context`: `VTL`) => `string` & (`call`: [`CallExpr`](classes/CallExpr.md), `context`: `ASL`) => `Omit`<`Task`, ``"Next"``\> \| `undefined`

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `call` | [`CallExpr`](classes/CallExpr.md) | call expression that may reference a callable integration |

#### Returns

(`call`: [`CallExpr`](classes/CallExpr.md), `context`: `VTL`) => `string` & (`call`: [`CallExpr`](classes/CallExpr.md), `context`: `ASL`) => `Omit`<`Task`, ``"Next"``\> \| `undefined`

the reference to the callable function, e.g. a Lambda Function or method on a DynamoDB Table

#### Defined in

[src/util.ts:66](https://github.com/sam-goodwin/functionless/blob/6691871/src/util.ts#L66)

___

### findService

▸ **findService**(`expr`): [`CanReference`](modules.md#canreference) \| `undefined`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expr` | `FunctionlessNode` |

#### Returns

[`CanReference`](modules.md#canreference) \| `undefined`

#### Defined in

[src/util.ts:8](https://github.com/sam-goodwin/functionless/blob/6691871/src/util.ts#L8)

___

### flatten

▸ **flatten**<`T`\>(`arr`): `T`[]

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `arr` | [`AnyDepthArray`](modules.md#anydeptharray)<`T`\> |

#### Returns

`T`[]

#### Defined in

[src/util.ts:122](https://github.com/sam-goodwin/functionless/blob/6691871/src/util.ts#L122)

___

### isArgument

▸ **isArgument**(`a`): a is Argument

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is Argument

#### Defined in

[src/expression.ts:191](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L191)

___

### isArrayLiteralExpr

▸ **isArrayLiteralExpr**(`a`): a is ArrayLiteralExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ArrayLiteralExpr

#### Defined in

[src/expression.ts:382](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L382)

___

### isBinaryExpr

▸ **isBinaryExpr**(`a`): a is BinaryExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is BinaryExpr

#### Defined in

[src/expression.ts:267](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L267)

___

### isBlockStmt

▸ **isBlockStmt**(`a`): a is BlockStmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is BlockStmt

#### Defined in

[src/statement.ts:96](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L96)

___

### isBooleanLiteral

▸ **isBooleanLiteral**(`a`): a is BooleanLiteralExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is BooleanLiteralExpr

#### Defined in

[src/expression.ts:346](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L346)

___

### isBreakStmt

▸ **isBreakStmt**(`a`): a is BreakStmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is BreakStmt

#### Defined in

[src/statement.ts:236](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L236)

___

### isCallExpr

▸ **isCallExpr**(`a`): a is CallExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is CallExpr

#### Defined in

[src/expression.ts:204](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L204)

___

### isCatchClause

▸ **isCatchClause**(`a`): a is CatchClause

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is CatchClause

#### Defined in

[src/statement.ts:293](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L293)

___

### isComputedPropertyNameExpr

▸ **isComputedPropertyNameExpr**(`a`): a is ComputedPropertyNameExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ComputedPropertyNameExpr

#### Defined in

[src/expression.ts:451](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L451)

___

### isConditionExpr

▸ **isConditionExpr**(`a`): a is ConditionExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ConditionExpr

#### Defined in

[src/expression.ts:246](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L246)

___

### isContinueStmt

▸ **isContinueStmt**(`a`): a is ContinueStmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ContinueStmt

#### Defined in

[src/statement.ts:248](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L248)

___

### isDecl

▸ **isDecl**(`a`): a is Decl

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is Decl

#### Defined in

[src/declaration.ts:8](https://github.com/sam-goodwin/functionless/blob/6691871/src/declaration.ts#L8)

___

### isDoStmt

▸ **isDoStmt**(`a`): a is DoStmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is DoStmt

#### Defined in

[src/statement.ts:342](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L342)

___

### isElementAccessExpr

▸ **isElementAccessExpr**(`a`): a is ElementAccessExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ElementAccessExpr

#### Defined in

[src/expression.ts:174](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L174)

___

### isErr

▸ **isErr**(`a`): a is Err

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is Err

#### Defined in

[src/error.ts:3](https://github.com/sam-goodwin/functionless/blob/6691871/src/error.ts#L3)

___

### isExpr

▸ **isExpr**(`a`): a is Expr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is Expr

#### Defined in

[src/expression.ts:45](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L45)

___

### isExprStmt

▸ **isExprStmt**(`a`): a is ExprStmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ExprStmt

#### Defined in

[src/statement.ts:59](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L59)

___

### isForInStmt

▸ **isForInStmt**(`a`): a is ForInStmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ForInStmt

#### Defined in

[src/statement.ts:213](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L213)

___

### isForOfStmt

▸ **isForOfStmt**(`a`): a is ForOfStmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ForOfStmt

#### Defined in

[src/statement.ts:190](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L190)

___

### isFunction

▸ **isFunction**(`a`): a is Function<any, any\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is Function<any, any\>

#### Defined in

[src/function.ts:10](https://github.com/sam-goodwin/functionless/blob/6691871/src/function.ts#L10)

___

### isFunctionDecl

▸ **isFunctionDecl**(`a`): a is FunctionDecl<AnyFunction\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is FunctionDecl<AnyFunction\>

#### Defined in

[src/declaration.ts:12](https://github.com/sam-goodwin/functionless/blob/6691871/src/declaration.ts#L12)

___

### isFunctionExpr

▸ **isFunctionExpr**(`a`): a is FunctionExpr<AnyFunction\> \| FunctionExpr<AnyFunction\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is FunctionExpr<AnyFunction\> \| FunctionExpr<AnyFunction\>

#### Defined in

[src/expression.ts:103](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L103)

___

### isIdentifier

▸ **isIdentifier**(`a`): a is Identifier

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is Identifier

#### Defined in

[src/expression.ts:145](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L145)

___

### isIfStmt

▸ **isIfStmt**(`a`): a is IfStmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is IfStmt

#### Defined in

[src/statement.ts:165](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L165)

___

### isInTopLevelScope

▸ **isInTopLevelScope**(`expr`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expr` | `FunctionlessNode` |

#### Returns

`boolean`

#### Defined in

[src/util.ts:44](https://github.com/sam-goodwin/functionless/blob/6691871/src/util.ts#L44)

___

### isLiteralExpr

▸ **isLiteralExpr**(`a`): a is ArrayLiteralExpr \| BooleanLiteralExpr \| NullLiteralExpr \| NumberLiteralExpr \| ObjectLiteralExpr \| StringLiteralExpr \| UndefinedLiteralExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ArrayLiteralExpr \| BooleanLiteralExpr \| NullLiteralExpr \| NumberLiteralExpr \| ObjectLiteralExpr \| StringLiteralExpr \| UndefinedLiteralExpr

#### Defined in

[src/expression.ts:74](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L74)

___

### isLiteralPrimitiveExpr

▸ **isLiteralPrimitiveExpr**(`a`): a is BooleanLiteralExpr \| NullLiteralExpr \| NumberLiteralExpr \| StringLiteralExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is BooleanLiteralExpr \| NullLiteralExpr \| NumberLiteralExpr \| StringLiteralExpr

#### Defined in

[src/expression.ts:84](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L84)

___

### isNewExpr

▸ **isNewExpr**(`a`): a is NewExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is NewExpr

#### Defined in

[src/expression.ts:225](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L225)

___

### isNullLiteralExpr

▸ **isNullLiteralExpr**(`a`): a is NullLiteralExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is NullLiteralExpr

#### Defined in

[src/expression.ts:319](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L319)

___

### isNumberLiteralExpr

▸ **isNumberLiteralExpr**(`a`): a is NumberLiteralExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is NumberLiteralExpr

#### Defined in

[src/expression.ts:358](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L358)

___

### isObjectElementExpr

▸ **isObjectElementExpr**(`a`): a is PropAssignExpr \| SpreadAssignExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is PropAssignExpr \| SpreadAssignExpr

#### Defined in

[src/expression.ts:397](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L397)

___

### isObjectLiteralExpr

▸ **isObjectLiteralExpr**(`a`): a is ObjectLiteralExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ObjectLiteralExpr

#### Defined in

[src/expression.ts:402](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L402)

___

### isParameterDecl

▸ **isParameterDecl**(`a`): a is ParameterDecl

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ParameterDecl

#### Defined in

[src/declaration.ts:40](https://github.com/sam-goodwin/functionless/blob/6691871/src/declaration.ts#L40)

___

### isPropAccessExpr

▸ **isPropAccessExpr**(`a`): a is PropAccessExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is PropAccessExpr

#### Defined in

[src/expression.ts:161](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L161)

___

### isPropAssignExpr

▸ **isPropAssignExpr**(`a`): a is PropAssignExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is PropAssignExpr

#### Defined in

[src/expression.ts:431](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L431)

___

### isReferenceExpr

▸ **isReferenceExpr**(`a`): a is ReferenceExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ReferenceExpr

#### Defined in

[src/expression.ts:123](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L123)

___

### isReturn

▸ **isReturn**(`a`): a is ReturnStmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ReturnStmt

#### Defined in

[src/statement.ts:152](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L152)

___

### isSpreadAssignExpr

▸ **isSpreadAssignExpr**(`a`): a is SpreadAssignExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is SpreadAssignExpr

#### Defined in

[src/expression.ts:467](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L467)

___

### isSpreadElementExpr

▸ **isSpreadElementExpr**(`a`): a is SpreadElementExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is SpreadElementExpr

#### Defined in

[src/expression.ts:483](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L483)

___

### isStmt

▸ **isStmt**(`a`): a is Stmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is Stmt

#### Defined in

[src/statement.ts:25](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L25)

___

### isStringLiteralExpr

▸ **isStringLiteralExpr**(`a`): a is StringLiteralExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is StringLiteralExpr

#### Defined in

[src/expression.ts:370](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L370)

___

### isTable

▸ **isTable**(`a`): a is AnyTable

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is AnyTable

#### Defined in

[src/table.ts:21](https://github.com/sam-goodwin/functionless/blob/6691871/src/table.ts#L21)

___

### isTemplateExpr

▸ **isTemplateExpr**(`a`): a is TemplateExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is TemplateExpr

#### Defined in

[src/expression.ts:499](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L499)

___

### isThrowStmt

▸ **isThrowStmt**(`a`): a is ThrowStmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is ThrowStmt

#### Defined in

[src/statement.ts:315](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L315)

___

### isTryStmt

▸ **isTryStmt**(`a`): a is TryStmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is TryStmt

#### Defined in

[src/statement.ts:266](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L266)

___

### isTypeOfExpr

▸ **isTypeOfExpr**(`a`): a is TypeOfExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is TypeOfExpr

#### Defined in

[src/expression.ts:515](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L515)

___

### isUnaryExpr

▸ **isUnaryExpr**(`a`): a is UnaryExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is UnaryExpr

#### Defined in

[src/expression.ts:302](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L302)

___

### isUndefinedLiteralExpr

▸ **isUndefinedLiteralExpr**(`a`): a is UndefinedLiteralExpr

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is UndefinedLiteralExpr

#### Defined in

[src/expression.ts:332](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L332)

___

### isVariableReference

▸ **isVariableReference**(`expr`): expr is VariableReference

#### Parameters

| Name | Type |
| :------ | :------ |
| `expr` | [`Expr`](modules.md#expr) |

#### Returns

expr is VariableReference

#### Defined in

[src/expression.ts:139](https://github.com/sam-goodwin/functionless/blob/6691871/src/expression.ts#L139)

___

### isVariableStmt

▸ **isVariableStmt**(`a`): a is VariableStmt<undefined \| Expr\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is VariableStmt<undefined \| Expr\>

#### Defined in

[src/statement.ts:72](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L72)

___

### isWhileStmt

▸ **isWhileStmt**(`a`): a is WhileStmt

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `any` |

#### Returns

a is WhileStmt

#### Defined in

[src/statement.ts:328](https://github.com/sam-goodwin/functionless/blob/6691871/src/statement.ts#L328)

___

### reflect

▸ **reflect**<`F`\>(`func`): [`FunctionDecl`](classes/FunctionDecl.md)<`F`\> \| [`Err`](classes/Err.md)

A macro (compile-time) function that converts an ArrowFunction or FunctionExpression to a [FunctionDecl](classes/FunctionDecl.md).

Use this function to quickly grab the [FunctionDecl](classes/FunctionDecl.md) (AST) representation of TypeScript syntax and
then perform interpretations of that representation.

Valid uses  include an in-line ArrowFunction or FunctionExpression:
```ts
const decl1 = reflect((arg: string) => {})
const decl2 = reflect(function (arg: string) {})
```

Illegal uses include references to functions or computed functions:
```ts
const functionRef = () => {}
const decl1 = reflect(functionRef)

function computeFunction() {
  return () => "hello"
}
const decl2 = reflect(computeFunction())
```

#### Type parameters

| Name | Type |
| :------ | :------ |
| `F` | extends [`AnyFunction`](modules.md#anyfunction) |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `func` | `F` | an in-line ArrowFunction or FunctionExpression. It must be in-line and cannot reference             a variable or a computed function/closure. |

#### Returns

[`FunctionDecl`](classes/FunctionDecl.md)<`F`\> \| [`Err`](classes/Err.md)

#### Defined in

[src/reflect.ts:31](https://github.com/sam-goodwin/functionless/blob/6691871/src/reflect.ts#L31)

___

### toName

▸ **toName**(`expr`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `expr` | `FunctionlessNode` |

#### Returns

`string`

#### Defined in

[src/util.ts:27](https://github.com/sam-goodwin/functionless/blob/6691871/src/util.ts#L27)
