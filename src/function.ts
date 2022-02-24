import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { AppSyncResolverEvent } from "aws-lambda";
import { Call, Expr, FunctionDecl } from "./expression";
import { AnyLambda, isLambda } from "./lambda";
import { AnyTable, isTable } from "./table";

export type AnyFunction = (...args: any[]) => any;

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
              statements.push(synthesizeExpr(expr));
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
              statements.push(synthesizeExpr(expr.expr));
            } else {
              // for a void function, return 'null'.
              statements.push(`#return`);
              throw new Error(
                `last expression must be 'Return', but was '${expr.kind}'`
              );
            }
          } else {
            // this expression should be appended to the current mapping template
            statements.push(synthesizeExpr(expr));
          }

          return undefined;
        })
        .filter(
          (func): func is Exclude<typeof func, undefined> => func !== undefined
        );

      return [functions, statements.join("\n")] as const;
    }

    // derives an AppSyncFunction's name from an expression
    // e.g. table.getItem(..) => "table_getItem"
    function toName(expr: Expr): string {
      if (expr.kind === "Identifier") {
        return expr.id;
      } else if (expr.kind === "PropRef") {
        return `${toName(expr.expr)}_${expr.id}`;
      } else {
        throw new Error(`invalid expression: '${expr.kind}'`);
      }
    }

    function synthesizeExpr(expr: Expr, depth = 0): string {
      if (expr.kind === "VariableDecl") {
        return `#set( $context.stash.${expr.name} = ${synthesizeExpr(
          expr.expr,
          depth
        )} )`;
      } else if (expr.kind === "Binary") {
        return `${synthesizeExpr(expr.left, depth)} ${expr.op} ${synthesizeExpr(
          expr.right,
          depth
        )}`;
      } else if (expr.kind === "Unary") {
        return `${expr.op}${synthesizeExpr(expr.expr, depth)}`;
      } else if (expr.kind === "Block") {
        return expr.exprs
          .map((expr) => synthesizeExpr(expr, depth + 1))
          .join(indent(depth + 1));
      } else if (expr.kind === "Call") {
        // ?
      } else if (expr.kind === "FunctionDecl") {
        // ?
      } else if (expr.kind === "Identifier") {
        // determine is a stash or local variable
      } else if (expr.kind === "PropRef") {
        return `${synthesizeExpr(expr.expr)}.${expr.id}`;
      } else if (expr.kind === "If") {
        return (
          (expr.parent.kind === "If"
            ? // nested else-if, don't prepend #
              ""
            : // this is the first expr in the if-chain
              "#") +
          `if( ${synthesizeExpr(expr.when)} )` +
          synthesizeExpr(expr.then, depth + 1) +
          (expr._else?.kind === "If"
            ? `#else${synthesizeExpr(expr._else, depth + 1)}`
            : expr._else
            ? `#else ${synthesizeExpr(expr._else, depth + 1)} #end`
            : "#end")
        );
      } else if (expr.kind === "Map") {
        // ?
      } else if (expr.kind === "ObjectLiteral") {
        return `{${expr.properties
          .map((prop) => synthesizeExpr(prop, depth + 1))
          .join(`,${indent(depth + 1)}`)}}`;
      } else if (expr.kind === "PropertyAssignment") {
        return `"${expr.name}": ${synthesizeExpr(expr.expr)}`;
      } else if (expr.kind === "SpreadAssignment") {
        const mustStash =
          expr.expr.kind === "Identifier" || expr.expr.kind === "PropRef";
        const varName = mustStash
          ? synthesizeExpr(expr.expr)
          : generateUniqueName();
        return `${
          mustStash ? "" : `#set( $${varName} = ${synthesizeExpr(expr.expr)} )`
        }
#foreach( $key in $${varName}.keySet() )
  "$key": $util.toJson($${varName}.get($key))#if( $foreach.hasNext ),#end
#end`;
      } else if (expr.kind === "Reference") {
        // inject the ARN as a string into the template
        return `"${
          isLambda(expr.name)
            ? expr.name.resource.functionArn
            : expr.name.resource.tableArn
        }"`;
      } else if (expr.kind === "Return") {
        return `#return(${synthesizeExpr(expr.expr)})`;
      }

      throw new Error(`cannot synthesize '${expr.kind}' expression to VTL`);
    }

    function indent(depth: number) {
      return "\n" + Array.from(new Array(depth)).join(" ");
    }

    function countResolvers(decl: FunctionDecl<F>): number {
      return decl.body.exprs.filter((expr) => findService(expr) !== undefined)
        .length;
    }

    function findService(expr: Expr): AnyTable | AnyLambda | undefined {
      if (expr.kind === "Reference") {
        return expr.name;
      } else if (expr.kind === "Call") {
        return findService(expr.expr);
      } else if (expr.kind === "VariableDecl") {
        return findService(expr.expr);
      }
      return undefined;
    }

    throw new Error("not implemented");
    // if (this.environment.statements.length === 1) {
    //   const [dataSource, requestMappingTemplate] = renderStmt(
    //     this.environment.statements[0]
    //   );
    // return api.createResolver({
    //   ...options,
    //   dataSource,
    //   requestMappingTemplate,
    //   responseMappingTemplate: appsync.MappingTemplate.fromString(
    //     renderExpr(this.result)
    //   ),
    // });
    // } else {
    //   const name = `${options.typeName}.${options.fieldName}`;

    //   const pipelineConfig = this.environment.statements.map((stmt, i) => {
    //     const [dataSource, requestMappingTemplate] = renderStmt(stmt);
    //     return dataSource.createFunction({
    //       name: `${name}-${i}`,
    //       requestMappingTemplate,
    //     });
    //   });

    //   return api.createResolver({
    //     ...options,
    //     pipelineConfig:
    //       pipelineConfig.length === 0 ? undefined : pipelineConfig,
    //     responseMappingTemplate: appsync.MappingTemplate.fromString(
    //       renderExpr(this.result)
    //     ),
    //   });
    // }

    // function renderStmt(stmt: Stmt) {
    //   if (isInvoke(stmt)) {

    //     return [
    //       dataSource,
    //       appsync.MappingTemplate.fromString(renderExpr(stmt.payload)),
    //     ] as const;
    //   } else if (isVariableDecl(stmt)) {
    //     throw new Error("todo");
    //   } else if (isStmt(stmt)) {
    //     throw new Error("todo");
    //   }
    //   return assertNever(stmt);
    // }
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
