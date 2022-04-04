[functionless](../README.md) / [Exports](../modules.md) / Table

# Class: Table<Item, PartitionKey, RangeKey\>

Wraps an {@link aws_dynamodb.Table} with a type-safe interface that can be
called from within an [AppsyncResolver](AppsyncResolver.md).

Its interface, e.g. `getItem`, `putItem`, is in 1:1 correspondence with the
AWS Appsync Resolver API https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html

For example:
```ts
interface Person {
  id: string;
  name: string;
  age: number;
}

const personTable = new Table<Person, "id">(
  new aws_dynamodb.Table(..)
);

const getPerson = new AppsyncResolver<
  (personId: string) => Person | undefined
>(($context, personId: string) => {
  const person = personTable.get({
    key: {
      id: $util.toDynamoDB(personId)
    }
  });

  return person;
});
```

Note the type-signature of `Table<Person, "id">`. This declares a table whose contents
are of the shape, `Person`, and that the PartitionKey is the `id` field.

You can also specify the RangeKey:
```ts
new Table<Person, "id", "age">(..)
```

**`see`** https://github.com/sam-goodwin/typesafe-dynamodb - for more information on how to model your DynamoDB table with TypeScript

## Type parameters

| Name | Type |
| :------ | :------ |
| `Item` | extends `object` |
| `PartitionKey` | extends keyof `Item` |
| `RangeKey` | extends keyof `Item` \| `undefined` = `undefined` |

## Table of contents

### Constructors

