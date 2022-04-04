[functionless](../README.md) / [Exports](../modules.md) / AppsyncResolver

# Class: AppsyncResolver<Arguments, Result, Source\>

An AWS AppSync Resolver Function derived from TypeScript syntax.

First, you must wrap a CDK L2 Construct in the corresponding Functionless type-safe interfaces.
```ts
const table = new Table<Person, "id">(new aws_dynamodb.Table(scope, "id", props));
```

Then, call the table from within the new AppsyncResolver:
```ts
const getPerson = new AppsyncResolver<{id: string}, Person | undefined>(
  ($context, id) => {
    const person = table.get({
      key: {
        id: $util.toDynamoDB(id)
      }
    });
    return person;
  });
```

Finally, the `getPerson` function can be used to create resolvers on a GraphQL API
```ts
import * as appsync from "@aws-cdk/aws-appsync-alpha";

const api = new appsync.GraphQLApi(..);

getPerson.createResolver(api, {
  typeName: "Query",
  fieldName: "getPerson"
});
```

**`functionless`** AppsyncFunction

## Type parameters

| Name | Type |
| :------ | :------ |
| `Arguments` | extends [`ResolverArguments`](../interfaces/ResolverArguments.md) |
| `Result` | `Result` |
| `Source` | `undefined` |

## Table of contents

### Constructors

- [constructor](AppsyncResolver.md#constructor)

### Properties

- [decl](AppsyncResolver.md#decl)
- [FunctionlessType](AppsyncResolver.md#functionlesstype)

### Methods

- [addResolver](AppsyncResolver.md#addresolver)

## Constructors

### constructor

• **new AppsyncResolver**<`Arguments`, `Result`, `Source`\>(`fn`)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Arguments` | extends [`ResolverArguments`](../interfaces/ResolverArguments.md) |
| `Result` | `Result` |
| `Source` | `undefined` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `fn` | [`ResolverFunction`](../modules.md#resolverfunction)<`Arguments`, `Result`, `Source`\> |

#### Defined in

[src/appsync.ts:126](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L126)

## Properties

### decl

• `Readonly` **decl**: [`FunctionDecl`](FunctionDecl.md)<[`ResolverFunction`](../modules.md#resolverfunction)<`Arguments`, `Result`, `Source`\>\>

#### Defined in

[src/appsync.ts:122](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L122)

___

### FunctionlessType

▪ `Static` `Readonly` **FunctionlessType**: ``"AppsyncResolver"``

This static property identifies this class as an AppsyncResolver to the TypeScript plugin.

#### Defined in

[src/appsync.ts:120](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L120)

## Methods

### addResolver

▸ **addResolver**(`api`, `options`): [`SynthesizedAppsyncResolver`](SynthesizedAppsyncResolver.md)

Generate and add an AWS Appsync Resolver to an AWS Appsync GraphQL API.

```ts
import * as appsync from "@aws-cdk/aws-appsync-alpha";

const api = new appsync.GraphQLApi(..);

getPerson.createResolver(api, {
  typeName: "Query",
  fieldName: "getPerson"
});
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `api` | `GraphqlApi` | the AWS Appsync API to add this Resolver to |
| `options` | `Pick`<`BaseResolverProps`, ``"typeName"`` \| ``"fieldName"`` \| ``"cachingConfig"``\> | typeName, fieldName and cachingConfig for this Resolver. |

#### Returns

[`SynthesizedAppsyncResolver`](SynthesizedAppsyncResolver.md)

a reference to the generated {@link appsync.Resolver}.

#### Defined in

[src/appsync.ts:154](https://github.com/sam-goodwin/functionless/blob/261ad48/src/appsync.ts#L154)
