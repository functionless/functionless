import "jest";

import * as path from "path";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { App, Stack } from "aws-cdk-lib";
import { PeopleDatabase, ProcessedPerson } from "./people-db";
import { $util } from "../src/util";
import { appsyncFunction } from "../src/function";

it("should render a function", () => {
  const app = new App({
    autoSynth: false,
  });
  const stack = new Stack(app, "stack");

  const schema = new appsync.Schema({
    filePath: path.join(__dirname, "schema.gql"),
  });

  const api = new appsync.GraphqlApi(stack, "Api", {
    name: "demo",
    schema,
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: appsync.AuthorizationType.IAM,
      },
    },
    xrayEnabled: true,
  });

  const { personTable, computeScore } = new PeopleDatabase(stack, "People");

  const getItem = appsyncFunction<(id: string) => ProcessedPerson | null>(
    (_$context, id) => {
      const person = personTable.getItem({
        Key: {
          id: $util.dynamodb.toDynamoDB(id),
        },
      });

      if (person === undefined) {
        return null;
      }

      const score = computeScore(person);

      return {
        ...person,
        score,
      };
    }
  );

  const resolver = getItem.addResolver(api, {
    typeName: "Query",
    fieldName: "getPerson",
  });

  expect(resolver).toEqual({});
});
