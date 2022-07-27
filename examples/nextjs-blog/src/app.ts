import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { App, aws_dynamodb, Stack } from "aws-cdk-lib";
import { AppsyncResolver, Table } from "functionless";

const app = new App();
const stack = new Stack(app, "stack");

interface Person {
  id: string;
  name: string;
}

const table = new Table<Person, "id">(stack, "Table", {
  partitionKey: {
    name: "id",
    type: aws_dynamodb.AttributeType.STRING,
  },
});

const api = new appsync.GraphqlApi(stack, "api", {
  name: "api",
});

const Person = api.addType(
  new appsync.ObjectType("Person", {
    definition: {
      name: appsync.GraphqlType.string(),
    },
  })
);

api.addQuery(
  "getPerson",
  new appsync.Field({
    returnType: Person.attribute(),
    args: {
      id: appsync.GraphqlType.string(),
    },
  })
);

const resolver = new AppsyncResolver<{ id: string }, Person>(($context) => {
  return table.getItem({
    key: {
      id: {
        S: $context.arguments.id,
      },
    },
  });
});

resolver.addResolver(api, {
  typeName: "Query",
  fieldName: "getPerson",
});
