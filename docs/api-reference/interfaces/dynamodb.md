[functionless](../README.md) / [Exports](../modules.md) / dynamodb

# Interface: dynamodb

$util.dynamodb contains helper methods that make it easier to write and read data to Amazon DynamoDB, such as automatic type mapping and formatting. These methods are designed to make mapping primitive types and Lists to the proper DynamoDB input format automatically, which is a Map of the format { "TYPE" : VALUE }.

**`see`** https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference.html#dynamodb-helpers-in-util-dynamodb

## Table of contents

### Methods

- [toDynamoDB](dynamodb.md#todynamodb)
- [toMapValues](dynamodb.md#tomapvalues)

## Methods

### toDynamoDB

▸ **toDynamoDB**<`T`\>(`value`): `ToAttributeValue`<`T`\>

General object conversion tool for DynamoDB that converts input objects to the appropriate DynamoDB representation. It's opinionated about how it represents some types: e.g., it will use lists ("L") rather than sets ("SS", "NS", "BS"). This returns an object that describes the DynamoDB attribute value.

**`see`** https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `value` | `T` | a JSON value to convert {@link ToAttributeValue}. |

#### Returns

`ToAttributeValue`<`T`\>

#### Defined in

[src/appsync.ts:500](https://github.com/sam-goodwin/functionless/blob/6691871/src/appsync.ts#L500)

___

### toMapValues

▸ **toMapValues**<`T`\>(`value`): `ToAttributeMap`<`T`\>

Creates a copy of the map where each value has been converted to its appropriate DynamoDB format. It's opinionated about how it represents some of the nested objects: e.g., it will use lists ("L") rather than sets ("SS", "NS", "BS").

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `object` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `value` | `T` | an object to convert {@link ToAttributeMap} |

#### Returns

`ToAttributeMap`<`T`\>

#### Defined in

[src/appsync.ts:505](https://github.com/sam-goodwin/functionless/blob/6691871/src/appsync.ts#L505)