- [constructor](Table.md#constructor)

### Properties

- [kind](Table.md#kind)
- [resource](Table.md#resource)

### Methods

- [deleteItem](Table.md#deleteitem)
- [getItem](Table.md#getitem)
- [putItem](Table.md#putitem)
- [query](Table.md#query)
- [updateItem](Table.md#updateitem)

## Constructors

### constructor

• **new Table**<`Item`, `PartitionKey`, `RangeKey`\>(`resource`)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Item` | extends `object` |
| `PartitionKey` | extends `string` \| `number` \| `symbol` |
| `RangeKey` | extends `undefined` \| `string` \| `number` \| `symbol` = `undefined` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `resource` | `ITable` |

#### Defined in

[src/table.ts:75](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/table.ts#L75)

## Properties

### kind

• `Readonly` **kind**: ``"Table"``

#### Defined in

[src/table.ts:73](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/table.ts#L73)

___

### resource

• `Readonly` **resource**: `ITable`

## Methods

### deleteItem

▸ **deleteItem**<`Key`, `ConditionExpression`\>(`input`): `Extract`<`Item`, `AttributeKeyToObject`<`Key`\>\>

**`see`** https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-deleteitem

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Key` | `Key` |
| `ConditionExpression` | extends `undefined` \| `string` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | `Object` |
| `input._version?` | `number` |
| `input.condition?` | `RenameKeys`<`ExpressionAttributeNames`<`ConditionExpression`\> & `ExpressionAttributeValues`<`ConditionExpression`, `AttributeValue`\> & { `expression?`: `ConditionExpression`  }, { `ExpressionAttributeNames`: ``"expressionNames"`` ; `ExpressionAttributeValues`: ``"expressionValues"``  }\> |
| `input.key` | `Key` |

#### Returns

`Extract`<`Item`, `AttributeKeyToObject`<`Key`\>\>

#### Defined in

[src/table.ts:200](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/table.ts#L200)

___

### getItem

▸ **getItem**<`Key`\>(`input`): `Extract`<`Item`, `AttributeKeyToObject`<`Key`\>\>

**`see`** https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem

#### Type parameters

| Name |
| :------ |
| `Key` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | `Object` |
| `input.consistentRead?` | `boolean` |
| `input.key` | `Key` |

#### Returns

`Extract`<`Item`, `AttributeKeyToObject`<`Key`\>\>

#### Defined in

[src/table.ts:81](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/table.ts#L81)

___

### putItem

▸ **putItem**<`Key`, `ConditionExpression`\>(`input`): `Extract`<`Item`, `AttributeKeyToObject`<`Key`\>\>

**`see`** https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-putitem

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Key` | `Key` |
| `ConditionExpression` | extends `undefined` \| `string` = `undefined` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | `Object` |
| `input._version?` | `number` |
| `input.attributeValues` | `ToAttributeMap`<`Omit`<`Extract`<`Item`, `AttributeKeyToObject`<`Key`\>\>, `Exclude`<`PartitionKey`, `undefined`\> \| `Exclude`<`RangeKey`, `undefined`\>\>\> |
| `input.condition?` | `RenameKeys`<`ExpressionAttributeNames`<`ConditionExpression`\> & `ExpressionAttributeValues`<`ConditionExpression`, `AttributeValue`\> & { `expression?`: `ConditionExpression`  }, { `ExpressionAttributeNames`: ``"expressionNames"`` ; `ExpressionAttributeValues`: ``"expressionValues"``  }\> |
| `input.key` | `Key` |

#### Returns

`Extract`<`Item`, `AttributeKeyToObject`<`Key`\>\>

#### Defined in

[src/table.ts:115](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/table.ts#L115)

___

### query

▸ **query**<`Query`, `Filter`\>(`input`): `Object`

**`see`** https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-query

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Query` | extends `string` |
| `Filter` | extends `undefined` \| `string` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | `Object` |
| `input.consistentRead?` | `boolean` |
| `input.filter?` | `RenameKeys`<`ExpressionAttributeNames`<`Filter`\> & `ExpressionAttributeValues`<`Filter`, `AttributeValue`\> & { `expression?`: `Filter`  }, { `ExpressionAttributeNames`: ``"expressionNames"`` ; `ExpressionAttributeValues`: ``"expressionValues"``  }\> |
| `input.index?` | `string` |
| `input.limit?` | `number` |
| `input.nextToken?` | `string` |
| `input.query` | `RenameKeys`<`ExpressionAttributeNames`<`Query`\> & `ExpressionAttributeValues`<`Query`, `AttributeValue`\> & { `expression?`: `Query`  }, { `ExpressionAttributeNames`: ``"expressionNames"`` ; `ExpressionAttributeValues`: ``"expressionValues"``  }\> |
| `input.scanIndexForward?` | `boolean` |
| `input.select?` | ``"ALL_ATTRIBUTES"`` \| ``"ALL_PROJECTED_ATTRIBUTES"`` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `items` | `Item`[] |
| `nextToken` | `string` |
| `scannedCount` | `number` |

#### Defined in

[src/table.ts:235](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/table.ts#L235)

___

### updateItem

▸ **updateItem**<`Key`, `UpdateExpression`, `ConditionExpression`\>(`input`): `Extract`<`Item`, `AttributeKeyToObject`<`Key`\>\>

**`see`** https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-updateitem

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Key` | `Key` |
| `UpdateExpression` | extends `string` |
| `ConditionExpression` | extends `undefined` \| `string` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | `Object` |
| `input._version?` | `number` |
| `input.condition?` | `RenameKeys`<`ExpressionAttributeNames`<`ConditionExpression`\> & `ExpressionAttributeValues`<`ConditionExpression`, `AttributeValue`\> & { `expression?`: `ConditionExpression`  }, { `ExpressionAttributeNames`: ``"expressionNames"`` ; `ExpressionAttributeValues`: ``"expressionValues"``  }\> |
| `input.key` | `Key` |
| `input.update` | `RenameKeys`<`ExpressionAttributeNames`<`UpdateExpression`\> & `ExpressionAttributeValues`<`UpdateExpression`, `AttributeValue`\> & { `expression?`: `UpdateExpression`  }, { `ExpressionAttributeNames`: ``"expressionNames"`` ; `ExpressionAttributeValues`: ``"expressionValues"``  }\> |

#### Returns

`Extract`<`Item`, `AttributeKeyToObject`<`Key`\>\>

#### Defined in

[src/table.ts:160](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/table.ts#L160)
