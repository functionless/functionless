import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { aws_appsync, Lazy } from "aws-cdk-lib";
import type { AppSyncResolverEvent } from "aws-lambda";
import { Construct } from "constructs";
import {
  ToAttributeMap,
  ToAttributeValue,
} from "typesafe-dynamodb/lib/attribute-value";
import {
  FunctionDecl,
  validateFunctionDecl,
  VariableDecl,
  VariableDeclList,
} from "./declaration";
import { ErrorCodes, SynthError } from "./error-code";
import {
  Argument,
  BinaryExpr,
  CallExpr,
  ConditionExpr,
  Expr,
  Identifier,
  PropAccessExpr,
  ReferenceExpr,
  StringLiteralExpr,
  ThisExpr,
} from "./expression";
import {
  isVariableStmt,
  isParameterDecl,
  isFunctionDecl,
  isBinaryExpr,
  isExprStmt,
  isReturnStmt,
  isCallExpr,
  isPropAccessExpr,
  isElementAccessExpr,
  isIfStmt,
  isBlockStmt,
  isStmt,
  isForInStmt,
  isForOfStmt,
  isAwaitExpr,
  isPromiseExpr,
  isBindingElem,
  isBindingPattern,
  isReferenceExpr,
  isThisExpr,
  isVariableDecl,
  isIdentifier,
} from "./guards";
import {
  findDeepIntegrations,
  getIntegrationExprFromIntegrationCallPattern,
  Integration,
  IntegrationCallPattern,
  IntegrationImpl,
  isIntegration,
  isIntegrationCallPattern,
} from "./integration";
import { Literal } from "./literal";
import { FunctionlessNode } from "./node";
import { BlockStmt, VariableStmt } from "./statement";
import {
  AnyFunction,
  DeterministicNameGenerator,
  isInTopLevelScope,
  memoize,
  singletonConstruct,
} from "./util";
import { visitBlock, visitEachChild, visitSpecificChildren } from "./visit";
import { VTL } from "./vtl";

/**
 * The shape of the AWS Appsync `$context` variable.
 *
 * Both the `arguments` and `stash` fields are purposely omitted since they are used internally
 * by the TypeScript->VTL conversion logic.
 *
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-context-reference.html
 */
export interface AppsyncContext<
  Arguments extends ResolverArguments,
  Source = undefined
> extends Omit<AppSyncResolverEvent<never, Source>, "arguments" | "stash"> {
  arguments: Arguments;
}

/**
 * The shape of an AWS Appsync Resolver's `$context.arguments`.
 *
 * The values must be of type {@link Literal} and cannot be arbitrary JavaScript types since
 * they must be receivable in a GraphQL request.
 */
export interface ResolverArguments {
  [key: string]: Literal;
}

/**
 * A {@link ResolverFunction} is a function that represents an AWS Appsync Resolver Pipeline.
 *
 * @tparam Arguments - an object describing the shape of `$context.arguments`.
 * @tparam Result - the type of data returned by the Resolver.
 * @tparam Source - the parent type of the Appsync Resolver.
 */
export type ResolverFunction<
  Arguments extends ResolverArguments,
  Result,
  Source
> = ($context: AppsyncContext<Arguments, Source>) => Promise<Result> | Result;

export interface SynthesizedAppsyncResolverProps extends appsync.ResolverProps {
  readonly templates: string[];
}

/**
 * An {@link appsync.Resolver} synthesized by a {@link AppsyncResolver}.
 */
export class SynthesizedAppsyncResolver extends appsync.Resolver {
  /**
   * All of the Request and Response Mapping templates in the order they are executed by the AppSync service.
   */
  readonly templates: string[];

  constructor(
    scope: Construct,
    id: string,
    props: SynthesizedAppsyncResolverProps
  ) {
    super(scope, id, props);
    this.templates = props.templates;
  }
}

export class AppsyncVTL extends VTL {
  public static readonly CircuitBreaker = `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end`;

