import { assertNumber } from "../assert";
import {
  ArrayLiteralExpr,
  BinaryExpr,
  ElementAccessExpr,
  Expr,
  isArrayLiteralExpr,
  isBinaryExpr,
  isBooleanLiteral,
  isElementAccessExpr,
  isIdentifier,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectLiteralExpr,
  isPropAccessExpr,
  isPropAssignExpr,
  isSpreadElementExpr,
  isStringLiteralExpr,
  isTemplateExpr,
  isUnaryExpr,
  NumberLiteralExpr,
  ObjectLiteralExpr,
  PropAccessExpr,
  PropAssignExpr,
  StringLiteralExpr,
  TemplateExpr,
  UnaryExpr,
} from "../expression";
import { isReturn, isVariableStmt, Stmt, VariableStmt } from "../statement";

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
  expression: Expr
): ReferencePath | undefined => {
  if (isIdentifier(expression)) {
    return { reference: [], identity: expression.name };
  } else if (isPropAccessExpr(expression) || isElementAccessExpr(expression)) {
    const key = getPropertyAccessKey(expression);
    const parent = getReferencePath(expression.expr);
    if (parent) {
      return {
        identity: parent.identity,
        reference: [...parent.reference, key],
      };
    }
    return undefined;
  }
  return undefined;
};

export const getPropertyAccessKeyFlatten = (
  expr: PropAccessExpr | ElementAccessExpr,
  scope: EventScope
): string | number => {
  if (isElementAccessExpr(expr)) {
    return getPropertyAccessKey(
      new ElementAccessExpr(
        expr.expr,
        flattenExpression(expr.element, scope),
        expr.type
      )
    );
  }
  return getPropertyAccessKey(expr);
};

/**
 * Normalize retrieving the name of a property between a element access and property access expression.
 */
export const getPropertyAccessKey = (
  expr: PropAccessExpr | ElementAccessExpr
): string | number => {
  const key = isPropAccessExpr(expr)
    ? expr.name
    : getConstant(expr.element)?.constant;

  if (!(typeof key === "string" || typeof key === "number")) {
    throw new Error(
      `Property key much be a number or a string, found ${typeof key}`
    );
  }

  return key;
};

/**
 * Retrieves a string, number, boolean, undefined, or null constant from the given expression.
 * Wrap the value to not be ambiguous with the undefined value.
 * When one is not found, return undefined (not wrapped).
 */
