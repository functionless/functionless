import {
  App,
  aws_apigateway,
  aws_dynamodb,
  aws_lambda,
  Stack,
} from "aws-cdk-lib";
// import * as appsync from "@aws-cdk/aws-appsync-alpha";
// import path from "path";
// import { PeopleDatabase, Person } from "./people-db";
// import { EventBus, EventBusRuleInput } from "functionless";
// import { PeopleEvents } from "./people-events";
import { ApiIntegration, Function, Table } from "functionless";

export const app = new App();

const stack = new Stack(app, "fluent-stack");

const restApi = new aws_apigateway.RestApi(stack, "fluent-api");

const lambdaCode = `exports.handler = async (event, context) => {
  console.log(event);
  return { foo: event.num * 2 };
}`;

const fn = new Function<{ num: number }, { foo: number }>(
  new aws_lambda.Function(stack, "fluent-fn", {
    code: new aws_lambda.InlineCode(lambdaCode),
    runtime: aws_lambda.Runtime.NODEJS_14_X,
    handler: "index.handler",
  })
);

new ApiIntegration<{ pathParameters: { num: number } }>()
  .transformRequest((n) => ({
    num: n.pathParameters.num + 1,
  }))
  .call(fn)
  .handleResponse((n) => ({ bar: n.foo }))
  .addMethod("{num}", restApi);

const table = new Table<{ id: string }, "id">(
  new aws_dynamodb.Table(stack, "fluent-table", {
    partitionKey: { name: "id", type: aws_dynamodb.AttributeType.STRING },
  })
);

new ApiIntegration<{ pathParameters: { num: number } }>()
  .transformRequest((req) => ({
    key: {
      pk: {
        S: `Post|${req.pathParameters.num}`,
      },
      sk: {
        S: "Post",
      },
    },
  }))
  .call(table)
  .handleResponse((n) => ({ bar: n }))
  .addMethod("{num2}", restApi);

// const schema = new appsync.Schema({
//   filePath: path.join(__dirname, "..", "schema.gql"),
// });

// const api = new appsync.GraphqlApi(stack, "Api", {
//   name: "demo",
//   schema,
//   authorizationConfig: {
//     defaultAuthorization: {
//       authorizationType: appsync.AuthorizationType.IAM,
//     },
//   },
//   xrayEnabled: true,
//   logConfig: {
//     fieldLogLevel: appsync.FieldLogLevel.ALL,
//   },
// });

// // @ts-ignore
// const peopleDb = new PeopleDatabase(stack, "PeopleDB");

// peopleDb.getPerson.addResolver(api, {
//   typeName: "Query",
//   fieldName: "getPerson",
// });

// peopleDb.addPerson.addResolver(api, {
//   typeName: "Mutation",
//   fieldName: "addPerson",
// });

// // add a duplicate addPerson API to test duplicates
// peopleDb.addPerson.addResolver(api, {
//   typeName: "Mutation",
//   fieldName: "addPerson2",
// });

// peopleDb.updateName.addResolver(api, {
//   typeName: "Mutation",
//   fieldName: "updateName",
// });

// peopleDb.deletePerson.addResolver(api, {
//   typeName: "Mutation",
//   fieldName: "deletePerson",
// });

// interface MyEventDetails {
//   value: string;
// }

// interface MyEvent extends EventBusRuleInput<MyEventDetails> {}

// new EventBus<MyEvent>(stack, "bus")
//   .when(stack, "aRule", (event) => event.detail.value === "hello")
//   .map<Person>((event) => ({
//     id: event.source,
//     name: event.detail.value,
//   }))
//   .pipe(peopleDb.computeScore);

// new PeopleEvents(stack, "peopleEvents");