  protected integrate(
    target: IntegrationImpl<AnyFunction>,
    call: CallExpr
  ): string {
    if (target.appSyncVtl) {
      return target.appSyncVtl.request(call, this);
    } else {
      throw new Error(
        `Integration ${target.kind} does not support Appsync Resolvers`
      );
    }
  }

  protected dereference(id: Identifier | ReferenceExpr | ThisExpr): string {
    if (isReferenceExpr(id) || isThisExpr(id)) {
      const ref = id.ref();
      if (ref === $util) {
        return "$util";
      }
      throw new SynthError(ErrorCodes.AppSync_Unsupported_Reference);
    } else {
      const ref = id.lookup();
      if (
        (isVariableDecl(ref) || isBindingElem(ref)) &&
        isInTopLevelScope(ref)
      ) {
        return `$context.stash.${id.name}`;
      } else if (isParameterDecl(ref) && isFunctionDecl(ref.parent)) {
        // regardless of the name of the first argument in the root FunctionDecl, it is always the intrinsic Appsync `$context`.
        return "$context";
      }
      if (id.name.startsWith("$")) {
        return id.name;
      } else {
        return `$${id.name}`;
      }
    }
  }
}

export interface AppsyncResolverProps<>extends Pick<
    appsync.BaseResolverProps,
    "typeName" | "fieldName" | "cachingConfig"
  > {
  readonly api: appsync.GraphqlApi;
}

/**
 * An AWS AppSync Resolver Function derived from TypeScript syntax.
 *
 * ```ts
 * const getPerson = new AppsyncResolver<{id: string}, Person | undefined>(
 *   scope, id, {
 *      api,
 *      typeName: "Query",
 *      fieldName: "getPerson"
 *   },
 *   async ($context, id) => {
 *     const person = await table.appsync.get({
 *       key: {
 *         id: $util.toDynamoDB(id)
 *       }
 *     });
 *     return person;
 *   });
 * ```
 *
 * @functionless AppsyncFunction
 */
export class AppsyncResolver<
  Arguments extends ResolverArguments,
  Result,
  Source = undefined
> {
  /**
   * This static property identifies this class as an AppsyncResolver to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "AppsyncResolver";

  /**
   * The AST form of this resolver.
   */
  public readonly decl: FunctionDecl<
    ResolverFunction<Arguments, Result, Source>
  >;

  /**
   * The underlying {@link aws_appsync.CfnResolver}.
   */
  public readonly resource;

  /**
   * A memoized function that computes the Appsync Resolvers.
   *
   * This function will be called from within a {@link Lazy} during CDK synthesis. It should not be
   * called directly except during tests.
   */
  public readonly resolvers;

  /**
   * Create a new AppsyncResolver and use the {@link scope} as the GraphQL API.
   *
   * If {@link props}.api exists, then it will be use as the API instead.
   */
  constructor(
    scope: appsync.GraphqlApi,
    id: string,
    props: Omit<AppsyncResolverProps, "api">,
    resolve: ResolverFunction<Arguments, Result, Source>
  );

  /**
   * Create a new AppsyncResolver and use {@link props}.api as the GraphQL API.
   */
  constructor(
    scope: Construct,
    id: string,
    props: AppsyncResolverProps,
    resolve: ResolverFunction<Arguments, Result, Source>
  );

  constructor(
    scope: Construct,
    id: string,
    props:
      | AppsyncResolverProps
      | (Omit<AppsyncResolverProps, "api"> & {
          api?: appsync.GraphqlApi;
        }),
    resolve: ResolverFunction<Arguments, Result, Source>
  ) {
    this.decl = validateFunctionDecl(resolve, "AppsyncResolver");

    const api = props.api ?? (scope as unknown as appsync.GraphqlApi);

    this.resolvers = memoize(() => synthResolvers(api, this.decl));

    this.resource = new aws_appsync.CfnResolver(scope, id, {
      apiId: api.apiId,
      typeName: props.typeName,
      fieldName: props.fieldName,
      kind: Lazy.string({
        produce: () => {
          const { pipelineConfig } = this.resolvers();
          return pipelineConfig === undefined || pipelineConfig.length === 0
            ? "UNIT"
            : "PIPELINE";
        },
      }),
      requestMappingTemplate: Lazy.string({
        produce: () => this.resolvers().requestMappingTemplate.renderTemplate(),
      }),
      pipelineConfig: Lazy.any({
        produce: () => {
          const { pipelineConfig } = this.resolvers();
          if (pipelineConfig === undefined || pipelineConfig.length === 0) {
            return undefined;
          } else {
            return {
              functions: pipelineConfig.map((func) => func.functionId),
            };
          }
        },
      }),
      responseMappingTemplate: Lazy.string({
        produce: () =>
          this.resolvers().responseMappingTemplate.renderTemplate(),
      }),
    });
  }
}

