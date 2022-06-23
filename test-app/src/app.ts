import path from "path";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { App, Stack } from "aws-cdk-lib";
import { EventBus, Event } from "functionless";
import { PeopleDatabase, Person } from "./people-db";
import { PeopleEvents } from "./people-events";

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
  logConfig: {
    fieldLogLevel: appsync.FieldLogLevel.ALL,
  },
});

// @ts-ignore
const peopleDb = new PeopleDatabase(stack, "PeopleDB", {
  api,
});

interface MyEventDetails {
  value: string;
}

interface MyEvent extends Event<MyEventDetails> {}

new EventBus<MyEvent>(stack, "bus")
  .when(stack, "aRule", (event) => event.detail.value === "hello")
  .map(
    (event) =>
      <Person>{
        id: event.source,
        name: event.detail.value,
      }
  )
  .pipe(peopleDb.computeScore);

new PeopleEvents(stack, "peopleEvents");
