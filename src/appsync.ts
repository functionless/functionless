import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { AppSyncResolverEvent } from "aws-lambda";
import { Call, FunctionDecl } from "./expression";
import { AnyFunction } from "./function";
import { AnyLambda } from "./function";
import { VTLContext, toVTL } from "./vtl";
import { AnyTable, isTable } from "./table";
import {
  ToAttributeMap,
  ToAttributeValue,
} from "typesafe-dynamodb/lib/attribute-value";
import { findService, toName } from "./util";

export interface dynamodb {
  toDynamoDBJson<T>(value: T): ToAttributeValue<T>;
  toMapValuesJson<T extends object>(value: T): ToAttributeMap<T>;
}

export interface $util {
  readonly dynamodb: dynamodb;
}

export declare const $util: $util;

export interface ResolverOptions
  extends Pick<
    appsync.BaseResolverProps,
    "typeName" | "fieldName" | "cachingConfig"
  > {}

export interface $Context<Source>
  extends Omit<AppSyncResolverEvent<never, Source>, "arguments" | "stash"> {}

/**
 * Creates an AppSync Resolver chain.
 *
 * @param fn implementation of the appsync resolver chain.
 */
export function appsyncFunction<F extends AnyFunction, Source = undefined>(
  fn: ($context: $Context<Source>, ...args: Parameters<F>) => ReturnType<F>
): TypeSafeAppsyncFunction<F> {
  const expr = fn as unknown as FunctionDecl<F>;
  return new TypeSafeAppsyncFunction(expr);
}

export class TypeSafeAppsyncFunction<F extends AnyFunction = AnyFunction> {
  constructor(
    // @ts-ignore
    private readonly decl: FunctionDecl<F>
  ) {}

  public addResolver(
    api: appsync.GraphqlApi,
    options: ResolverOptions
  ): appsync.Resolver {
    let stageIt = 0;
    let nameIt = 0;
    const generateUniqueName = () => {
      return `var${nameIt++}`;
    };

    const context: VTLContext = {
      generateUniqueName,
      depth: 0,
    };

    const resolverCount = countResolvers(this.decl);

    if (resolverCount === 0) {
      // mock integration
      const [pipelineConfig, responseMappingTemplate] = synthesizeFunctions(
        this.decl
      );

      if (pipelineConfig.length !== 0) {
        throw new Error(
          `expected 0 functions in pipelineConfig, but found ${pipelineConfig.length}`
        );
      }

      return api.createResolver({
        ...options,
        responseMappingTemplate: appsync.MappingTemplate.fromString(
          responseMappingTemplate
        ),
      });

      // } else if (resolverCount === 1) {
      // single stage
    } else {
      // pipeline resolver
      const [pipelineConfig, responseMappingTemplate] = synthesizeFunctions(
        this.decl
      );

      return api.createResolver({
        ...options,
        pipelineConfig,
        responseMappingTemplate: appsync.MappingTemplate.fromString(
          responseMappingTemplate
        ),
      });
    }

    function synthesizeFunctions(decl: FunctionDecl<F>) {
      let statements: string[] = [];
      const functions = decl.body.exprs
        .map((expr, i) => {
          const isLastExpr = i + 1 === decl.body.exprs.length;
          const service = findService(expr);
          if (service) {
            // we must now render a resolver with request mapping template
            const dataSource = getDataSource(api, service, () =>
              isTable(service)
                ? new appsync.DynamoDbDataSource(
                    api,
                    service.resource.node.addr,
                    {
                      api,
                      table: service.resource,
                    }
                  )
                : new appsync.LambdaDataSource(
                    api,
                    service.resource.node.addr,
                    {
                      api,
                      lambdaFunction: service.resource,
                    }
                  )
            );

            if (expr.kind === "Call") {
              return createStage(expr);
            } else if (expr.kind === "Return" && expr.expr.kind === "Call") {
              return createStage(expr.expr);
            } else if (
              expr.kind === "VariableDecl" &&
              expr.expr.kind === "Call"
            ) {
              const responseMappingTemplate =
                appsync.MappingTemplate.fromString(
                  `#set( $context.stash.${expr.name} = $context.result )`
                );

              return createStage(expr.expr, responseMappingTemplate);
            } else {
              throw new Error(
                `only a 'VariableDecl', 'Call' or 'Return' expression may call a service`
              );
            }

            function createStage(
              expr: Call,
              responseMappingTemplate?: appsync.MappingTemplate
            ) {
              statements.push(toVTL(expr, context));
              const requestMappingTemplate = appsync.MappingTemplate.fromString(
                statements.join("\n")
              );
              statements = [];
              return dataSource.createFunction({
                name: `${toName(expr.expr)}_${stageIt++}`,
                requestMappingTemplate,
                responseMappingTemplate,
              });
            }
          } else if (isLastExpr) {
            if (expr.kind === "Return") {
              statements.push(toVTL(expr.expr, context));
            } else {
              // for a void function, return 'null'.
              statements.push(`#return`);
              throw new Error(
                `last expression must be 'Return', but was '${expr.kind}'`
              );
            }
          } else {
            // this expression should be appended to the current mapping template
            const stmt = toVTL(expr, context);
            if (stmt.startsWith("#")) {
              statements.push(stmt);
            } else {
              statements.push(`$util.qr(${stmt})`);
            }
          }

          return undefined;
        })
        .filter(
          (func): func is Exclude<typeof func, undefined> => func !== undefined
        );

      return [functions, statements.join("\n")] as const;
    }

    function countResolvers(decl: FunctionDecl<F>): number {
      return decl.body.exprs.filter((expr) => findService(expr) !== undefined)
        .length;
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

// @ts-ignore
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
