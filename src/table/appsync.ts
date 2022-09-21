import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { AppSyncVtlIntegration } from "../appsync";
import { IntegrationInput, makeIntegration } from "../integration";
import { AnyFunction } from "../util";
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
