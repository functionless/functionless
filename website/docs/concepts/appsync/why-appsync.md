---
sidebar_position: 0
---

# Why AWS Appsync?

AWS Appsync is a managed service that simplifies the task of building and operating a GraphQL API in AWS. It takes care of authorization and scales servers to handle queries, web socket connections and the brokering of subscription messages. As a user, you focus on correctly configuring backend resolvers for the fields in the schema and rely on AWS to ensure the API's infrastructure remains healthy.

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
  ($context: AppsyncContext<{ key: string }>, key) => {
    const item = myTable.get({
      key: {
        S: key,
      },
    });

    const processedName = myFunc(item.key);

    return {
      ...item,
      processedName,
    };
  }
);
```

See the [Usage Documentation](./usage.md) to learn how to build GraphQL APIs with Functionless and Appsync.
