import {
  CallExpr,
  Expr,
  Identifier,
  isArgument,
  isArrayLiteralExpr,
  isAwaitExpr,
  isBooleanLiteralExpr,
  isCallExpr,
  isElementAccessExpr,
  isFunctionLike,
  isIdentifier,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectLiteralExpr,
  isParameterDecl,
  isParenthesizedExpr,
  isPropAccessExpr,
  isPropAssignExpr,
  isReferenceExpr,
  isReturnStmt,
  isSpreadAssignExpr,
  isStringLiteralExpr,
  isThisExpr,
  isUndefinedLiteralExpr,
  isVariableDecl,
  ReferenceExpr,
  Stmt,
  ThisExpr,
  tryFindReference,
  UndefinedLiteralExpr,
} from "@functionless/ast";
import * as apigw from "@functionless/aws-apigateway";
import { VTL } from "@functionless/vtl";
import type { aws_iam } from "aws-cdk-lib";
import { ErrorCodes, SynthError } from "@functionless/error-code";

/**
 * API Gateway's VTL interpreter. API Gateway has limited VTL support and differing behavior to Appsync,
 * so this class overrides its behavior while sharing as much as it can.
 */
export class APIGatewayVTL
  extends VTL<apigw.ApiGatewayIntegration>
  implements apigw.APIGatewayVTL
{
  public integration: apigw.ApiGatewayIntegration | undefined;
  constructor(
    readonly role: aws_iam.IRole,
    readonly location: "request" | "response",
    ...statements: string[]
  ) {
    super(...statements);
  }

  protected isIntegration(a: any): a is apigw.ApiGatewayIntegration {
    return apigw.isApiGatewayIntegration(a);
  }

  /**
   * Called during VTL synthesis. This function will capture the API Gateway request's integration
   * and return a string that will emit the request payload into the VTL template.
   *
   * @param target the integration
   * @param call the {@link CallExpr} representing the integration instance.
   * @returns
   */
  protected integrate(
    target: apigw.ApiGatewayIntegration,
    call: CallExpr
  ): string {
    if (this.location === "response") {
      throw new SynthError(
        ErrorCodes.API_gateway_response_mapping_template_cannot_call_integration
      );
    }
    const response = target.apiGWVtl.renderRequest(call, this);
    // ew, mutation
    // TODO: refactor to pure functions
    this.integration = target;
    return response;
  }

  public eval(node?: Expr, returnVar?: string): string;
  public eval(node: Stmt, returnVar?: string): void;
  public eval(node?: Expr | Stmt, returnVar?: string): string | void {
    if (isReturnStmt(node)) {
      return this.add(
        this.exprToJson(
          node.expr ?? node.fork(new UndefinedLiteralExpr(node.span))
        )
      );
    } else if (
      isPropAccessExpr(node) &&
      isIdentifier(node.name) &&
      node.name.name === "data"
    ) {
      if (isInputBody(node.expr)) {
        // $input.data maps to `$input.path('$')`
        // this returns a VTL object representing the root payload data
        return `$input.path('$')`;
      }
    }
    return super.eval(node as any, returnVar);
  }

  public stringify(expr: Expr): string {
    const json = this.exprToJson(expr);
    // already a string
    if (json.startsWith('"')) {
      return json;
    }
    return `"${json
      .replace(/"/g, '\\"')
      .replace(
        /\$input\.json\('([^']*)'\)/g,
        "$util.escapeJavaScript($input.json('$1'))"
      )}"`;
  }

  public exprToJson(expr: Expr): string {
    const context = this;
    const jsonPath = toJsonPath(expr);
    if (jsonPath) {
      return `$input.json('${jsonPath}')`;
    } else if (isParenthesizedExpr(expr)) {
      return this.exprToJson(expr.expr);
    } else if (isNullLiteralExpr(expr) || isUndefinedLiteralExpr(expr)) {
      // Undefined is not the same as null. In JSON terms, `undefined` is the absence of a value where-as `null` is a present null value.
      return "null";
    } else if (isBooleanLiteralExpr(expr)) {
      return expr.value ? "true" : "false";
    } else if (isNumberLiteralExpr(expr)) {
      return expr.value.toString(10);
    } else if (isStringLiteralExpr(expr)) {
      return `"${expr.value}"`;
    } else if (isArrayLiteralExpr(expr)) {
      if (expr.items.length === 0) {
        return "[]";
      } else {
        return `[${expr.items.map((item) => this.exprToJson(item)).join(`,`)}]`;
      }
    } else if (isArgument(expr)) {
      if (expr.expr) {
        return this.exprToJson(expr.expr);
      }
    } else if (isCallExpr(expr)) {
      const integration = tryFindReference(
        expr.expr,
        apigw.isApiGatewayIntegration
      );
      if (integration) {
        return this.integrate(integration, expr);
      } else if (isReferenceExpr(expr.expr) || isThisExpr(expr.expr)) {
        const ref = expr.expr.ref?.();
        if (ref === Number) {
          // Number() = 0
          return expr.args[0] ? this.exprToJson(expr.args[0]) : "0";
        } else {
          throw new SynthError(
            ErrorCodes.Unexpected_Error,
            "Called references are expected to be an integration."
          );
        }
      } else if (
        isPropAccessExpr(expr.expr) &&
        isIdentifier(expr.expr.name) &&
        expr.expr.name.name === "params"
      ) {
        if (isIdentifier(expr.expr.expr)) {
          const ref = expr.expr.expr.lookup();
          if (
            isParameterDecl(ref) &&
            isFunctionLike(ref.parent) &&
            ref.parent.parent === undefined &&
            ref.parent.parameters.findIndex((param) => param === ref) === 0
          ) {
            // the first argument of the FunctionDecl is the `$input`, regardless of what it is named
            if (expr.args[0]?.expr === undefined) {
              const key = this.newLocalVarName();
              return `{#foreach(${key} in $input.params().keySet())"${key}": "$input.params("${key}")"#if($foreach.hasNext),#end#end}`;
            } else {
              const argName = expr.args[0].expr;
              if (isStringLiteralExpr(argName)) {
                if (
                  isArgument(expr.parent) &&
                  ((isIdentifier(expr.parent.parent.expr) &&
                    expr.parent.parent.expr.name === "Number") ||
                    (isReferenceExpr(expr.parent.parent.expr) &&
                      expr.parent.parent.expr.ref() === Number))
                ) {
                  // this parameter is surrounded by a cast to Number, so omit the quotes
                  return `$input.params('${argName.value}')`;
                }
                return `"$input.params('${argName.value}')"`;
              }
            }
          }
        }
      }
    } else if (isElementAccessExpr(expr)) {
      const jsonPath = toJsonPath(expr);
      if (jsonPath) {
        return `$input.json('${jsonPath}')`;
      } else {
        toJsonPath(expr);
      }
    } else if (isObjectLiteralExpr(expr)) {
      if (expr.properties.length === 0) {
        return "{}";
      }
      return `{${expr.properties
        .map((prop) => {
          if (isPropAssignExpr(prop)) {
            if (isIdentifier(prop.name) || isStringLiteralExpr(prop.name)) {
              return `"${
                isIdentifier(prop.name) ? prop.name.name : prop.name.value
              }":${this.exprToJson(prop.expr)}`;
            }
          } else if (isSpreadAssignExpr(prop)) {
            const key = context.newLocalVarName();
            const map = this.eval(prop.expr);
            return `#foreach(${key} in ${map}.keySet())"${key}":${this.json(
              `${map}.get(${key})`
            )}#if($foreach.hasNext),#end#end`;
          }
          return "#stop";
        })
        .join(`,`)}}`;
    } else if (isAwaitExpr(expr)) {
      // just pass these through
      return this.exprToJson(expr.expr);
    } else {
      // this Expr is a computation that cannot be expressed as JSON Path
      // we must therefore evaluate it and use a brute force approach to convert it into JSON
      // TODO: this will always throw an error because API Gateway does not have $util.toJson
      return this.json(this.eval(expr));
    }

    throw new Error(`unsupported expression ${expr.kindName}`);

    /**
     * Translates an {@link Expr} into JSON Path if this expression references values
     * on the root `$input.body` object.
     *
     * @param expr the {@link Expr} to convert to JSON.
     * @returns a JSON Path `string` if this {@link Expr} can be evaluated as a JSON Path from the `$input`, otherwise `undefined`.
     */
    function toJsonPath(expr: Expr): string | undefined {
      if (isParenthesizedExpr(expr)) {
        return toJsonPath(expr.expr);
      } else if (isInputBody(expr)) {
        return "$";
      } else if (isIdentifier(expr)) {
        // this is a reference to an intermediate value, cannot be expressed as JSON Path
        return undefined;
      } else if (isPropAccessExpr(expr)) {
        if (
          isIdentifier(expr.name) &&
          expr.name.name === "data" &&
          isInputBody(expr.expr)
        ) {
          return "$";
        }
        const exprJsonPath = toJsonPath(expr.expr);
        if (exprJsonPath !== undefined) {
          return `${exprJsonPath}.${expr.name.name}`;
        }
      } else if (
        isElementAccessExpr(expr) &&
        isNumberLiteralExpr(expr.element)
      ) {
        const exprJsonPath = toJsonPath(expr.expr);
        if (exprJsonPath !== undefined) {
          return `${exprJsonPath}[${expr.element.value}]`;
        }
      }
      return undefined;
    }
  }

  /**
   * Renders VTL that will emit a JSON expression for a variable reference within VTL.
   *
   * API Gateway does not have a `$util.toJson` helper function, so we render a series of
   * #if statements that check the class of the value and render the JSON value appropriately.
   *
   * We only support primitive types such as `null`, `boolean`, `number` and `string`. This is
   * because it is not possible to implement recursive functions in VTL and API Gateway has a
   * constraint of maximum 1000 foreach iterations and a maximum limit in VTL size.
   *
   * We could implement a brute-force heuristic that handles n-depth lists and objects, but this
   * seems particularly fragile with catastrophic consequences for API implementors. So instead,
   * we encourage developers to use `$input.json(<path>)` wherever possible as we can support
   * any depth transformations this way.
   *
   * @param reference the name of the VTL variable to emit as JSON.
   * @returns VTL that emits the JSON expression.
   */
  public json(reference: string): string {
    return `#if(${reference} == $null)
