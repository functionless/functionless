import { assertNodeKind } from "../assert";
import { ParameterDecl } from "../declaration";
import { ErrorCodes, SynthError } from "../error-code";
import {
  ArrayLiteralExpr,
  BinaryExpr,
  ElementAccessExpr,
  Expr,
  Identifier,
  NumberLiteralExpr,
  ObjectLiteralExpr,
  PropAccessExpr,
  PropAssignExpr,
  StringLiteralExpr,
  TemplateExpr,
  UnaryExpr,
} from "../expression";
import {
  isArrayLiteralExpr,
  isBinaryExpr,
  isBindingPattern,
  isComputedPropertyNameExpr,
  isElementAccessExpr,
  isGetAccessorDecl,
  isIdentifier,
  isMethodDecl,
  isObjectLiteralExpr,
  isParenthesizedExpr,
  isPropAccessExpr,
  isPropAssignExpr,
  isReturnStmt,
  isSetAccessorDecl,
  isSpreadElementExpr,
  isStringLiteralExpr,
  isTemplateExpr,
  isUnaryExpr,
  isVariableStmt,
} from "../guards";
import { NodeKind } from "../node-kind";
import { Stmt, VariableStmt } from "../statement";
import { Constant, evalToConstant } from "../util";

/**
 * Returns a string array representing the property access starting from a named identity.
 *
 * Does not return the identity name given.
 *
 * (event) => {
 *   event.prop1.prop2
 * }
 *
 * Given the PropertyAccessExpr for "prop2", this function will return ["prop1", "prop2"];
 */
export const getReferencePath = (
  expression: Expr
): ReferencePath | undefined => {
  if (isParenthesizedExpr(expression)) {
    return getReferencePath(expression.expr);
  } else if (isIdentifier(expression)) {
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
      new ElementAccessExpr(expr.expr, flattenExpression(expr.element, scope))
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
    ? expr.name.name
    : evalToConstant(expr.element)?.constant;

  if (!(typeof key === "string" || typeof key === "number")) {
    throw new Error(
      `Property key much be a number or a string, found ${typeof key}`
    );
  }

  return key;
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
  if (isParenthesizedExpr(expr)) {
    return flattenExpression(expr.expr, scope);
  } else if (isUnaryExpr(expr)) {
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
        const val = parent.properties
          .filter(isPropAssignExpr)
          .find((p) =>
            isIdentifier(p.name)
              ? p.name.name === key
              : isStringLiteralExpr(p.name)
              ? p.name.value === key
              : false
          );
        if (!val) {
          throw Error(
            `Cannot find property ${key} in Object with constant keys: ${parent.properties
              .filter(isPropAssignExpr)
              .map((e) => e.name)
              .filter(
                (e): e is Identifier | StringLiteralExpr =>
                  isIdentifier(e) || isStringLiteralExpr(e)
              )
              .map((e) => (isIdentifier(e) ? e.name : e.value))
              .join()} of ${parent.properties.length} keys.`
          );
        }
        return val.expr;
      }
      throw Error("Object access must be a string.");
    } else if (isArrayLiteralExpr(parent)) {
      if (typeof key === "number") {
        return parent.items[key];
      }
      throw new Error("Array access must be a number.");
    }
    return typeof key === "string"
      ? new PropAccessExpr(parent, new Identifier(key), false)
      : new ElementAccessExpr(parent, new NumberLiteralExpr(key));
  } else if (isComputedPropertyNameExpr(expr)) {
    return flattenExpression(expr.expr, scope);
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
            new PropAssignExpr(
              isIdentifier(e.name)
                ? e.name
                : assertNodeKind(
                    flattenExpression(e.name, scope),
                    NodeKind.StringLiteralExpr
                  ),
              flattenExpression(e.expr, scope)
            ),
          ];
        } else {
          if (isSetAccessorDecl(e) || isGetAccessorDecl(e) || isMethodDecl(e)) {
            throw new SynthError(
              ErrorCodes.Unsupported_Feature,
              `${e.kindName} is not supported by Event Bridge`
            );
          }
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

    const flattenedConstants = flattenedExpressions.map((e) =>
      evalToConstant(e)
    );
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
  return stmts
    .flatMap((stmt) => stmt.declList.decls)
    .reduce((scope, stmt) => {
      const flattened = stmt.initializer
        ? flattenExpression(stmt.initializer, scope)
        : undefined;

      if (isBindingPattern(stmt.name)) {
        throw new SynthError(
          ErrorCodes.Unsupported_Feature,
          "Binding variable assignment is not currently supported in Event Bridge rules and input transforms. https://github.com/functionless/functionless/issues/302"
        );
      }

      return {
        ...scope,
        [stmt.name.name]: flattened,
      };
    }, {});
};

export type EventReference = ReferencePath & {
  reference: [string] | ["detail", ...string[]];
};

// TODO: validate again object schema?
export function assertValidEventReference(
  eventReference?: ReferencePath,
  eventName?: ParameterDecl,
  utilsName?: ParameterDecl
): asserts eventReference is EventReference {
  if (!eventReference) {
    throw Error("Valid event reference was not provided.");
  }
  if (
    (eventName && isBindingPattern(eventName.name)) ||
    (utilsName && isBindingPattern(utilsName.name))
  ) {
    throw new SynthError(
      ErrorCodes.Unsupported_Feature,
      "Binding parameter assignment is not currently supported in Event Bridge rules and input transforms. https://github.com/functionless/functionless/issues/302"
    );
  }
  const eName = eventName?.name;
  const uName = utilsName?.name;
  if (eventReference.identity === (<Identifier | undefined>eName)?.name) {
    if (eventReference.reference.length > 1) {
      const [first] = eventReference.reference;
      if (first !== "detail") {
        throw `Event references with depth greater than one must be on the detail property, got ${eventReference.reference.join(
          ","
        )}`;
      }
    }
  } else if (
    !utilsName ||
    eventReference.identity !== (<Identifier | undefined>uName)?.name
  ) {
    throw Error(
      `Unresolved references can only reference the event parameter (${eventName}) or the $utils parameter (${utilsName}), but found ${eventReference.identity}`
    );
  }
}

export const flattenReturnEvent = (stmts: Stmt[]) => {
  const scope = flattenStatementsScope(
    stmts.filter((_, i) => i < stmts.length - 1).filter(isVariableStmt)
  );

  const ret = stmts[stmts.length - 1];

  if (!ret || !isReturnStmt(ret)) {
    throw Error("No return statement found in event bridge target function.");
  }

  return flattenExpression(ret.expr, scope);
};

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
