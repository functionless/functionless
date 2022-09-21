import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { JsonFormat } from "typesafe-dynamodb";
import { AttributeValue } from "typesafe-dynamodb/lib/attribute-value";
import {
  ExpressionAttributeNames,
  ExpressionAttributeValues,
} from "typesafe-dynamodb/lib/expression-attributes";
import { AppSyncVtlIntegration } from "../appsync";
import { IntegrationInput, makeIntegration } from "../integration";
import { AnyFunction } from "../util";
import { VTL } from "../vtl";
import { Table } from "./table";

export function makeAppSyncTableIntegration<F extends AnyFunction>(
  table: Table<any, any, any>,
  methodName: string,
  integration: Omit<IntegrationInput<string, F>, "kind" | "appSyncVtl"> & {
    appSyncVtl: Omit<AppSyncVtlIntegration, "dataSource" | "dataSourceId">;
  }
): F {
  return makeIntegration<`Table.AppSync.${string}`, F>({
    ...integration,
    kind: `Table.AppSync.${methodName}`,
    appSyncVtl: {
      dataSourceId: () => table.resource.node.addr,
      dataSource: (api, dataSourceId) => {
        return new appsync.DynamoDbDataSource(api, dataSourceId, {
          api,
          table: table.resource,
        });
      },
      ...integration.appSyncVtl,
    },
  });
}

export function addIfDefined(vtl: VTL, from: string, to: string, key: string) {
  vtl.add(
    `#if(${from}.containsKey('${key}'))`,
    `$util.qr(${to}.put('${key}', ${from}.get('${key}')))`,
    "#end"
  );
}

export interface DynamoDBAppsyncExpression {
  expression?: string;
  expressionNames?: {
    [name: string]: string;
  };
  expressionValues?: {
    /**
     * :val
     */
    [value: string]: AttributeValue;
  };
}

export type DynamoExpression<Expression extends string | undefined> =
  {} & RenameKeys<
    ExpressionAttributeNames<Expression> &
      ExpressionAttributeValues<Expression, JsonFormat.AttributeValue> & {
        expression?: Expression;
      },
    {
      ExpressionAttributeValues: "expressionValues";
      ExpressionAttributeNames: "expressionNames";
    }
  >;

type RenameKeys<
  T extends object,
  Substitutions extends Record<string, string>
> = {
  [k in keyof T as k extends keyof Substitutions ? Substitutions[k] : k]: T[k];
};
