import type { CallExpr } from "@functionless/ast";
import type appsync from "@aws-cdk/aws-appsync-alpha";
import type { VTL } from "@functionless/vtl";

export interface AppSyncIntegration {
  kind: string;
  appSyncVtl: AppSyncVtlIntegration;
}

export function isAppSyncIntegration(a: any): a is AppSyncIntegration {
  return (
    a &&
    typeof a === "object" &&
    a.appSyncVtl &&
    isAppsyncVtlIntegration(a.appSyncVtl)
  );
}

export function isAppsyncVtlIntegration(a: any): a is AppSyncVtlIntegration {
  return a && typeof a === "object" && typeof a.dataSource === "function";
}

/**
 * Hooks used to create an app sync integration, implement using the {@link Integration} interface.
 *
 * 1. Get the AppSync data source
 * 2. Create the VTL request template to make data source call.
 * 3. Optionally post process the result of the data source call.
 */
export interface AppSyncVtlIntegration {
  /**
   * Retrieve the id of the date source to use for the integration.
   *
   * If the ID is unique to the current {@link appsync.GraphqlApi}, the `dataSource` will be called next with this id.
   */
  dataSourceId: () => string;
  /**
   * Retrieve a unique data source for the {@link appsync.GraphqlApi}.
   * Use the dataSourceId hook to return a unique id.
   * This method will only be called once per api or unique data source id.
   *
   * @param api - the api construct which should be the parent of the returned {@link appsync.BaseDataSource}
   * @param dataSourceId - the ID given by the dataSourceId hook, should be used as the construct id for the new data source.
   */
  dataSource: (
    api: appsync.GraphqlApi,
    dataSourceId: string
  ) => appsync.BaseDataSource;
  /**
   * Return a VTL template which builds a valid request to the integration's endpoint.
   * Should reflect the contents of the CallExpr.
   */
  request: (call: CallExpr, context: VTL) => string;
  /**
   * Optionally transform the result of the API and place into a unique variable.
   */
  result?: (resultVariable: string) => {
    returnVariable: string;
    template: string;
  };
}
