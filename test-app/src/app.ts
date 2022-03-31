import { App, aws_events, Stack } from "aws-cdk-lib";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import path from "path";
import { PeopleDatabase, Person } from "./people-db";
import { EventBus, EventBusRuleInput } from "functionless";

export const app = new App();

const stack = new Stack(app, "stack");

const schema = new appsync.Schema({
  filePath: path.join(__dirname, "..", "schema.gql"),
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

// @ts-ignore
const peopleDb = new PeopleDatabase(stack, "PeopleDB");

peopleDb.getPerson.addResolver(api, {
  typeName: "Query",
  fieldName: "getPerson",
});

peopleDb.addPerson.addResolver(api, {
  typeName: "Mutation",
  fieldName: "addPerson",
});

// add a duplicate addPerson API to test duplicates
peopleDb.addPerson.addResolver(api, {
  typeName: "Mutation",
  fieldName: "addPerson2",
});

peopleDb.updateName.addResolver(api, {
  typeName: "Mutation",
  fieldName: "updateName",
});

peopleDb.deletePerson.addResolver(api, {
  typeName: "Mutation",
  fieldName: "deletePerson",
});

type MyEvent = EventBusRuleInput<{
  value: string;
}>;

new EventBus<MyEvent>(new aws_events.EventBus(stack, "bus"))
  .when(stack, "aRule", (event) => event.detail.value === "hello")
  .map<Person>((event) => ({
    id: event.source,
    name: event.detail.value,
  }))
  .pipe(peopleDb.computeScore);
