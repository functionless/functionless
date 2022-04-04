[functionless](../README.md) / [Exports](../modules.md) / time

# Interface: time

## Table of contents

### Methods

- [epochMilliSecondsToFormatted](time.md#epochmillisecondstoformatted)
- [epochMilliSecondsToISO8601](time.md#epochmillisecondstoiso8601)
- [epochMilliSecondsToSeconds](time.md#epochmillisecondstoseconds)
- [nowEpochMilliSeconds](time.md#nowepochmilliseconds)
- [nowEpochSeconds](time.md#nowepochseconds)
- [nowFormatted](time.md#nowformatted)
- [nowISO8601](time.md#nowiso8601)
- [parseFormattedToEpochMilliSeconds](time.md#parseformattedtoepochmilliseconds)
- [parseISO8601ToEpochMilliSeconds](time.md#parseiso8601toepochmilliseconds)

## Methods

### epochMilliSecondsToFormatted

▸ **epochMilliSecondsToFormatted**(`epoch`, `format`): `string`

Converts a epoch milliseconds timestamp, passed as long, to a timestamp formatted according to the supplied format in UTC.

#### Parameters

| Name | Type |
| :------ | :------ |
| `epoch` | `number` |
| `format` | `string` |

#### Returns

`string`

#### Defined in

[src/appsync.ts:779](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L779)

▸ **epochMilliSecondsToFormatted**(`epoch`, `format`, `timezone`): `string`

Converts a epoch milliseconds timestamp, passed as a long, to a timestamp formatted according to the supplied format in the supplied timezone.

#### Parameters

| Name | Type |
| :------ | :------ |
| `epoch` | `number` |
| `format` | `string` |
| `timezone` | `string` |

#### Returns

`string`

#### Defined in

[src/appsync.ts:784](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L784)

___

### epochMilliSecondsToISO8601

▸ **epochMilliSecondsToISO8601**(`epoch`): `string`

Converts a epoch milliseconds timestamp to an ISO8601 timestamp.

#### Parameters

| Name | Type |
| :------ | :------ |
| `epoch` | `number` |

#### Returns

`string`

#### Defined in

[src/appsync.ts:774](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L774)

___

### epochMilliSecondsToSeconds

▸ **epochMilliSecondsToSeconds**(`epoch`): `number`

Converts an epoch milliseconds timestamp to an epoch seconds timestamp.

#### Parameters

| Name | Type |
| :------ | :------ |
| `epoch` | `number` |

#### Returns

`number`

#### Defined in

[src/appsync.ts:769](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L769)

___

### nowEpochMilliSeconds

▸ **nowEpochMilliSeconds**(): `number`

Returns the number of milliseconds from the epoch of 1970-01-01T00:00:00Z to now.

#### Returns

`number`

#### Defined in

[src/appsync.ts:735](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L735)

___

### nowEpochSeconds

▸ **nowEpochSeconds**(): `number`

Returns the number of seconds from the epoch of 1970-01-01T00:00:00Z to now.

#### Returns

`number`

#### Defined in

[src/appsync.ts:730](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L730)

___

### nowFormatted

▸ **nowFormatted**(`format`): `string`

Returns a string of the current timestamp in UTC using the specified format from a String input type.

#### Parameters

| Name | Type |
| :------ | :------ |
| `format` | `string` |

#### Returns

`string`

#### Defined in

[src/appsync.ts:740](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L740)

▸ **nowFormatted**(`format`, `timezone`): `string`

Returns a string of the current timestamp for a timezone using the specified format and timezone from String input types.

#### Parameters

| Name | Type |
| :------ | :------ |
| `format` | `string` |
| `timezone` | `string` |

#### Returns

`string`

#### Defined in

[src/appsync.ts:745](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L745)

___

### nowISO8601

▸ **nowISO8601**(): `string`

Returns a String representation of UTC in ISO8601 format.

#### Returns

`string`

#### Defined in

[src/appsync.ts:725](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L725)

___

### parseFormattedToEpochMilliSeconds

▸ **parseFormattedToEpochMilliSeconds**(`timestamp`, `format`): `number`

Parses a timestamp passed as a String, along with a format, and return the timestamp as milliseconds since epoch.

#### Parameters

| Name | Type |
| :------ | :------ |
| `timestamp` | `string` |
| `format` | `string` |

#### Returns

`number`

#### Defined in

[src/appsync.ts:750](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L750)

▸ **parseFormattedToEpochMilliSeconds**(`timestamp`, `format`, `timezone`): `number`

Parses a timestamp passed as a String, along with a format and time zone, and return the timestamp as milliseconds since epoch.

#### Parameters

| Name | Type |
| :------ | :------ |
| `timestamp` | `string` |
| `format` | `string` |
| `timezone` | `string` |

#### Returns

`number`

#### Defined in

[src/appsync.ts:755](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L755)

___

### parseISO8601ToEpochMilliSeconds

▸ **parseISO8601ToEpochMilliSeconds**(`timestamp`): `number`

Parses an ISO8601 timestamp, passed as a String, and return the timestamp as milliseconds since epoch.

#### Parameters

| Name | Type |
| :------ | :------ |
| `timestamp` | `string` |

#### Returns

`number`

#### Defined in

[src/appsync.ts:764](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L764)
