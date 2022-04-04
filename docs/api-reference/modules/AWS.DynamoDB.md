[functionless](../README.md) / [Exports](../modules.md) / [$AWS](AWS.md) / DynamoDB

# Namespace: DynamoDB

[$AWS](AWS.md).DynamoDB

**`see`** https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html

## Table of contents

### Functions

- [DeleteItem](AWS.DynamoDB.md#deleteitem)
- [GetItem](AWS.DynamoDB.md#getitem)
- [PutItem](AWS.DynamoDB.md#putitem)
- [Query](AWS.DynamoDB.md#query)
- [Scan](AWS.DynamoDB.md#scan)
- [UpdateItem](AWS.DynamoDB.md#updateitem)

## Functions

### DeleteItem

▸ **DeleteItem**<`T`, `Key`, `ConditionExpression`, `ReturnValue`\>(`input`): `DeleteItemOutput`<`Item`<`T`\>, `ReturnValue`, `JsonFormat.AttributeValue`\>

**`see`** https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Table`](../classes/Table.md)<`any`, `any`, `any`, `T`\> |
| `Key` | `Key` |
| `ConditionExpression` | extends `undefined` \| `string` |
| `ReturnValue` | extends `string` = ``"NONE"`` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | { `TableName`: `T`  } & `Omit`<`DeleteItemInput`<`Item`<`T`\>, `PartitionKey`<`T`\>, `RangeKey`<`T`\>, `Key`, `ConditionExpression`, `ReturnValue`, `AttributeValue`\>, ``"TableName"``\> |

#### Returns

`DeleteItemOutput`<`Item`<`T`\>, `ReturnValue`, `JsonFormat.AttributeValue`\>

#### Defined in

[src/aws.ts:65](https://github.com/sam-goodwin/functionless/blob/6691871/src/aws.ts#L65)

___

### GetItem

▸ **GetItem**<`T`, `Key`, `AttributesToGet`, `ProjectionExpression`\>(`input`): `GetItemOutput`<`Item`<`T`\>, `PartitionKey`<`T`\>, `RangeKey`<`T`\>, `Key`, `AttributesToGet`, `ProjectionExpression`, `JsonFormat.AttributeValue`\>

**`see`** https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Table`](../classes/Table.md)<`any`, `any`, `any`, `T`\> |
| `Key` | `Key` |
| `AttributesToGet` | extends `undefined` \| `string` \| `number` \| `symbol` = `undefined` |
| `ProjectionExpression` | extends `undefined` \| `string` = `undefined` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | { `TableName`: `T`  } & `Omit`<`GetItemInput`<`Item`<`T`\>, `PartitionKey`<`T`\>, `RangeKey`<`T`\>, `Key`, `AttributesToGet`, `ProjectionExpression`, `AttributeValue`\>, ``"TableName"``\> |

#### Returns

`GetItemOutput`<`Item`<`T`\>, `PartitionKey`<`T`\>, `RangeKey`<`T`\>, `Key`, `AttributesToGet`, `ProjectionExpression`, `JsonFormat.AttributeValue`\>

#### Defined in

[src/aws.ts:102](https://github.com/sam-goodwin/functionless/blob/6691871/src/aws.ts#L102)

___

### PutItem

▸ **PutItem**<`T`, `I`, `ConditionExpression`, `ReturnValue`, `ProjectionExpression`\>(`input`): `PutItemOutput`<`I`, `ReturnValue`, `JsonFormat.AttributeValue`\>

**`see`** https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Table`](../classes/Table.md)<`any`, `any`, `any`, `T`\> |
| `I` | extends `any` |
| `ConditionExpression` | extends `undefined` \| `string` = `undefined` |
| `ReturnValue` | extends `string` = ``"NONE"`` |
| `ProjectionExpression` | extends `undefined` \| `string` = `undefined` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | { `TableName`: `T`  } & `Omit`<`PutItemInput`<`Item`<`T`\>, `ConditionExpression`, `ReturnValue`, `AttributeValue`\>, ``"TableName"``\> |

#### Returns

`PutItemOutput`<`I`, `ReturnValue`, `JsonFormat.AttributeValue`\>

#### Defined in

[src/aws.ts:193](https://github.com/sam-goodwin/functionless/blob/6691871/src/aws.ts#L193)

___

### Query

▸ **Query**<`T`, `KeyConditionExpression`, `FilterExpression`, `ProjectionExpression`, `AttributesToGet`\>(`input`): `QueryOutput`<`Item`<`T`\>, `AttributesToGet`, `JsonFormat.AttributeValue`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Table`](../classes/Table.md)<`any`, `any`, `any`, `T`\> |
| `KeyConditionExpression` | extends `string` |
| `FilterExpression` | extends `undefined` \| `string` = `undefined` |
| `ProjectionExpression` | extends `undefined` \| `string` = `undefined` |
| `AttributesToGet` | extends `undefined` \| `string` \| `number` \| `symbol` = `undefined` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | { `TableName`: `T`  } & `Omit`<`QueryInput`<`Item`<`T`\>, `KeyConditionExpression`, `FilterExpression`, `ProjectionExpression`, `AttributesToGet`, `AttributeValue`\>, ``"TableName"``\> |

#### Returns

`QueryOutput`<`Item`<`T`\>, `AttributesToGet`, `JsonFormat.AttributeValue`\>

#### Defined in

[src/aws.ts:219](https://github.com/sam-goodwin/functionless/blob/6691871/src/aws.ts#L219)

___

### Scan

▸ **Scan**<`T`, `FilterExpression`, `ProjectionExpression`, `AttributesToGet`\>(`input`): `ScanOutput`<`Item`<`T`\>, `AttributesToGet`, `JsonFormat.AttributeValue`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Table`](../classes/Table.md)<`any`, `any`, `any`, `T`\> |
| `FilterExpression` | extends `undefined` \| `string` = `undefined` |
| `ProjectionExpression` | extends `undefined` \| `string` = `undefined` |
| `AttributesToGet` | extends `undefined` \| `string` \| `number` \| `symbol` = `undefined` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | { `TableName`: `T`  } & `Omit`<`ScanInput`<`Item`<`T`\>, `FilterExpression`, `ProjectionExpression`, `AttributesToGet`, `AttributeValue`\>, ``"TableName"``\> |

#### Returns

`ScanOutput`<`Item`<`T`\>, `AttributesToGet`, `JsonFormat.AttributeValue`\>

#### Defined in

[src/aws.ts:245](https://github.com/sam-goodwin/functionless/blob/6691871/src/aws.ts#L245)

___

### UpdateItem

▸ **UpdateItem**<`T`, `Key`, `UpdateExpression`, `ConditionExpression`, `ReturnValue`, `AttributesToGet`, `ProjectionExpression`\>(`input`): `UpdateItemOutput`<`Item`<`T`\>, `PartitionKey`<`T`\>, `RangeKey`<`T`\>, `Key`, `ReturnValue`, `JsonFormat.AttributeValue`\>

**`see`** https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Table`](../classes/Table.md)<`any`, `any`, `any`, `T`\> |
| `Key` | `Key` |
| `UpdateExpression` | extends `string` |
| `ConditionExpression` | extends `undefined` \| `string` = `undefined` |
| `ReturnValue` | extends `string` = ``"NONE"`` |
| `AttributesToGet` | extends `undefined` \| `string` \| `number` \| `symbol` = `undefined` |
| `ProjectionExpression` | extends `undefined` \| `string` = `undefined` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | { `TableName`: `T`  } & `Omit`<`UpdateItemInput`<`Item`<`T`\>, `PartitionKey`<`T`\>, `RangeKey`<`T`\>, `Key`, `UpdateExpression`, `ConditionExpression`, `ReturnValue`, `AttributeValue`\>, ``"TableName"``\> |

#### Returns

`UpdateItemOutput`<`Item`<`T`\>, `PartitionKey`<`T`\>, `RangeKey`<`T`\>, `Key`, `ReturnValue`, `JsonFormat.AttributeValue`\>

#### Defined in

[src/aws.ts:146](https://github.com/sam-goodwin/functionless/blob/6691871/src/aws.ts#L146)