/**
 * Properties for a new {@link AppsyncField}.
 */
export interface AppsyncFieldOptions
  extends Omit<
    appsync.ResolvableFieldOptions,
    keyof ReturnType<typeof synthResolvers>
  > {
  /**
   * The API this {@link AppsyncField} should be added to.
   */
  readonly api: appsync.GraphqlApi;
}

/**
 * Generate a resolvable field to use with AppSync CDK's Code field strategy.
 *
 * ```ts
 * import * as appsync from "@aws-cdk/aws-appsync-alpha";
 *
 * const api = new appsync.GraphQLApi(..);
 *
 * ```ts
 * const getPersonField = new AppsyncField<{id: string}, Person | undefined>(
 *   {
 *     api,
 *     returnType: appsync.Field.string(),
 *     args: {
 *       argName: appsync.Field.string()
 *     }
 *   },
 *   async ($context, id) => {
 *     const person = await table.appsync.get({
 *       key: {
 *         id: $util.toDynamoDB(id)
 *       }
 *     });
 *     return person;
 *   });
 * ```
 *
 * // code first person type
 * const personType = api.addType(appsync.ObjectType(...));
 *
 * api.addQuery("getPerson", getPersonField)
 * ```
 *
 * @param api app sync API which the data sources construct will be added under.
 * @param returnType the code-first graphql return type of this field
 * @param options optional fields like arguments and directive to add to the schema
 */
export class AppsyncField<
  Arguments extends ResolverArguments,
  Result,
  Source = undefined
