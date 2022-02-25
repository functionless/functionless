import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { AppSyncResolverEvent } from "aws-lambda";
import { Call, FunctionDecl } from "./expression";
import { AnyFunction } from "./function";
import { AnyLambda } from "./function";
import { VTLContext, synthVTL } from "./vtl";
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

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference.html
 */
export interface $util {
  readonly dynamodb: dynamodb;

  /**
   * Returns the input string as a JavaScript escaped string.
   */
  escapeJavaScript(js: string): string;

  /**
   * Returns the input string as an application/x-www-form-urlencoded encoded string.
   */
  urlEncode(string: string): string;

  /**
   * Decodes an application/x-www-form-urlencoded encoded string back to its non-encoded form.
   */
  urlDecode(string: string): string;

  /**
   * Encodes the input into a base64-encoded string.
   */
  base64Encode(data: Buffer): string;

  /**
   * Decodes the data from a base64-encoded string.
   */
  base64Decode(string: string): Buffer;

  /**
   * Takes "stringified" JSON and returns an object representation of the result.
   */
  parseJson(string: string): object;

  /**
   * Takes an object and returns a "stringified" JSON representation of that object.
   */
  toJson(obj: object): string;

  /**
   * Returns a 128-bit randomly generated UUID.
   */
  autoId(): string;

  /**
   * Returns a 128-bit randomly generated ULID (Universally Unique Lexicographically Sortable Identifier).
   */
  autoUlid(): string;

  /**
   * Throws Unauthorized for the field being resolved. Use this in request or response mapping templates to determine whether to allow the caller to resolve the field.
   */
  unauthorized(): never;

  /**
   * Throws a custom error. Use this in request or response mapping templates to detect an error with the request or with the invocation result.
   */
  error(errorMessage: string): never;

  /**
   * Throws a custom error. Use this in request or response mapping templates to detect an error with the request or with the invocation result. You can also specify an errorType.
   */
  error(errorMessage: string, errorType: string): never;

  /**
   * Throws a custom error. Use this in request or response mapping templates to detect an error with the request or with the invocation result. You can also specify an errorType and a data field. The data value will be added to the corresponding error block inside errors in the GraphQL response. Note: data will be filtered based on the query selection set.
   */
  error(errorMessage: string, errorType: string, errorData: object): never;

  /**
   * Throws a custom error. This can be used in request or response mapping templates if the template detects an error with the request or with the invocation result. Additionally, an errorType field, a data field, and a errorInfo field can be specified. The data value will be added to the corresponding error block inside errors in the GraphQL response. Note: data will be filtered based on the query selection set. The errorInfo value will be added to the corresponding error block inside errors in the GraphQL response. Note: errorInfo will NOT be filtered based on the query selection set.
   */
  error(
    errorMessage: string,
    errorType: string,
    errorData: object,
    errorInfo: object
  ): never;
  /**
   * Appends a custom error. This can be used in request or response mapping templates if the template detects an error with the request or with the invocation result. Unlike error(string: string), the template evaluation will not be interrupted, so that data can be returned to the caller./**
   */

  appendError(message: string): void;

  /**
   * Appends a custom error. This can be used in request or response mapping templates if the template detects an error with the request or with the invocation result. Additionally, an errorType can be specified. Unlike error(string, string), the template evaluation will not be interrupted, so that data can be returned to the caller./**
   */
  appendError(message: string, errorType: string): void;

  /**
   * Appends a custom error. This can be used in request or response mapping templates if the template detects an error with the request or with the invocation result. Additionally, an errorType and a data field can be specified. Unlike error(string, string, object), the template evaluation will not be interrupted, so that data can be returned to the caller. The data value will be added to the corresponding error block inside errors in the GraphQL response. Note: data will be filtered based on the query selection set./**
   */
  appendError(message: string, errorType: string, data: object): void;

  /**
   *
   */
  appendError(
    message: string,
    errorType: string,
    data: object,
    errorInfo: object
  ): void;

  /**
   * If the condition is false, throw a CustomTemplateException with the specified message.
   */
  validate(condition: boolean, message: string): never;

  /**
   * If the condition is false, throw a CustomTemplateException with the specified message and error type.
   */
  validate(condition: boolean, message: string, data: object): void;

  /**
   * If the condition is false, throw a CustomTemplateException with the specified message and error type, as well as data to return in the response.
   */
  validate(
    condition: boolean,
    message: string,
    data: object,
    info: object
  ): void;

