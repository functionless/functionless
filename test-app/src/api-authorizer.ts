import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { App, aws_dynamodb, Stack } from "aws-cdk-lib";
import { AttributeType } from "aws-cdk-lib/aws-dynamodb";
import { $AWS, Table, Function, AppsyncResolver, ITable } from "functionless";
import { getAuth, IAccount } from "./api-utils";

export const app = new App();
export const stack = new Stack(app, "api-authorizer");

const table = new Table<IAccount, "Id">(stack, "table", {
  partitionKey: {
    name: "Id",
    type: AttributeType.STRING,
  },
});

(table.resource as aws_dynamodb.Table).addGlobalSecondaryIndex({
  indexName: "GSI1",
  partitionKey: {
    name: "pk",
    type: AttributeType.STRING,
  },
});

// https://aws.amazon.com/blogs/mobile/appsync-lambda-auth/
interface AuthorizerRequest {
  authorizationToken: string;
  requestContext: {
    apiId: string;
    accountId: string;
    requestId: string;
    queryString: string;
    operationName: string;
    variables: {};
  };
}

interface AuthorizerResponse {
  isAuthorized: boolean;
  resolverContext: Record<string, any>;
  deniedFields: string[];
  ttlOverride?: number;
}

const authorizer = new Function<AuthorizerRequest, AuthorizerResponse>(
  stack,
  "function",
  async (c) => {
    const apiKey = c.authorizationToken || "";
    if (!apiKey) return getAuth(undefined, apiKey);

    const res = $AWS.DynamoDB.Query({
      TableName: table as ITable<IAccount, "Id">,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: `API#${apiKey}` },
      },
      IndexName: "GSI1",
      Limit: 1,
    });

    const item = res.Items?.[0];
    if (item) {
      const account: IAccount = {
        Id: item.Id.S,
        pk: item.pk.S,
        entityType: item.entityType?.S,
      };

      return getAuth(account, apiKey);
    }

    return getAuth(undefined, apiKey);
  }
);

const api = new appsync.GraphqlApi(stack, "Api", {
  name: "AuthorizedApp",
  authorizationConfig: {
    defaultAuthorization: {
      authorizationType: appsync.AuthorizationType.LAMBDA,
      lambdaAuthorizerConfig: {
        handler: authorizer.resource,
      },
    },
  },
  xrayEnabled: true,
  logConfig: {
    fieldLogLevel: appsync.FieldLogLevel.ALL,
    excludeVerboseContent: false,
  },
});

const resolver = new AppsyncResolver(($context) => {
  if ($context.identity) {
    // @ts-ignore
    return $context.identity.resolverContext.toString();
  }
  return "huh?";
});

// getField should add the resolver, but it isn't.
resolver.addResolver(api, {
  fieldName: "something",
  typeName: "Query",
});

api.addQuery("something", resolver.getField(api, appsync.GraphqlType.string()));