> extends appsync.ResolvableField {
  /**
   * This static property identifies this class as an AppsyncResolver to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "AppsyncField";

  constructor(
    options: AppsyncFieldOptions,
    resolve: ResolverFunction<Arguments, Result, Source>
  ) {
    const fields = synthResolvers(
      options.api,
      validateFunctionDecl(resolve, "AppsyncField")
    );
    super({
      ...options,
      dataSource: fields.dataSource,
      pipelineConfig: fields.pipelineConfig,
      requestMappingTemplate: fields.requestMappingTemplate,
      responseMappingTemplate: fields.responseMappingTemplate,
    });
  }
}

function synthResolvers(api: appsync.GraphqlApi, decl: FunctionDecl) {
  const [pipelineConfig, responseMappingTemplate, innerTemplates] =
    synthesizeFunctions(api, decl);

  // mock integration
  if (pipelineConfig.length === 0) {
    const requestMappingTemplate = `{
"version": "2018-05-29",
"payload": null
}`;

    return {
      templates: [
        requestMappingTemplate,
        ...innerTemplates,
        responseMappingTemplate,
      ],
      dataSource: singletonConstruct(api, "None", (scope, id) =>
        scope.addNoneDataSource(id)
      ),
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestMappingTemplate
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseMappingTemplate
      ),
    };
  } else {
    // pipeline resolver
    const requestMappingTemplate = "{}";

    return {
      templates: [
        requestMappingTemplate,
        ...innerTemplates,
        responseMappingTemplate,
      ],
      pipelineConfig,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestMappingTemplate
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseMappingTemplate
      ),
    };
  }
}

function synthesizeFunctions(api: appsync.GraphqlApi, decl: FunctionDecl) {
  const generatedNames = new DeterministicNameGenerator();
  let resolverCount = 0;
  /**
   * Update some nodes.
   */
  const updatedDecl = visitEachChild(
    decl,
    function normalizeAST(
      node,
      hoist?: (expr: Expr) => Expr
    ): FunctionlessNode | FunctionlessNode[] {
      // just counting, don'r do anything
      if (isBlockStmt(node)) {
        return new BlockStmt([
          // for each block statement
          ...visitBlock(
            node,
            function normalizeBlock(stmt, hoist) {
              return visitEachChild(stmt, (expr) => normalizeAST(expr, hoist));
            },
            generatedNames
          ).statements,
        ]);
      } else if (isIntegrationCallPattern(node)) {
        resolverCount++;
        // we find the range of nodes to hoist so that we avoid visiting the middle nodes.
        // The start node is the first node in the integration pattern (integ, await, or promise)
        // The end is always the integration.
        const end = getIntegrationExprFromIntegrationCallPattern(node);

        const updatedChild = visitSpecificChildren(node, [end], (expr) =>
          normalizeAST(expr, hoist)
        );
        // when we find an integration call,
        // if it is nested, hoist it up (create variable, add above, replace expr with variable)
        return hoist && doHoist(node) ? hoist(updatedChild) : updatedChild;
      } else if (isVariableStmt(node) && node.declList.decls.length > 1) {
        /**
         * Flatten variable declarations into multiple variable statements.
         */
        return node.declList.decls.map(
          (decl) => new VariableStmt(new VariableDeclList([decl]))
        );
      } else if (isBinaryExpr(node)) {
        /**
         * rewrite `in` to a conditional statement to support both arrays and maps
         * var v = left in right;
         *
         * var v = right.class.name.startsWith("[L") || right.class.name.contains("ArrayList") ?
         *    right.length >= left :
         *    right.containsKey(left);
         */
        if (node.op === "in") {
          const updatedNode = visitEachChild(node, (expr) =>
            normalizeAST(expr, hoist)
          );

          const rightClassName = new PropAccessExpr(
            new PropAccessExpr(updatedNode.right, new Identifier("class")),
            new Identifier("name")
          );

          return new ConditionExpr(
            new BinaryExpr(
              new CallExpr(
                new PropAccessExpr(
                  rightClassName,
                  new Identifier("startsWith")
                ),
                [new Argument(new StringLiteralExpr("[L"))]
              ),
              "||",
              new CallExpr(
                new PropAccessExpr(rightClassName, new Identifier("contains")),
                [new Argument(new StringLiteralExpr("ArrayList"))]
              )
            ),
            new BinaryExpr(
              new PropAccessExpr(updatedNode.right, new Identifier("length")),
              ">=",
              updatedNode.left
            ),
            new CallExpr(
              new PropAccessExpr(
                updatedNode.right,
                new Identifier("containsKey")
              ),
              [new Argument(updatedNode.left)]
            )
          );
        }
      }
      return visitEachChild(node, (expr) => normalizeAST(expr, hoist));
    }
  );

  const templates: string[] = [];
  let template =
    resolverCount === 0
      ? new AppsyncVTL()
      : new AppsyncVTL(AppsyncVTL.CircuitBreaker);

  if (
    updatedDecl.parameters.length > 0 &&
    isBindingPattern(updatedDecl.parameters[0].name)
  ) {
    template.evaluateBindingPattern(
      updatedDecl.parameters[0].name,
      "$context",
      "$context.stash."
    );
  }

  const functions = updatedDecl.body.statements
    .map((stmt, i) => {
      const isLastExpr = i + 1 === updatedDecl.body.statements.length;
      const integrations = findDeepIntegrations(stmt);
      if (integrations.length > 1) {
        throw new SynthError(
          ErrorCodes.Unexpected_Error,
          "Expected a single integration call in a statement."
        );
      } else if (integrations.length === 1) {
        const integrationCall = integrations[0];
        const ref = integrationCall.expr.ref();
        if (!isIntegration<Integration>(ref)) {
          throw new SynthError(
            ErrorCodes.Unexpected_Error,
            "Expected called reference to be an integration"
          );
        }
        const service = new IntegrationImpl(ref);
        // we must now render a resolver with request mapping template
        const dataSource = singletonConstruct(
          api,
          service.appSyncVtl.dataSourceId(),
          (scope, id) => service.appSyncVtl.dataSource(scope, id)
        );

        const resultValName = "$context.result";

        // The integration can optionally transform the result into a new variable.
        const resultTemplate = service.appSyncVtl.result?.(resultValName);
        const pre = resultTemplate?.template;
        const returnValName = resultTemplate?.returnVariable ?? resultValName;

        if (isExprStmt(stmt)) {
          template.call(integrationCall);
          return createStage(service, "{}");
        } else if (isReturnStmt(stmt)) {
          return createStage(
            service,
            `${pre ? `${pre}\n` : ""}#set( $context.stash.return__flag = true )
#set( $context.stash.return__val = ${getResult(stmt.expr)} )
{}`
          );
        } else if (
          isVariableStmt(stmt) &&
          stmt.declList.decls[0].initializer &&
          isIntegrationCallPattern(stmt.declList.decls[0].initializer)
        ) {
          const decl: VariableDecl | undefined = stmt.declList.decls[0];
          const varName = isIdentifier(decl?.name) ? decl.name.name : undefined;
          if (varName === undefined) {
            throw new SynthError(
              ErrorCodes.Unsupported_Feature,
              "Destructured parameter declarations are not yet supported by Appsync. https://github.com/functionless/functionless/issues/364"
            );
          }
          return createStage(
            service,
            `${
              pre ? `${pre}\n` : ""
            }#set( $context.stash.${varName} = ${getResult(
              <IntegrationCallPattern>decl.initializer
            )} )\n{}`
          );
        } else {
          throw new SynthError(
            ErrorCodes.Appsync_Integration_invocations_must_be_unidirectional_and_defined_statically
          );
        }

        /**
         * Resolve a VTL expression that applies in-line expressions such as PropAccessExpr to
         * the result from `$context.result` in a Response Mapping template.
         *
         * Example:
         * ```ts
         * const items = table.query().items
         * ```
         *
         * The Response Mapping Template will include:
         * ```
         * #set($context.stash.items = $context.result.items)
         * ```
         *
         * @param expr the {@link Expr} which is triggering a call to an external service, such as a Table or Function.
         * @returns a VTL expression to be included in the Response Mapping Template to extract the contents from `$context.result`.
         */
        function getResult(expr: Expr): string {
          if (isCallExpr(expr)) {
            template.call(expr);
            return returnValName;
          } else if (isPropAccessExpr(expr)) {
            return `${getResult(expr.expr)}.${expr.name.name}`;
          } else if (isElementAccessExpr(expr)) {
            return `${getResult(expr.expr)}[${getResult(expr.element)}]`;
          } else if (isPromiseExpr(expr)) {
            return getResult(expr.expr);
          } else if (isAwaitExpr(expr)) {
            return getResult(expr.expr);
          } else {
            throw new Error(
              `invalid Expression in-lined with Service Call: ${expr.kind}`
            );
          }
        }

        function createStage(
          integration: IntegrationImpl,
          responseMappingTemplate: string
        ) {
          const requestMappingTemplateString = template.toVTL();
          templates.push(requestMappingTemplateString);
          templates.push(responseMappingTemplate);
          template = new AppsyncVTL(AppsyncVTL.CircuitBreaker);
          const name = getUniqueName(api, appsyncSafeName(integration.kind));
          return dataSource.createFunction({
            name,
            requestMappingTemplate: appsync.MappingTemplate.fromString(
              requestMappingTemplateString
            ),
            responseMappingTemplate: appsync.MappingTemplate.fromString(
              responseMappingTemplate
            ),
          });
        }
      } else if (isLastExpr) {
        if (isReturnStmt(stmt)) {
          template.return(stmt.expr);
        } else if (isIfStmt(stmt)) {
          template.eval(stmt);
        } else {
          template.return("$null");
        }
      } else {
        // this expression should be appended to the current mapping template
        template.eval(stmt);
      }
      return undefined;
    })
    .filter(
      (func): func is Exclude<typeof func, undefined> => func !== undefined
    );

  return [functions, template.toVTL(), templates] as const;
}

