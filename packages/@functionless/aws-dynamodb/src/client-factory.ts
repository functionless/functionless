import DynamoDB from "aws-sdk/clients/dynamodb";
import { DocumentClient } from "aws-sdk/lib/dynamodb/document_client";
import { createClientFactory } from "@functionless/aws-util";

export const documentClient = createClientFactory(DocumentClient);

export const dynamoClient = createClientFactory(DynamoDB);
