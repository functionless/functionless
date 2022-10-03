# GraphQL API

Functionless enables the development of GraphQL APIs with a thin framework over the top of [AWS Appsync](https://aws.amazon.com/appsync). Visit the [usage documentation](./usage) to jump right into building GraphQL APIs with Functionless and Appsync.

## What is AWS Appsync?

[AWS Appsync](https://aws.amazon.com/appsync) is a managed service that simplifies the task of building and operating a GraphQL API in AWS. It takes care of authorization and scales servers to handle queries, mutations and the brokering of messages to subscription. As a user, you focus on correctly configuring backend resolvers for the fields in the schema and rely on AWS to ensure the API's infrastructure remains healthy.

## How does it work?

An instance of an Appsync GraphQL API is configured with a GraphQL Schema and backend Resolvers for resolving the queries of the Schema's Fields.

## What is a Resolver?

A Resolver is a series of [Apache Velocity Templates (VTL)](#what-are-apache-velocity-templates-vtl) and integrations that decide how to respond to a GraphQL query, for example getting user data from a DynamoDB Table.

## What are Apache Velocity Templates (VTL)?

An Apache Velocity Template (VTL) is an open source template language used by Appsync to map request and response payloads.

- **Request** payloads are mapped to API requests, for example mapping an inbound GraphQL query to DynamoDB's `GetItemRequest` payload.
- **Response** payloads are mapped with VTL back to the schema required by the GrapHQL schema, e.g. DynamoDB's `GetItemResponse` payload,

## Why is VTL useful?

VTL is a niche/fringe language that is not commonly understood. It is used by AWS Appsync as a light-weight compute layer for performing data manipulation on Appsync's servers. It is useful over something like AWS Lambda because this processing comes at no extra cost and can often allow for totally "functionless" integrations where an API request is satisfied without ever touching functions/containers/servers maintained by the user.

## `AppsyncResolver`

Functionless enables you to automatically generate the Resolver configurations (VTL and Integrations) from ordinary TypeScript code.

```ts
const getItem = new AppsyncResolver(
  async ($context: AppsyncContext<{ key: string }>, key) => {
    const item = await myTable.appsync.get({
      key: {
        S: key,
      },
    });

    const processedName = await myFunc(item.key);

    return {
      ...item,
      processedName,
    };
  }
);
```

See the [Usage Documentation](./usage.md) to learn how to build GraphQL APIs with Functionless and Appsync.
