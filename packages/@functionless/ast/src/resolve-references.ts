import {
  isBindingElem,
  isBindingPattern,
  isConditionExpr,
  isElementAccessExpr,
  isIdentifier,
  isPropAccessExpr,
  isReferenceExpr,
  isThisExpr,
  isVariableDecl,
} from "./guards";
import { FunctionlessNode } from "./node";
import { resolveSubstitution } from "./reflect";
import { evalToConstant } from "./util";

/**
 * Resolve all of the possible values that {@link node} may resolve to at runtime.
 *
 * @param node
 * @param defaultValue default value to use if the value cannot be resolved (set by default initializers in BindingElement)
 * @returns an array of all the values the {@link node} resolves to.
 */
export function tryResolveReferences(
  node: FunctionlessNode | undefined,
  defaultValue?: FunctionlessNode
): any[] {
  if (node === undefined) {
    if (defaultValue === undefined) {
      return [];
    } else {
      return tryResolveReferences(defaultValue, undefined);
    }
  } else if (isReferenceExpr(node) || isThisExpr(node)) {
    const ref = node.ref?.();
    if (ref) {
      return [ref];
    }
  } else if (isIdentifier(node)) {
    return tryResolveReferences(node.lookup(), defaultValue);
  } else if (isBindingElem(node)) {
    return tryResolveReferences(node.parent, node.initializer).flatMap(
      (value) => {
        if (isIdentifier(node.name)) {
          return [resolveSubstitution(value?.[node.name.name])];
        } else {
          throw new Error("should be impossible");
        }
      }
    );
  } else if (isBindingPattern(node)) {
    // we only ever evaluate `{ a }` or `[ a ]` when walking backwards from `a`
    // the BindingElem resolver case will pluck `a` from the object returned by this
    return tryResolveReferences(node.parent, defaultValue);
  } else if (isVariableDecl(node)) {
    return tryResolveReferences(node.initializer, defaultValue);
  } else if (isPropAccessExpr(node) || isElementAccessExpr(node)) {
    return tryResolveReferences(node.expr, undefined).flatMap((expr) => {
      const key: any = isPropAccessExpr(node)
        ? node.name.name
        : evalToConstant(node.element)?.constant;
      if (key !== undefined) {
        return [resolveSubstitution((<any>expr)?.[key])];
      }
      return [];
    });
  } else if (isConditionExpr(node)) {
    return tryResolveReferences(node.then, defaultValue).concat(
      tryResolveReferences(node._else, defaultValue)
    );
  }
  return [];
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
