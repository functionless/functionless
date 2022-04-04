[functionless](../README.md) / [Exports](../modules.md) / [$AWS](AWS.md) / Lambda

# Namespace: Lambda

[$AWS](AWS.md).Lambda

## Table of contents

### Functions

- [Invoke](AWS.Lambda.md#invoke)

## Functions

### Invoke

▸ **Invoke**<`Input`, `Output`\>(`input`): `Omit`<`AWS.Lambda.InvocationResponse`, ``"payload"``\> & { `Payload`: `Output`  }

**`see`** https://docs.aws.amazon.com/lambda/latest/dg/API_Invoke.html

#### Type parameters

| Name |
| :------ |
| `Input` |
| `Output` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | `Object` |
| `input.ClientContext?` | `string` |
| `input.FunctionName` | [`Function`](../classes/Function.md)<`Input`, `Output`\> |
| `input.InvocationType?` | ``"Event"`` \| ``"RequestResponse"`` \| ``"DryRun"`` |
| `input.LogType?` | ``"None"`` \| ``"Tail"`` |
| `input.Payload` | `Input` |
| `input.Qualifier?` | `string` |

#### Returns

`Omit`<`AWS.Lambda.InvocationResponse`, ``"payload"``\> & { `Payload`: `Output`  }

#### Defined in

[src/aws.ts:324](https://github.com/sam-goodwin/functionless/blob/96a5ccc/src/aws.ts#L324)