/**
 * Determines of an expression should be hoisted
 * Hoisted - Add new variable to the current block above the
 */
function doHoist(node: FunctionlessNode): boolean {
  const parent = node.parent;
  return (
    // const v = task()
    (!isStmt(parent) ||
      // for(const i in task())
      isForInStmt(parent) ||
      isForOfStmt(parent)) &&
    // v = task()
    !(isBinaryExpr(parent) && parent.op === "=") &&
    !isVariableDecl(parent)
  );
}

/**
 * A reference to the AWS Appsync `$util` variable globally available to all Resolvers.
 *
 * Use the functions on `$util` to perform computations within an {@link AppsyncResolver}. They
 * will be translated directly to calls within the Velocity Template Engine.
 *
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference.html
 */
export declare const $util: $util;

/**
 * $util.dynamodb contains helper methods that make it easier to write and read data to Amazon DynamoDB, such as automatic type mapping and formatting. These methods are designed to make mapping primitive types and Lists to the proper DynamoDB input format automatically, which is a Map of the format { "TYPE" : VALUE }.
 *
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference.html#dynamodb-helpers-in-util-dynamodb
 */
export interface dynamodb {
  /**
   * General object conversion tool for DynamoDB that converts input objects to the appropriate DynamoDB representation. It's opinionated about how it represents some types: e.g., it will use lists ("L") rather than sets ("SS", "NS", "BS"). This returns an object that describes the DynamoDB attribute value.
   *
   * @param value a JSON value to convert {@link ToAttributeValue}.
   * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
   */
  toDynamoDB<T>(value: T): ToAttributeValue<T>;
  /**
   * Creates a copy of the map where each value has been converted to its appropriate DynamoDB format. It's opinionated about how it represents some of the nested objects: e.g., it will use lists ("L") rather than sets ("SS", "NS", "BS").
   * @param value an object to convert {@link ToAttributeMap}
   */
  toMapValues<T extends object>(value: T): ToAttributeMap<T>;
}

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference.html
 */