export const getConstant = (expr: Expr): Constant | undefined => {
  if (
    isStringLiteralExpr(expr) ||
    isNumberLiteralExpr(expr) ||
    isBooleanLiteral(expr)
  ) {
    return { constant: expr.value };
  } else if (isNullLiteralExpr(expr)) {
    return { constant: expr.undefined ? undefined : null };
  } else if (isUnaryExpr(expr) && expr.op === "-") {
    const number = assertNumber(getConstant(expr.expr)?.constant);
    return { constant: -number };
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

export interface Constant {
  constant: string | number | boolean | undefined | null;
}

export const isConstant = (x: any): x is Constant => {
  return "constant" in x;
};

export interface ReferencePath {
  identity: string;
  reference: (string | number)[];
}

export const isReferencePath = (x: any): x is ReferencePath => {
  return "reference" in x;
};

export interface EventScope {
  [key: string]: Expr | undefined;
}

/**
 * Attempts to remove references by flattening constant references and replaces local variables with properties.
 * Updates expressions in place to avoid new AST types.
 *
 * const val = "sam"
 * return val + " is cool"
 *
 * Becomes return "sam" + "is cool"
 *
 * const obj = { val: "hi" }
 * return obj.val + " there"
 *
 * Becomes return "hi" + " there"
 *
 * Also does some optimization like turning templated strings of all constants into a string constant.
 */
export const flattenExpression = (expr: Expr, scope: EventScope): Expr => {
  if (isUnaryExpr(expr)) {
    return new UnaryExpr(expr.op, flattenExpression(expr.expr, scope));
  } else if (isIdentifier(expr)) {
    // if this variable is in scope, return the expression it points to.
    if (expr.name in scope) {
      const ref = scope[expr.name];
      if (!ref) {
        throw Error(`Reference ${expr.name} is not yet instantiated.`);
      }
      return ref;
    }
    return expr;
  } else if (isPropAccessExpr(expr) || isElementAccessExpr(expr)) {
    const key = getPropertyAccessKeyFlatten(expr, scope);
    const parent = flattenExpression(expr.expr, scope);
    if (isObjectLiteralExpr(parent)) {
      if (typeof key === "string") {
        const val = parent.getProperty(key)?.expr;
        if (!val) {
          throw Error(
            `Cannot find property ${key} in Object with keys: ${parent.properties
              .filter(isPropAssignExpr)
              .map((e) => e.name)
              .filter(isIdentifier)
              .map((e) => e.name)
              .join()}`
          );
        }
        return val;
      }
      throw Error(`Object access must be a string.`);
    } else if (isArrayLiteralExpr(parent)) {
      if (typeof key === "number") {
        return parent.items[key];
      }
      throw new Error("Array access must be a number.");
    }
    return typeof key === "string"
      ? new PropAccessExpr(parent, key, expr.type)
      : new ElementAccessExpr(parent, new NumberLiteralExpr(key), expr.type);
  } else if (isArrayLiteralExpr(expr)) {
    return new ArrayLiteralExpr(
      expr.items.reduce((items, x) => {
        if (isSpreadElementExpr(x)) {
          const ref = flattenExpression(x.expr, scope);
          if (isArrayLiteralExpr(ref)) {
            return [...items, ...ref.items];
          }
          throw Error(
            "Event Bridge input transforms do not support array spreading non-constant arrays."
          );
        }
        return [...items, flattenExpression(x, scope)];
      }, [] as Expr[])
    );
  } else if (isBinaryExpr(expr)) {
    return new BinaryExpr(
      flattenExpression(expr.left, scope),
      expr.op,
      flattenExpression(expr.right, scope)
    );
  } else if (isObjectLiteralExpr(expr)) {
    return new ObjectLiteralExpr(
      expr.properties.reduce((props, e) => {
        if (isPropAssignExpr(e)) {
          return [
            ...props,
            new PropAssignExpr(e.name, flattenExpression(e.expr, scope)),
          ];
        } else {
          const flattened = flattenExpression(e.expr, scope);
          if (isObjectLiteralExpr(flattened)) {
            const spreadProps = flattened.properties.filter(isPropAssignExpr);
            return [...props, ...spreadProps];
          }
          throw new Error(
            "Event Bridge input transforms do not support object spreading non-constant objects."
          );
        }
      }, [] as PropAssignExpr[])
    );
  } else if (isTemplateExpr(expr)) {
    const flattenedExpressions = expr.exprs.map((x) =>
      flattenExpression(x, scope)
    );

    const flattenedConstants = flattenedExpressions.map((e) => getConstant(e));
    const allConstants = flattenedConstants.every((c) => !!c);

    // when all of values are constants, turn them into a string constant now.
    return allConstants
      ? new StringLiteralExpr(
          (<Constant[]>flattenedConstants).map((e) => e.constant).join("")
        )
      : new TemplateExpr(expr.exprs.map((x) => flattenExpression(x, scope)));
  } else {
    return expr;
  }
};

export const flattenStatementsScope = (
  stmts: VariableStmt[]
): Record<string, Expr | undefined> => {
  return stmts.reduce((scope, stmt) => {
    const flattened = stmt.expr
      ? flattenExpression(stmt.expr, scope)
      : undefined;

    return {
      ...scope,
      [stmt.name]: flattened,
    };
  }, {});
};

export type EventReference = ReferencePath & {
  reference: [string] | ["detail", ...string[]];
};

// TODO: validate again object schema?
export function assertValidEventRefererence(
  eventReference?: ReferencePath,
  eventName?: string,
  utilsName?: string
): asserts eventReference is EventReference {
  if (!eventReference) {
    throw Error("Valid event reference was not provided.");
  }
  if (eventReference.identity === eventName) {
    if (eventReference.reference.length > 1) {
      const [first] = eventReference.reference;
      if (first !== "detail") {
        throw `Event references with depth greater than one must be on the detail property, got ${eventReference.reference.join(
          ","
        )}`;
      }
    }
  } else if (!utilsName || eventReference.identity !== utilsName) {
    throw Error(
      `Unresolved references can only reference the event paremeter (${eventName}) or the $utils parameter (${utilsName}), but found ${eventReference.identity}`
    );
  }
}

export const flattenReturnEvent = (stmts: Stmt[]) => {
  const scope = flattenStatementsScope(
    stmts.filter((_, i) => i < stmts.length - 1).filter(isVariableStmt)
  );

  const ret = stmts[stmts.length - 1];

  if (!ret || !isReturn(ret)) {
    throw Error("No return statement found in event bridge target function.");
  }

  return flattenExpression(ret.expr, scope);
};
