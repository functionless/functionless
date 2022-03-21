import { aws_events } from "aws-cdk-lib";
import { assertString } from "../../assert";
import { FunctionDecl } from "../../declaration";
import {
  ArrayLiteralExpr,
  ElementAccessExpr,
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
  PropAccessExpr,
  ReferenceExpr,
} from "../../expression";
import { isReturn } from "../../statement";
import { getConstant, getReferencePath, isStringType } from "../utils";

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

  const ret = decl.body.statements[decl.body.statements.length - 1];

  if (!ret || !isReturn(ret)) {
    throw Error("No return statement found in event bridge target function.");
  }

  if (isPropAccessExpr(ret.expr) || isElementAccessExpr(ret.expr)) {
    const ref = refToJsonPath(ret.expr, eventDecl?.name);

    if (!ref) {
      throw Error(
        "Transform function may only use a reference to the event or a constant."
      );
    }

    return aws_events.RuleTargetInput.fromEventPath(ref);
  } else if (isObjectLiteralExpr(ret.expr) || isArrayLiteralExpr(ret.expr)) {
    return aws_events.RuleTargetInput.fromObject(
      exprToObject(ret.expr, eventDecl?.name)
    );
  } else {
    // try to turn anything else into a string
    return aws_events.RuleTargetInput.fromObject(
      exprToLiteral(ret.expr, eventDecl?.name)
    );
  }
};

const refToJsonPath = (
  ref: ReferenceExpr | PropAccessExpr | ElementAccessExpr,
  /**
   * When undefined, this function will always return undefined.
   */
  eventName?: string
): string | undefined => {
  if (!eventName) {
    return undefined;
  }

  const eventReference = getReferencePath(ref, eventName);

  return eventReference
    ? formatJsonPath("$", ...eventReference)
    : eventReference;
};

/**
 *
 * @param expr Handles returning all literals.
 */
const resolveExprToLiteral = (
  expr: Expr,
  eventName?: string
):
  | Record<string, any>
  | Exclude<ReturnType<typeof getConstant>, undefined>["value"] => {
  if (isObjectLiteralExpr(expr) || isArrayLiteralExpr(expr)) {
    return exprToObject(expr, eventName);
  } else {
    return exprToLiteral(expr, eventName);
  }
};

const exprToLiteral = (
  expr: Expr,
  eventName?: string
): Exclude<ReturnType<typeof getConstant>, undefined>["value"] => {
  const constant = getConstant(expr);

  if (constant) {
    return constant.value;
  } else if (isPropAccessExpr(expr) || isElementAccessExpr(expr)) {
    const ref = refToJsonPath(expr, eventName);

    if (!ref) {
      throw Error(
        "Transform function may only use a reference to the event or a constant."
      );
    }

    return aws_events.EventField.fromPath(ref);
  } else if (isBinaryExpr(expr)) {
    if (expr.op === "+") {
      if (isStringType(expr.left) || isStringType(expr.right)) {
        return `${exprToLiteral(expr.left, eventName)}${exprToLiteral(
          expr.right,
          eventName
        )}`;
      }
      throw Error(
        "Addition operator is only supported to concatinate at least one string to another value."
      );
    } else {
      throw Error(`Unsupported binary operator: ${expr.op}`);
    }
  } else if (isTemplateExpr(expr)) {
    return expr.exprs.map((x) => exprToLiteral(x, eventName)).join("");
  } else if (isObjectLiteralExpr(expr)) {
    const obj = exprToObject(expr, eventName);

    return JSON.stringify(obj);
  }

  throw Error(`Unsupported template expression of kind: ${expr.kind}`);
};

const exprToObject = (
  expr: ObjectLiteralExpr | ArrayLiteralExpr,
  eventName?: string
): Record<string, any> | any[] => {
  if (isObjectLiteralExpr(expr)) {
    return expr.properties.reduce((obj, expr) => {
      if (isPropAssignExpr(expr)) {
        const name = isIdentifier(expr.name)
          ? expr.name.name
          : assertString(getConstant(expr.name)?.value, expr.name.kind);
        return {
          ...obj,
          [name]: resolveExprToLiteral(expr.expr, eventName),
        };
      } else {
        throw new Error(
          "Event Bridge input transforms do not support object spreading."
        );
      }
    }, {});
  } else {
    return expr.items.map((e) => resolveExprToLiteral(e, eventName));
  }
};

const formatJsonPath = (...path: string[]): string => path.join(".");