export interface $util {
  /**
   * $util.dynamodb contains helper methods that make it easier to write and read data to Amazon DynamoDB, such as automatic type mapping and formatting. These methods are designed to make mapping primitive types and Lists to the proper DynamoDB input format automatically, which is a Map of the format { "TYPE" : VALUE }.
   *
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference.html#dynamodb-helpers-in-util-dynamodb
   */
  readonly dynamodb: dynamodb;

  /**
   * The $util.time variable contains datetime methods to help generate timestamps, convert between datetime formats, and parse datetime strings. The syntax for datetime formats is based on DateTimeFormatter which you can reference for further documentation. Below we provide some examples, as well as a list of available methods and descriptions.
   *
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/time-helpers-in-util-time.html
   */
  readonly time: time;

  /**
   * The $util.log variable contains log methods to help log info and error messages.
   *
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/utility-helpers-in-util.html
   */
  readonly log: log;

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
  isString(obj: any): obj is string;

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

export interface log {
  /**
   * Logs the string representation of the provided object to the requested log stream when request-level and field-level CloudWatch logging is enabled with log level ALL on an API.
   */
  info(obj: any): void;
  /**
   * Logs the string representation of the provided objects to the requested log stream when request-level and field-level CloudWatch logging is enabled with log level ALL on an API. This utility will replace all variables indicated by "{}" in the first input format string with the string representation of the provided objects in order.
   */
  info(message: string, ...rest: any[]): void;
  /**
   * Logs the string representation of the provided object to the requested log stream when field-level CloudWatch logging is enabled with log level ERROR or log level ALL on an API.
   */
  error(obj: any): void;
  /**
   * Logs the string representation of the provided objects to the requested log stream when field-level CloudWatch logging is enabled with log level ERROR or log level ALL on an API. This utility will replace all variables indicated by "{}" in the first input format string with the string representation of the provided objects in order.
   */
  error(message: string, ...rest: any[]): void;
}

export interface time {
  /**
   * Returns a String representation of UTC in ISO8601 format.
   */
  nowISO8601(): string;

