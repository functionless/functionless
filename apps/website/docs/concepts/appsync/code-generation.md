---
sidebar_position: 3.1
---

# Generate Types from GraphQL Schema

Functionless can be used together with [graphql code generator](https://www.graphql-code-generator.com/) to automatically generate types from the schema.

Two plugins are necessary to generate resolver types:

- [typescript](https://www.graphql-code-generator.com/plugins/typescript)
- [typescript-resolver](https://www.graphql-code-generator.com/plugins/typescript-resolvers)

Both of those plugins need to be configured by creating a `codegen.yml` file.

```yaml
overwrite: true
schema:
  # The path to your schema
  - "schema.gql"
generates:
  # path to the file with the generated types
  src/generated-types.ts:
    plugins:
      - "typescript"
      - "typescript-resolvers"
    config:
      # Set to true in order to allow the Resolver type to be callable
      makeResolverTypeCallable: true
      # This will cause the generator to avoid using optionals (?), so all field resolvers must be implemented in order to avoid compilation errors
      avoidOptionals: true
      # custom type for the resolver makes it easy to reference arguments, source and result from the resolver
      customResolverFn: "{ args: TArgs; context: TContext; result: TResult; source: TParent;}"
      # appsync allows returnning undefined instead of null only when a type is optional
      maybeValue: T | null | undefined
      # typename is not really usefull for resolvers and can cause clashes in the case where a type extends another type but have different names
      skipTypename: true
```

You can then use `npx graphql-codegen --config codegen.yml` to generate a file containing the types, you should re-generate them any time you update your schema.

If you use the following schema:

```graphql
type Person {
  id: String!
  name: String!
}

type Query {
  getPerson(id: String!): ProcessedPerson
}
```

The generated types will include type definitions for all graphql types, inputs and resolvers. Those types can then be imported in your cdk app.

```ts
import { QueryResolvers, Person } from "./generated-types";
import { $util, AppsyncResolver } from "@functionless/aws-appsync-constructs";

export class PeopleDatabase extends Construct {
  readonly personTable;
  readonly getPerson;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    // Person type can be used to define your typesafe dynamodb table
    this.personTable = Table.fromTable<Person, "id", undefined>(this, "table", {
      partitionKey: {
        name: "id",
        type: aws_dynamodb.AttributeType.STRING,
      },
    });
    // QueryResolvers type can be used to get parameters for AppsyncResolver
    this.getPerson = new AppsyncResolver<
      QueryResolvers["addPerson"]["args"],
      QueryResolvers["addPerson"]["result"]
    >(
      scope,
      id,
      {
        typeName: "Query",
        fieldName: "addPerson",
      },
      async ($context) => {
        const person = await this.personTable.appsync.putItem({
          key: {
            id: {
              S: $util.autoId(),
            },
          },
          attributeValues: {
            name: {
              S: $context.arguments.input.name,
            },
          },
        });

        return person;
      }
    );
  }
}
```

Check the test-app for a full working example.
