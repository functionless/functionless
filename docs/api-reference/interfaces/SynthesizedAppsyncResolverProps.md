[functionless](../README.md) / [Exports](../modules.md) / SynthesizedAppsyncResolverProps

# Interface: SynthesizedAppsyncResolverProps

## Hierarchy

- `ResolverProps`

  ↳ **`SynthesizedAppsyncResolverProps`**

## Table of contents

### Properties

- [api](SynthesizedAppsyncResolverProps.md#api)
- [cachingConfig](SynthesizedAppsyncResolverProps.md#cachingconfig)
- [dataSource](SynthesizedAppsyncResolverProps.md#datasource)
- [fieldName](SynthesizedAppsyncResolverProps.md#fieldname)
- [pipelineConfig](SynthesizedAppsyncResolverProps.md#pipelineconfig)
- [requestMappingTemplate](SynthesizedAppsyncResolverProps.md#requestmappingtemplate)
- [responseMappingTemplate](SynthesizedAppsyncResolverProps.md#responsemappingtemplate)
- [templates](SynthesizedAppsyncResolverProps.md#templates)
- [typeName](SynthesizedAppsyncResolverProps.md#typename)

## Properties

### api

• `Readonly` **api**: `IGraphqlApi`

The API this resolver is attached to

#### Inherited from

appsync.ResolverProps.api

#### Defined in

node_modules/@aws-cdk/aws-appsync-alpha/lib/resolver.d.ts:63

___

### cachingConfig

• `Optional` `Readonly` **cachingConfig**: `CachingConfig`

The caching configuration for this resolver

**`default`** - No caching configuration

#### Inherited from

appsync.ResolverProps.cachingConfig

#### Defined in

node_modules/@aws-cdk/aws-appsync-alpha/lib/resolver.d.ts:43

___

### dataSource

• `Optional` `Readonly` **dataSource**: `BaseDataSource`

The data source this resolver is using

**`default`** - No datasource

#### Inherited from

appsync.ResolverProps.dataSource

#### Defined in

node_modules/@aws-cdk/aws-appsync-alpha/lib/resolver.d.ts:54

___

### fieldName

• `Readonly` **fieldName**: `string`

name of the GraphQL field in the given type this resolver is attached to

#### Inherited from

appsync.ResolverProps.fieldName

#### Defined in

node_modules/@aws-cdk/aws-appsync-alpha/lib/resolver.d.ts:18

___

### pipelineConfig

• `Optional` `Readonly` **pipelineConfig**: `IAppsyncFunction`[]

configuration of the pipeline resolver

**`default`** - no pipeline resolver configuration
An empty array | undefined sets resolver to be of kind, unit

#### Inherited from

appsync.ResolverProps.pipelineConfig

#### Defined in

node_modules/@aws-cdk/aws-appsync-alpha/lib/resolver.d.ts:25

___

### requestMappingTemplate

• `Optional` `Readonly` **requestMappingTemplate**: `MappingTemplate`

The request mapping template for this resolver

**`default`** - No mapping template

#### Inherited from

appsync.ResolverProps.requestMappingTemplate

#### Defined in

node_modules/@aws-cdk/aws-appsync-alpha/lib/resolver.d.ts:31

___

### responseMappingTemplate

• `Optional` `Readonly` **responseMappingTemplate**: `MappingTemplate`

The response mapping template for this resolver

**`default`** - No mapping template

#### Inherited from

appsync.ResolverProps.responseMappingTemplate

#### Defined in

node_modules/@aws-cdk/aws-appsync-alpha/lib/resolver.d.ts:37

___

### templates

• `Readonly` **templates**: `string`[]

#### Defined in

[src/appsync.ts:55](https://github.com/sam-goodwin/functionless/blob/6691871/src/appsync.ts#L55)

___

### typeName

• `Readonly` **typeName**: `string`

name of the GraphQL type this resolver is attached to

#### Inherited from

appsync.ResolverProps.typeName

#### Defined in

node_modules/@aws-cdk/aws-appsync-alpha/lib/resolver.d.ts:14