  /**
   * Returns the number of seconds from the epoch of 1970-01-01T00:00:00Z to now.
   */
  nowEpochSeconds(): number;

  /**
   * Returns the number of milliseconds from the epoch of 1970-01-01T00:00:00Z to now.
   */
  nowEpochMilliSeconds(): number;

  /**
   * Returns a string of the current timestamp in UTC using the specified format from a String input type.
   */
  nowFormatted(format: string): string;

  /**
   * Returns a string of the current timestamp for a timezone using the specified format and timezone from String input types.
   */
  nowFormatted(format: string, timezone: string): string;

  /**
   * Parses a timestamp passed as a String, along with a format, and return the timestamp as milliseconds since epoch.
   */
  parseFormattedToEpochMilliSeconds(timestamp: string, format: string): number;

  /**
   * Parses a timestamp passed as a String, along with a format and time zone, and return the timestamp as milliseconds since epoch.
   */
  parseFormattedToEpochMilliSeconds(
    timestamp: string,
    format: string,
    timezone: string
  ): number;

  /**
   * Parses an ISO8601 timestamp, passed as a String, and return the timestamp as milliseconds since epoch.
   */
  parseISO8601ToEpochMilliSeconds(timestamp: string): number;

  /**
   * Converts an epoch milliseconds timestamp to an epoch seconds timestamp.
   */
  epochMilliSecondsToSeconds(epoch: number): number;

  /**
   * Converts a epoch milliseconds timestamp to an ISO8601 timestamp.
   */
  epochMilliSecondsToISO8601(epoch: number): string;

  /**
   * Converts a epoch milliseconds timestamp, passed as long, to a timestamp formatted according to the supplied format in UTC.
   */
  epochMilliSecondsToFormatted(epoch: number, format: string): string;

  /**
   * Converts a epoch milliseconds timestamp, passed as a long, to a timestamp formatted according to the supplied format in the supplied timezone.
   */
  epochMilliSecondsToFormatted(
    epoch: number,
    format: string,
    timezone: string
  ): string;
}

// [_A-Za-z][_0-9A-Za-z]*
function appsyncSafeName(name: string) {
  return name.replace(/\./g, "_");
}

const uniqueNamesSymbol = Symbol.for("functionless.UniqueNames");

const names: WeakMap<
  appsync.GraphqlApi,
  {
    [name: string]: number;
  }
> = ((global as any)[uniqueNamesSymbol] ??= new WeakMap());

function getUniqueName(api: appsync.GraphqlApi, name: string): string {
  let uniqueNames = names.get(api);
  if (uniqueNames === undefined) {
    uniqueNames = {};
    names.set(api, uniqueNames);
  }
  const counter = uniqueNames[name];
  if (counter === undefined) {
    uniqueNames[name] = 0;
    return name;
  } else {
    uniqueNames[name] += 1;
    return `${name}_${counter}`;
  }
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

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
