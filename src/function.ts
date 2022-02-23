import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { AppSyncResolverEvent } from "aws-lambda";
import { assertNever } from "./assert";
import { Environment } from "./environment";
import { Identifier } from "./expression";
import { AnyLambda } from "./lambda";
import { renderExpr } from "./render";
import { isExprStmt, isInvoke, isVariableDecl, Stmt } from "./statement";
import { AnyTable, isTable } from "./table";

export type AnyFunction = (...args: any[]) => any;

export interface ResolverOptions
  extends Pick<
    appsync.BaseResolverProps,
    "typeName" | "fieldName" | "cachingConfig"
  > {}

export interface $Context<Source>
  extends Omit<AppSyncResolverEvent<never, Source>, "arguments" | "stash"> {}

export function appsyncFunction<F extends AnyFunction, Source = undefined>(
  fn: ($context: $Context<Source>, ...args: Parameters<F>) => ReturnType<F>
): TypeSafeAppsyncFunction<F> {
  return new TypeSafeAppsyncFunction(
    ...Environment.closure(() =>
      fn(
        {
          info: new Identifier("$context.info") as any,
          prev: new Identifier("$context.prev") as any,
          request: new Identifier("$context.request") as any,
          source: new Identifier("$context.source") as any,
          identity: new Identifier("$context.identity") as any,
        },
        // TODO: inject this with compiler transform
        ...([] as any)
      )
    )
  );
}

export class TypeSafeAppsyncFunction<F extends AnyFunction = AnyFunction> {
  constructor(
    private readonly environment: Environment,
    private readonly result: ReturnType<F>
  ) {}

  public addResolver(
    api: appsync.GraphqlApi,
    options: ResolverOptions
  ): appsync.Resolver {
    if (this.environment.statements.length === 1) {
      const [dataSource, requestMappingTemplate] = renderStmt(
        this.environment.statements[0]
      );
      return api.createResolver({
        ...options,
        dataSource,
        requestMappingTemplate,
        responseMappingTemplate: appsync.MappingTemplate.fromString(
          renderExpr(this.result)
        ),
      });
    } else {
      const name = `${options.typeName}.${options.fieldName}`;

      const pipelineConfig = this.environment.statements.map((stmt, i) => {
        const [dataSource, requestMappingTemplate] = renderStmt(stmt);
        return dataSource.createFunction({
          name: `${name}-${i}`,
          requestMappingTemplate,
        });
      });

      return api.createResolver({
        ...options,
        pipelineConfig:
          pipelineConfig.length === 0 ? undefined : pipelineConfig,
        responseMappingTemplate: appsync.MappingTemplate.fromString(
          renderExpr(this.result)
        ),
      });
    }

    function renderStmt(stmt: Stmt) {
      if (isInvoke(stmt)) {
        const dataSource = getDataSource(api, stmt.target, () =>
          isTable(stmt.target)
            ? new appsync.DynamoDbDataSource(
                api,
                stmt.target.resource.node.addr,
                {
                  api,
                  table: stmt.target.resource,
                }
              )
            : new appsync.LambdaDataSource(
                api,
                stmt.target.resource.node.addr,
                {
                  api,
                  lambdaFunction: stmt.target.resource,
                }
              )
        );

        return [
          dataSource,
          appsync.MappingTemplate.fromString(renderExpr(stmt.payload)),
        ] as const;
      } else if (isVariableDecl(stmt)) {
        throw new Error("todo");
      } else if (isExprStmt(stmt)) {
        throw new Error("todo");
      }
      return assertNever(stmt);
    }
  }
}

const dataSourcesSymbol = Symbol.for("functionless.DataSources");

const dataSources: WeakMap<
  appsync.GraphqlApi,
  WeakMap<any, appsync.BaseDataSource>
> = ((global as any)[dataSourcesSymbol] ??= new WeakMap());

function getDataSources(api: appsync.GraphqlApi) {
  if (!dataSources.has(api)) {
    dataSources.set(api, new WeakMap());
  }
  return dataSources.get(api)!;
}

function getDataSource(
  api: appsync.GraphqlApi,
  target: AnyLambda | AnyTable,
  compute: () => appsync.BaseDataSource
): appsync.BaseDataSource {
  const ds = getDataSources(api);
  if (!ds.has(target)) {
    ds.set(target, compute());
  }
  return ds.get(target)!;
}