null
#elseif(${reference}.class.name === 'java.lang.String') 
\"$util.escapeJavaScript(${reference})\"
#elseif(${reference}.class.name === 'java.lang.Integer' || ${reference}.class.name === 'java.lang.Double' || ${reference}.class.name === 'java.lang.Boolean') 
${reference} 
#else
#set($context.responseOverride.status = 500)
"Internal Server Error - can only primitives to JSON"
#stop
#end`;
  }

  /**
   * Dereferences an {@link Identifier} to a VTL string that points to the value at runtime.
   *
   * @param id the {@link Identifier} expression.
   * @returns a VTL string that points to the value at runtime.
   */
  public override dereference(
    id: Identifier | ReferenceExpr | ThisExpr
  ): string {
    if (isReferenceExpr(id) || isThisExpr(id)) {
      throw new SynthError(ErrorCodes.ApiGateway_Unsupported_Reference);
    } else {
      const ref = id.lookup();
      if (isVariableDecl(ref)) {
        return `$${id.name}`;
      } else if (
        isParameterDecl(ref) &&
        isFunctionLike(ref.parent) &&
        // check this is the top-level function
        ref.parent.parent === undefined
      ) {
        const paramIndex = ref.parent.parameters.indexOf(ref);
        if (paramIndex === 0) {
          return `$input.path('$')`;
        } else if (paramIndex === 1) {
          return "$context";
        } else {
          throw new Error(`unknown argument`);
        }
      }
      if (id.name.startsWith("$")) {
        return id.name;
      } else {
        return `$${id.name}`;
      }
    }
  }
}

// checks if this is a reference to the `$input` argument
function isInputBody(expr: Expr): expr is Identifier {
  if (isIdentifier(expr)) {
    const ref = expr.lookup();
    return (
      isParameterDecl(ref) &&
      isFunctionLike(ref.parent) &&
      ref.parent.parent === undefined
    );
  }
  return false;
}
