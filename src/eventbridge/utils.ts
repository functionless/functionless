import { assertNumber, assertString } from "../assert";
import {
  ElementAccessExpr,
  Expr,
  isBooleanLiteral,
  isElementAccessExpr,
  isIdentifier,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isPropAccessExpr,
  isStringLiteralExpr,
  isTemplateExpr,
  isUnaryExpr,
  PropAccessExpr,
} from "../expression";

/**
 * Returns a string array representing the property access starting from a named identity.
 *
 * Does not return the itentity name given.
 *
 * (event) => {
 *   event.prop1.prop2
 * }
 *
 * Given the propertyAccesssExpr for "prop2", this function will return ["prop1", "prop2"];
 *
 * TODO support references
 */
export const getReferencePath = (
  expression: Expr,
  identityName?: string
): string[] | undefined => {
  if (isIdentifier(expression)) {
    if (expression.name === identityName) {
      return [];
    }
    // TODO: support references
    throw Error(
      `Identifiers must point to the identity parameter, found: ${expression.name}`
    );
  } else if (isPropAccessExpr(expression) || isElementAccessExpr(expression)) {
    const key = getPropertyAccessKey(expression);
    const parent = getReferencePath(expression.expr, identityName);
    if (parent) {
      return [...parent, key];
    }
    return undefined;
  }
  return undefined;
};

/**
 * Normalize retrieving the name of a property between a element access and property access expression.
 */
export const getPropertyAccessKey = (
  expr: PropAccessExpr | ElementAccessExpr
): string => {
  return isPropAccessExpr(expr)
    ? expr.name
    : assertString(getConstant(expr.element)?.value);
};

/**
 * Retrieves a string, number, boolean, undefined, or null constant from the given expression.
 * Wrap the value to not be ambiguous with the undefined value.
 * When one is not found, return undefined (not wrapped).
 *
 * TODO: Support following references.
 */
export const getConstant = (
  expr: Expr
): { value: string | number | boolean | undefined | null } | undefined => {
  if (
    isStringLiteralExpr(expr) ||
    isNumberLiteralExpr(expr) ||
    isBooleanLiteral(expr)
  ) {
    return { value: expr.value };
  } else if (isNullLiteralExpr(expr)) {
    return { value: expr.undefined ? undefined : null };
  } else if (isUnaryExpr(expr) && expr.op === "-") {
    const number = assertNumber(getConstant(expr.expr)?.value);
    return { value: -number };
  }
  return undefined;
};

export const isStringType = (expr: Expr) => {
  return (
    ((isPropAccessExpr(expr) || isElementAccessExpr(expr)) &&
      expr.type === "string") ||
    isStringLiteralExpr(expr) ||
    isTemplateExpr(expr)
  );
};
