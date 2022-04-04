[functionless](../README.md) / [Exports](../modules.md) / $util

# Interface: $util

**`see`** https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference.html

## Table of contents

### Properties

- [dynamodb](util.md#dynamodb)
- [time](util.md#time)

### Methods

- [appendError](util.md#appenderror)
- [authType](util.md#authtype)
- [autoId](util.md#autoid)
- [autoUlid](util.md#autoulid)
- [base64Decode](util.md#base64decode)
- [base64Encode](util.md#base64encode)
- [defaultIfNull](util.md#defaultifnull)
- [defaultIfNullOrBlank](util.md#defaultifnullorblank)
- [defaultIfNullOrEmpty](util.md#defaultifnullorempty)
- [error](util.md#error)
- [escapeJavaScript](util.md#escapejavascript)
- [isBoolean](util.md#isboolean)
- [isList](util.md#islist)
- [isMap](util.md#ismap)
- [isNull](util.md#isnull)
- [isNullOrBlank](util.md#isnullorblank)
- [isNullOrEmpty](util.md#isnullorempty)
- [isNumber](util.md#isnumber)
- [isString](util.md#isstring)
- [matches](util.md#matches)
- [parseJson](util.md#parsejson)
- [toJson](util.md#tojson)
- [typeOf](util.md#typeof)
- [unauthorized](util.md#unauthorized)
- [urlDecode](util.md#urldecode)
- [urlEncode](util.md#urlencode)
- [validate](util.md#validate)

## Properties

### dynamodb

• `Readonly` **dynamodb**: [`dynamodb`](dynamodb.md)

$util.dynamodb contains helper methods that make it easier to write and read data to Amazon DynamoDB, such as automatic type mapping and formatting. These methods are designed to make mapping primitive types and Lists to the proper DynamoDB input format automatically, which is a Map of the format { "TYPE" : VALUE }.

**`see`** https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference.html#dynamodb-helpers-in-util-dynamodb

#### Defined in

[src/appsync.ts:517](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L517)

___

### time

• `Readonly` **time**: [`time`](time.md)

The $util.time variable contains datetime methods to help generate timestamps, convert between datetime formats, and parse datetime strings. The syntax for datetime formats is based on DateTimeFormatter which you can reference for further documentation. Below we provide some examples, as well as a list of available methods and descriptions.

**`see`** https://docs.aws.amazon.com/appsync/latest/devguide/time-helpers-in-util-time.html

#### Defined in

[src/appsync.ts:524](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L524)

## Methods

### appendError

▸ **appendError**(`message`): `void`

Appends a custom error. This can be used in request or response mapping templates if the template detects an error with the request or with the invocation result. Unlike error(string: string), the template evaluation will not be interrupted, so that data can be returned to the caller./**

#### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` |

#### Returns

`void`

#### Defined in

[src/appsync.ts:604](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L604)

▸ **appendError**(`message`, `errorType`): `void`

Appends a custom error. This can be used in request or response mapping templates if the template detects an error with the request or with the invocation result. Additionally, an errorType can be specified. Unlike error(string, string), the template evaluation will not be interrupted, so that data can be returned to the caller./**

#### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` |
| `errorType` | `string` |

#### Returns

`void`

#### Defined in

[src/appsync.ts:609](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L609)

▸ **appendError**(`message`, `errorType`, `data`): `void`

Appends a custom error. This can be used in request or response mapping templates if the template detects an error with the request or with the invocation result. Additionally, an errorType and a data field can be specified. Unlike error(string, string, object), the template evaluation will not be interrupted, so that data can be returned to the caller. The data value will be added to the corresponding error block inside errors in the GraphQL response. Note: data will be filtered based on the query selection set./**

#### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` |
| `errorType` | `string` |
| `data` | `object` |

#### Returns

`void`

#### Defined in

[src/appsync.ts:614](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L614)

▸ **appendError**(`message`, `errorType`, `data`, `errorInfo`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` |
| `errorType` | `string` |
| `data` | `object` |
| `errorInfo` | `object` |

#### Returns

`void`

#### Defined in

[src/appsync.ts:619](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L619)

___

### authType

▸ **authType**(): `string`

Returns a string describing the multi-auth type being used by a request, returning back either "IAM Authorization", "User Pool Authorization", "Open ID Connect Authorization", or "API Key Authorization".

#### Returns

`string`

#### Defined in

[src/appsync.ts:718](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L718)

___

### autoId

▸ **autoId**(): `string`

Returns a 128-bit randomly generated UUID.

#### Returns

`string`

#### Defined in

[src/appsync.ts:564](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L564)

___

### autoUlid

▸ **autoUlid**(): `string`

Returns a 128-bit randomly generated ULID (Universally Unique Lexicographically Sortable Identifier).

#### Returns

`string`

#### Defined in

[src/appsync.ts:569](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L569)

___

### base64Decode

▸ **base64Decode**(`string`): `Buffer`

Decodes the data from a base64-encoded string.

#### Parameters

| Name | Type |
| :------ | :------ |
| `string` | `string` |

#### Returns

`Buffer`

#### Defined in

[src/appsync.ts:549](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L549)

___

### base64Encode

▸ **base64Encode**(`data`): `string`

Encodes the input into a base64-encoded string.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | `Buffer` |

#### Returns

`string`

#### Defined in

[src/appsync.ts:544](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L544)

___

### defaultIfNull

▸ **defaultIfNull**<`T`\>(`maybeVal`, `ifNull`): `T`

Returns the first object if it is not null. Otherwise, returns second object as a "default object".

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `maybeVal` | `undefined` \| ``null`` \| `T` |
| `ifNull` | `T` |

#### Returns

`T`

#### Defined in

[src/appsync.ts:664](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L664)

___

### defaultIfNullOrBlank

▸ **defaultIfNullOrBlank**<`MaybeStr`, `Default`\>(`maybeStr`, `defaultVal`): `MaybeStr` extends `undefined` \| ``""`` ? `Default` : `MaybeStr`

Returns the first string if it is not null or blank. Otherwise, returns second string as a "default string".

#### Type parameters

| Name | Type |
| :------ | :------ |
| `MaybeStr` | extends `string` |
| `Default` | extends `string` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `maybeStr` | `undefined` \| `MaybeStr` |
| `defaultVal` | `Default` |

#### Returns

`MaybeStr` extends `undefined` \| ``""`` ? `Default` : `MaybeStr`

#### Defined in

[src/appsync.ts:677](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L677)

___

### defaultIfNullOrEmpty

▸ **defaultIfNullOrEmpty**<`MaybeStr`, `Default`\>(`maybeStr`, `defaultVal`): `MaybeStr` extends `undefined` \| ``""`` ? `Default` : `MaybeStr`

Returns the first string if it is not null or empty. Otherwise, returns second string as a "default string".

#### Type parameters

| Name | Type |
| :------ | :------ |
| `MaybeStr` | extends `string` |
| `Default` | extends `string` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `maybeStr` | `undefined` \| `MaybeStr` |
| `defaultVal` | `Default` |

#### Returns

`MaybeStr` extends `undefined` \| ``""`` ? `Default` : `MaybeStr`

#### Defined in

[src/appsync.ts:669](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L669)

___

### error

▸ **error**(`errorMessage`): `never`

Throws a custom error. Use this in request or response mapping templates to detect an error with the request or with the invocation result.

#### Parameters

| Name | Type |
| :------ | :------ |
| `errorMessage` | `string` |

#### Returns

`never`

#### Defined in

[src/appsync.ts:579](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L579)

▸ **error**(`errorMessage`, `errorType`): `never`

Throws a custom error. Use this in request or response mapping templates to detect an error with the request or with the invocation result. You can also specify an errorType.

#### Parameters

| Name | Type |
| :------ | :------ |
| `errorMessage` | `string` |
| `errorType` | `string` |

#### Returns

`never`

#### Defined in

[src/appsync.ts:584](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L584)

▸ **error**(`errorMessage`, `errorType`, `errorData`): `never`

Throws a custom error. Use this in request or response mapping templates to detect an error with the request or with the invocation result. You can also specify an errorType and a data field. The data value will be added to the corresponding error block inside errors in the GraphQL response. Note: data will be filtered based on the query selection set.

#### Parameters

| Name | Type |
| :------ | :------ |
| `errorMessage` | `string` |
| `errorType` | `string` |
| `errorData` | `object` |

#### Returns

`never`

#### Defined in

[src/appsync.ts:589](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L589)

▸ **error**(`errorMessage`, `errorType`, `errorData`, `errorInfo`): `never`

Throws a custom error. This can be used in request or response mapping templates if the template detects an error with the request or with the invocation result. Additionally, an errorType field, a data field, and a errorInfo field can be specified. The data value will be added to the corresponding error block inside errors in the GraphQL response. Note: data will be filtered based on the query selection set. The errorInfo value will be added to the corresponding error block inside errors in the GraphQL response. Note: errorInfo will NOT be filtered based on the query selection set.

#### Parameters

| Name | Type |
| :------ | :------ |
| `errorMessage` | `string` |
| `errorType` | `string` |
| `errorData` | `object` |
| `errorInfo` | `object` |

#### Returns

`never`

#### Defined in

[src/appsync.ts:594](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L594)

___

### escapeJavaScript

▸ **escapeJavaScript**(`js`): `string`

Returns the input string as a JavaScript escaped string.

#### Parameters

| Name | Type |
| :------ | :------ |
| `js` | `string` |

#### Returns

`string`

#### Defined in

[src/appsync.ts:529](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L529)

___

### isBoolean

▸ **isBoolean**(`obj`): obj is boolean

Returns true if object is a Boolean.

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj` | `any` |

#### Returns

obj is boolean

#### Defined in

[src/appsync.ts:695](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L695)

___

### isList

▸ **isList**(`obj`): obj is any[]

Returns true if object is a List.

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj` | `any` |

#### Returns

obj is any[]

#### Defined in

[src/appsync.ts:700](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L700)

___

### isMap

▸ **isMap**(`obj`): obj is Record<string, any\>

Returns true if object is a Map.

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj` | `any` |

#### Returns

obj is Record<string, any\>

#### Defined in

[src/appsync.ts:705](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L705)

___

### isNull

▸ **isNull**(`obj`): `boolean`

Returns true if the supplied object is null.

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj` | `object` |

#### Returns

`boolean`

#### Defined in

[src/appsync.ts:649](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L649)

___

### isNullOrBlank

▸ **isNullOrBlank**(`string`): `boolean`

Returns true if the supplied data is null or a blank string. Otherwise, returns false.

#### Parameters

| Name | Type |
| :------ | :------ |
| `string` | `string` |

#### Returns

`boolean`

#### Defined in

[src/appsync.ts:659](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L659)

___

### isNullOrEmpty

▸ **isNullOrEmpty**(`string`): `boolean`

Returns true if the supplied data is null or an empty string. Otherwise, returns false.

#### Parameters

| Name | Type |
| :------ | :------ |
| `string` | `string` |

#### Returns

`boolean`

#### Defined in

[src/appsync.ts:654](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L654)

___

### isNumber

▸ **isNumber**(`obj`): obj is number

Returns true if object is a Number.

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj` | `any` |

#### Returns

obj is number

#### Defined in

[src/appsync.ts:690](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L690)

___

### isString

▸ **isString**(`obj`): obj is string

Returns true if object is a string.

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj` | `any` |

#### Returns

obj is string

#### Defined in

[src/appsync.ts:685](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L685)

___

### matches

▸ **matches**(`pattern`, `data`): `boolean`

Returns true if the specified pattern in the first argument matches the supplied data in the second argument. The pattern must be a regular expression such as matches("a*b", "aaaaab"). The functionality is based on Pattern, which you can reference for further documentation./**

#### Parameters

| Name | Type |
| :------ | :------ |
| `pattern` | `string` |
| `data` | `string` |

#### Returns

`boolean`

#### Defined in

[src/appsync.ts:714](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L714)

___

### parseJson

▸ **parseJson**(`string`): `object`

Takes "stringified" JSON and returns an object representation of the result.

#### Parameters

| Name | Type |
| :------ | :------ |
| `string` | `string` |

#### Returns

`object`

#### Defined in

[src/appsync.ts:554](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L554)

___

### toJson

▸ **toJson**(`obj`): `string`

Takes an object and returns a "stringified" JSON representation of that object.

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj` | `object` |

#### Returns

`string`

#### Defined in

[src/appsync.ts:559](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L559)

___

### typeOf

▸ **typeOf**(`obj`): `string`

Returns a string describing the type of the object. Supported type identifications are: "Null", "Number", "string", "Map", "List", "Boolean". If a type cannot be identified, the return type is "object".

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj` | `object` |

#### Returns

`string`

#### Defined in

[src/appsync.ts:710](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L710)

___

### unauthorized

▸ **unauthorized**(): `never`

Throws Unauthorized for the field being resolved. Use this in request or response mapping templates to determine whether to allow the caller to resolve the field.

#### Returns

`never`

#### Defined in

[src/appsync.ts:574](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L574)

___

### urlDecode

▸ **urlDecode**(`string`): `string`

Decodes an application/x-www-form-urlencoded encoded string back to its non-encoded form.

#### Parameters

| Name | Type |
| :------ | :------ |
| `string` | `string` |

#### Returns

`string`

#### Defined in

[src/appsync.ts:539](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L539)

___

### urlEncode

▸ **urlEncode**(`string`): `string`

Returns the input string as an application/x-www-form-urlencoded encoded string.

#### Parameters

| Name | Type |
| :------ | :------ |
| `string` | `string` |

#### Returns

`string`

#### Defined in

[src/appsync.ts:534](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L534)

___

### validate

▸ **validate**(`condition`, `message`): `never`

If the condition is false, throw a CustomTemplateException with the specified message.

#### Parameters

| Name | Type |
| :------ | :------ |
| `condition` | `boolean` |
| `message` | `string` |

#### Returns

`never`

#### Defined in

[src/appsync.ts:629](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L629)

▸ **validate**(`condition`, `message`, `data`): `void`

If the condition is false, throw a CustomTemplateException with the specified message and error type.

#### Parameters

| Name | Type |
| :------ | :------ |
| `condition` | `boolean` |
| `message` | `string` |
| `data` | `object` |

#### Returns

`void`

#### Defined in

[src/appsync.ts:634](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L634)

▸ **validate**(`condition`, `message`, `data`, `info`): `void`

If the condition is false, throw a CustomTemplateException with the specified message and error type, as well as data to return in the response.

#### Parameters

| Name | Type |
| :------ | :------ |
| `condition` | `boolean` |
| `message` | `string` |
| `data` | `object` |
| `info` | `object` |

#### Returns

`void`

#### Defined in

[src/appsync.ts:639](https://github.com/sam-goodwin/functionless/blob/3947743/src/appsync.ts#L639)
