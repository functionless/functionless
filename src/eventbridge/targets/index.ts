import { aws_events } from "aws-cdk-lib";
import { assertString } from "../../assert";
import { FunctionDecl } from "../../declaration";
import {
  ArrayLiteralExpr,
  Expr,
  isArrayLiteralExpr,
  isBinaryExpr,
  isElementAccessExpr,
  isIdentifier,
  isObjectLiteralExpr,
  isPropAccessExpr,
  isPropAssignExpr,
  isTemplateExpr,
  ObjectLiteralExpr,
} from "../../expression";
import {
  assertValidEventRefererence,
  flattenReturnEvent,
  getConstant,
  getReferencePath,
  isStringType,
  ReferencePath,
} from "../utils";

/**
 * Generates a RuleTargetInput from a typescript function.
 *
 * Transforms an input event `event` to the return type `P`.
 *
 * TargetInputs interact with the input event using JSON Path.
 *
 * https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-transform-target-input.html
 */
export const synthesizeEventBridgeTargets = (
  decl: FunctionDecl
): aws_events.RuleTargetInput => {
  const [eventDecl = undefined] = decl.parameters;

  const expression = flattenReturnEvent(decl.body.statements);

  /**
   *
   * @param expr Handles returning all literals.
   */
  const resolveExprToLiteral = (
    expr: Expr
  ):
    | Record<string, any>
    | Exclude<ReturnType<typeof getConstant>, undefined>["constant"] => {
    if (isObjectLiteralExpr(expr) || isArrayLiteralExpr(expr)) {
      return exprToObject(expr);
    } else {
      return exprToLiteral(expr);
    }
  };

  const exprToLiteral = (
    expr: Expr
  ): Exclude<ReturnType<typeof getConstant>, undefined>["constant"] => {
    const constant = getConstant(expr);

    if (constant) {
      return constant.constant;
    } else if (isPropAccessExpr(expr) || isElementAccessExpr(expr)) {
      const ref = getReferencePath(expr);
      console.log(ref, expr);
      assertValidEventRefererence(ref, eventDecl?.name);
      const path = refToJsonPath(ref);

      if (!path) {
        throw Error(
          "Transform function may only use a reference to the event or a constant."
        );
      }

      return aws_events.EventField.fromPath(path);
    } else if (isBinaryExpr(expr)) {
      if (expr.op === "+") {
        if (isStringType(expr.left) || isStringType(expr.right)) {
          return `${exprToLiteral(expr.left)}${exprToLiteral(expr.right)}`;
        }
        throw Error(
          "Addition operator is only supported to concatinate at least one string to another value."
        );
      } else {
        throw Error(`Unsupported binary operator: ${expr.op}`);
      }
    } else if (isTemplateExpr(expr)) {
      return expr.exprs.map((x) => exprToLiteral(x)).join("");
    } else if (isObjectLiteralExpr(expr)) {
      const obj = exprToObject(expr);

      return JSON.stringify(obj);
    } else if (isIdentifier(expr)) {
      throw Error("Unsupported direct use of the event parameter.");
    }

    throw Error(`Unsupported template expression of kind: ${expr.kind}`);
  };

  const exprToObject = (
    expr: ObjectLiteralExpr | ArrayLiteralExpr
  ): Record<string, any> | any[] => {
    if (isObjectLiteralExpr(expr)) {
      return expr.properties.reduce((obj, expr) => {
        if (isPropAssignExpr(expr)) {
          const name = isIdentifier(expr.name)
            ? expr.name.name
            : assertString(getConstant(expr.name)?.constant, expr.name.kind);
          return {
            ...obj,
            [name]: resolveExprToLiteral(expr.expr),
          };
        } else {
          throw new Error(
            "Event Bridge input transforms do not support object spreading."
          );
        }
      }, {});
    } else {
      return expr.items.map((e) => resolveExprToLiteral(e));
    }
  };

  if (isPropAccessExpr(expression) || isElementAccessExpr(expression)) {
    const ref = getReferencePath(expression);
    assertValidEventRefererence(ref, eventDecl?.name);
    const path = refToJsonPath(ref);

    if (!path) {
      throw Error(
        "Transform function may only use a reference to the event or a constant."
      );
    }

    return aws_events.RuleTargetInput.fromEventPath(path);
  } else if (
    isObjectLiteralExpr(expression) ||
    isArrayLiteralExpr(expression)
  ) {
    return aws_events.RuleTargetInput.fromObject(exprToObject(expression));
  } else {
    // try to turn anything else into a string
    return aws_events.RuleTargetInput.fromObject(exprToLiteral(expression));
  }
};

const refToJsonPath = (ref: ReferencePath): string | undefined => {
  return formatJsonPath("$", ...ref.reference);
};

const formatJsonPath = (first: string, ...path: (string | number)[]): string =>
  path.reduce(
    (acc: string, seg) =>
      acc + (typeof seg === "string" ? `.${seg}` : `[${seg.toString()}]`),
    first
  );
