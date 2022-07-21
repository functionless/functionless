// App Sync Resolvers don't really work on localstack - testing using test-app on AWS for now.
// 1. Create, Update, Delete don't seem to work - https://github.com/localstack/localstack/issues/5987
// 2. #return fails when running in the response template - https://github.com/localstack/localstack/issues/5988
// 3. Need a valid LocalStack Pro license

test("fix me", () => {
  expect(true).toBeTruthy();
});

// import * as appsync from "@aws-cdk/aws-appsync-alpha";
// import { gql, GraphQLClient } from "graphql-request";
// import { AppsyncResolver } from "../src";
// import { localstackTestSuite } from "./localstack";

// localstackTestSuite("appSyncStack", (testResource, stack) => {
//   const api = new appsync.GraphqlApi(stack, "graphql1", {
//     name: "Api",
//     authorizationConfig: {
//       defaultAuthorization: {
//         authorizationType: appsync.AuthorizationType.API_KEY,
//       },
//     },
//   });

//   testResource(
//     "app sync basic",
//     () => {
//       new AppsyncResolver(
//         api,
//         "resolver",
//         {
//           fieldName: "field",
//           typeName: "type",
//         },
//         () => {
//           return { value: "hi2" };
//         }
//       );
//       return {
//         outputs: {
//           apiUrl: api.graphqlUrl,
//           apiKey: api.apiKey!,
//         },
//       };
//     },
//     async (context) => {
//       console.log(context);
//       const graphQLClient = new GraphQLClient(context.apiUrl, {
//         headers: {
//           authorization: "Apikey " + context.apiKey,
//           "x-api-key": context.apiKey,
//         },
//       });
//       const query = gql`
//         {
//           hi5 {
//             value
//           }
//         }
//       `;
//       const results = await graphQLClient.request(query);

//       expect(results).toEqual({ hi5: { value: "hi" } });
//     }
//   );
// });
