import DynamoDB from "aws-sdk/clients/dynamodb";
import { DocumentClient } from "aws-sdk/lib/dynamodb/document_client";
import { createClientFactory } from "@functionless/aws-util";
import type { NativeRuntimeInitializer } from "@functionless/aws-lambda";

export const documentClient = createClientFactory(DocumentClient);

export const dynamoClient = createClientFactory(DynamoDB);

export const DocumentDBClient: NativeRuntimeInitializer<
  "DynamoDB",
  DocumentClient
> = {
  key: "DynamoDB",
  init: (key, props) =>
    new (require("aws-sdk/clients/dynamodb").DocumentClient)(
      props?.clientConfigRetriever?.(key)
    ),
};

export const DynamoDBClient: NativeRuntimeInitializer<
  "DynamoDBDocument",
  DynamoDB
> = {
  key: "DynamoDBDocument",
  init: (key, props) =>
    new (require("aws-sdk/clients/dynamodb"))(
      props?.clientConfigRetriever?.(key)
    ),
};