  /**
   * Returns true if the supplied object is null.
   */
  isNull(obj: object): boolean;

  /**
   * Returns true if the supplied data is null or an empty string. Otherwise, returns false.
   */
  isNullOrEmpty(string: string): boolean;

  /**
   * Returns true if the supplied data is null or a blank string. Otherwise, returns false.
   */
  isNullOrBlank(string: string): boolean;

  /**
   * Returns the first object if it is not null. Otherwise, returns second object as a "default object".
   */
  defaultIfNull<T>(maybeVal: T | undefined | null, ifNull: T): T;

  /**
   * Returns the first string if it is not null or empty. Otherwise, returns second string as a "default string".
   */
  defaultIfNullOrEmpty<MaybeStr extends string, Default extends string>(
    maybeStr: MaybeStr | undefined,
    defaultVal: Default
  ): MaybeStr extends undefined | "" ? Default : MaybeStr;

  /**
   * Returns the first string if it is not null or blank. Otherwise, returns second string as a "default string".
   */
  defaultIfNullOrBlank<MaybeStr extends string, Default extends string>(
    maybeStr: MaybeStr | undefined,
    defaultVal: Default
  ): MaybeStr extends undefined | "" ? Default : MaybeStr;

  /**
   * Returns true if object is a string.
   */
  isstring(obj: any): obj is string;

  /**
   * Returns true if object is a Number.
   */
  isNumber(obj: any): obj is number;

  /**
   * Returns true if object is a Boolean.
   */
  isBoolean(obj: any): obj is boolean;

  /**
   * Returns true if object is a List.
   */
  isList(obj: any): obj is any[];

  /**
   * Returns true if object is a Map.
   */
  isMap(obj: any): obj is Record<string, any>;

  /**
   * Returns a string describing the type of the object. Supported type identifications are: "Null", "Number", "string", "Map", "List", "Boolean". If a type cannot be identified, the return type is "object".
   */
  typeOf(obj: object): string;
  /**
   * Returns true if the specified pattern in the first argument matches the supplied data in the second argument. The pattern must be a regular expression such as matches("a*b", "aaaaab"). The functionality is based on Pattern, which you can reference for further documentation./**
   */
  matches(pattern: string, data: string): boolean;
  /**
   * Returns a string describing the multi-auth type being used by a request, returning back either "IAM Authorization", "User Pool Authorization", "Open ID Connect Authorization", or "API Key Authorization".
   */
  authType(): string;
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
// export class AppsyncFunction<F extends AnyFunction, Source = undefined>(
//   fn: ($context: $Context<Source>, ...args: Parameters<F>) => ReturnType<F>
// ): TypeSafeAppsyncFunction<F> {
//   const expr = fn as unknown as FunctionDecl<F>;
//   return new TypeSafeAppsyncFunction(expr);
// }

export class AppsyncFunction<
  F extends AnyFunction = AnyFunction,
  Source = undefined
> {
  public readonly decl: FunctionDecl<F>;

  constructor(
    // @ts-ignore
    fn: ($context: $Context<Source>, ...args: Parameters<F>) => ReturnType<F>
  ) {
    this.decl = fn as unknown as FunctionDecl<F>;
  }

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
        // dataSource: new appsync.NoneDataSource(api, "None", {
        //   api,
        // }),
        requestMappingTemplate: appsync.MappingTemplate.fromString("{}"),
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
        requestMappingTemplate: appsync.MappingTemplate.fromString("{}"),
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
              statements.push(synthVTL(expr, context));
              const requestMappingTemplate = appsync.MappingTemplate.fromString(
                statements.join("\n")
              );
              statements = [];
              const name = `${toName(expr.expr)}_${stageIt++}`;
              return dataSource.createFunction({
                name,
                requestMappingTemplate,
                responseMappingTemplate,
              });
            }
          } else if (isLastExpr) {
            if (expr.kind === "Return") {
              statements.push(synthVTL(expr.expr, context));
            } else {
              // for a void function, return 'null'.
              statements.push(`#return`);
              throw new Error(
                `last expression must be 'Return', but was '${expr.kind}'`
              );
            }
          } else {
            // this expression should be appended to the current mapping template
            const stmt = synthVTL(expr, context);
            if (stmt.startsWith("#")) {
              statements.push(stmt);
            } else {
              statements.push(`qr(${stmt})`);
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
