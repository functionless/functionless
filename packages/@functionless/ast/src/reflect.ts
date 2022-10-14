import { ErrorCodes, SynthError } from "@functionless/error-code";
import {
  MethodDecl,
  GetAccessorDecl,
  SetAccessorDecl,
  FunctionLike,
} from "./declaration";
import { Err } from "./error";
import { ReferenceExpr } from "./expression";
import { isReferenceExpr, isErr, isNewExpr, isFunctionLike } from "./guards";
import { FunctionlessNode } from "./node";
import { tryResolveReferences } from "./resolve-references";
import { parseSExpr } from "./s-expression";
import { AnyAsyncFunction, AnyFunction } from "./util";
import { forEachChild, visitEachChild } from "./visit";

const Global: any = global;

/**
 * A macro (compile-time) function that converts an ArrowFunction or FunctionExpression to a {@link FunctionDecl}.
 *
 * Use this function to quickly grab the {@link FunctionDecl} (AST) representation of TypeScript syntax and
 * then perform interpretations of that representation.
 *
 * Valid uses  include an in-line ArrowFunction or FunctionExpression:
 * ```ts
 * const decl1 = reflect((arg: string) => {})
 * const decl2 = reflect(function (arg: string) {})
 * ```
 *
 * Illegal uses include references to functions or computed functions:
 * ```ts
 * const functionRef = () => {}
 * const decl1 = reflect(functionRef)
 *
 * function computeFunction() {
 *   return () => "hello"
 * }
 * const decl2 = reflect(computeFunction())
 * ```
 *
 * @param func an in-line ArrowFunction or FunctionExpression. It must be in-line and cannot reference
 *             a variable or a computed function/closure.
 */
export function reflect<F extends AnyFunction | AnyAsyncFunction>(
  func: F
):
  | FunctionLike<F>
  | MethodDecl<F>
  | GetAccessorDecl<F>
  | SetAccessorDecl<F>
  | Err
  | undefined {
  if (func.name === "bound requireModuleOrMock") {
    return undefined;
  } else if (func.name.startsWith("bound ")) {
    // native bound function
    const targetFunc = unbind(func)?.targetFunction;
    if (targetFunc) {
      return reflect(targetFunc);
    } else {
      return undefined;
    }
  }

  const astCallback = (<any>func)[ReflectionSymbols.AST];
  if (typeof astCallback === "function") {
    if (!reflectCache.has(astCallback)) {
      reflectCache.set(
        astCallback,
        parseAst(astCallback()) as FunctionLike<F> | Err
      );
    }
    return reflectCache.get(astCallback) as FunctionLike<F> | Err | undefined;
  }
  return undefined;
}

function parseAst(expr: any): any {
  const decl = parseSExpr(expr);
  return visitEachChild(decl, function visit(node): any {
    if (isReferenceExpr(node)) {
      return new ReferenceExpr(
        node.span,
        node.name,
        () => resolveSubstitution(node.ref()),
        node.id,
        node.referenceId
      );
    } else {
      return visitEachChild(node, visit);
    }
  });
}

const substitutionSymbol = Symbol.for("functionless::substitutions");

/**
 * A global WeakMap for re-directing ReferenceExpr references.
 *
 * This hack is to support the fl-exp inverted model.
 */
const substitutions: WeakMap<any, any> = (Global[substitutionSymbol] =
  Global[substitutionSymbol] ?? new WeakMap());

/**
 * Register a substitution. Any ReferenceExpr pointing to {@link from}
 * will be substituted with {@link to} when ReferenceExpr is resolved.
 */
export function registerSubstitution(from: any, to: any) {
  substitutions.set(from, to);
}

/**
 * Resolve a value, potentially substituting it if a substitution has
 * been registered for the {@link from} value. If no substitution
 * has been registered, then the original value in the ReferenceExpr
 * is returned.
 */
export function resolveSubstitution(from: any): any {
  return substitutions.has(from) ? substitutions.get(from) : from;
}

export interface BoundFunctionComponents<F extends AnyFunction = AnyFunction> {
  /**
   * The target function
   */
  targetFunction: F;
  /**
   * The `this` argument bound to the function.
   */
  boundThis: any;
  /**
   * The arguments bound to the function.
   */
  boundArgs: any[];
}

/**
 * Unbind a bound function into its components.
 * @param boundFunction the bound function
 * @returns the targetFunction, boundThis and boundArgs if this is a bound function compiled with Functionless, otherwise undefined.
 */
export function unbind<F extends AnyFunction>(
  boundFunction: F
): BoundFunctionComponents<F> | undefined {
  if (boundFunction.name.startsWith("bound ")) {
    const targetFunction = (<any>boundFunction)[
      ReflectionSymbols.TargetFunction
    ];
    const boundThis = (<any>boundFunction)[ReflectionSymbols.BoundThis];
    const boundArgs = (<any>boundFunction)[ReflectionSymbols.BoundArgs];
    if (targetFunction) {
      return {
        targetFunction,
        boundThis,
        boundArgs,
      };
    }
  }
  return undefined;
}

/**
 * The components of a {@link Proxy}.
 */
export interface ProxyComponents<T extends object = object> {
  /**
   * The target object that the {@link Proxy} is intercepting.
   */
  target: T;
  /**
   * The {@link ProxyHandler} interceptor handler functions.
   */
  handler: ProxyHandler<T>;
}

/**
 * Reverses a {@link Proxy} instance into the args that were used to created it.
 *
 * ```ts
 * const proxy = new Proxy({ hello: "world" }, { get: () => {} });
 *
 * const components = reverseProxy(proxy);
 * components.target  // { hello: "world" }
 * components.handler // { get: () => {} }
 * ```
 *
 * @param proxy the proxy instance
 * @returns the {@link ProxyComponents} if this proxy can be reversed, or `undefined`.
 */
export function reverseProxy<T extends object>(
  proxy: T
): ProxyComponents<T> | undefined {
  const reversed = getProxyMap().get(proxy);
  if (reversed) {
    return {
      target: reversed[0],
      handler: reversed[1],
    };
  }
  return undefined;
}

/**
 * @returns the global WeakMap containing all intercepted Proxies.
 */
function getProxyMap() {
  return (Global[Global.Symbol.for("functionless:Proxies")] =
    Global[Global.Symbol.for("functionless:Proxies")] ?? new Global.WeakMap());
}

export const ReflectionSymbolNames = {
  AST: "functionless:AST",
  BoundArgs: "functionless:BoundArgs",
  BoundThis: "functionless:BoundThis",
  Proxies: "functionless:Proxies",
  Reflect: "functionless:Reflect",
  TargetFunction: "functionless:TargetFunction",
} as const;

export const ReflectionSymbols = {
  AST: Symbol.for(ReflectionSymbolNames.AST),
  BoundArgs: Symbol.for(ReflectionSymbolNames.BoundArgs),
  BoundThis: Symbol.for(ReflectionSymbolNames.BoundThis),
  Proxies: Symbol.for(ReflectionSymbolNames.Proxies),
  Reflect: Symbol.for(ReflectionSymbolNames.Reflect),
  TargetFunction: Symbol.for(ReflectionSymbolNames.TargetFunction),
} as const;

// a global singleton cache of Function -> its AST form
// this cache avoids redundant parsing of s-expression arrays
const reflectCache: WeakMap<Function, FunctionLike | Err> = (Global[
  ReflectionSymbols.Reflect
] = Global[ReflectionSymbols.Reflect] ?? new WeakMap());

/**
 * Validates and return the {@link FunctionLike} AST of {@link a} if it is:
 * 1. a `function` that has been registered with its AST form
 * 2. already a {@link FunctionLike}
 *
 * @param a any value
 * @param functionLocation string describing the location of this validation (for error message)
 * @returns a {@link FunctionLike}
 * @throws an Error if {@link a} has not been registered or failed to parse
 */
export function validateFunctionLike(
  a: any,
  functionLocation: string
): FunctionLike {
  return validateFunctionlessNode(a, functionLocation, isFunctionLike);
}

/**
 * Validates and return the {@link Node} AST form of {@link a} if it is:
 * 1. a `function` that has been registered with its AST form
 * 2. already an instance of {@link Node}
 *
 * @param a any value
 * @param functionLocation string describing the location of this validation (for error message)
 * @param validate a guard
 * @returns a {@link FunctionLike}
 * @throws an Error if {@link a} has not been registered or failed to parse
 */
function validateFunctionlessNode<Node extends FunctionlessNode>(
  a: any,
  functionLocation: string,
  validate: (e: FunctionlessNode) => e is Node
): Node {
  if (a === undefined) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Expected input function to ${functionLocation} to be present, received undefined.`
    );
  } else if (validate(a)) {
    return validateFunctionlessNodeSemantics(a);
  } else if (isErr(a)) {
    throw a.error;
  } else if (typeof a === "function") {
    return validateFunctionlessNode(reflect(a), functionLocation, validate);
  } else {
    throw new SynthError(
      ErrorCodes.FunctionDecl_not_compiled_by_Functionless,
      `Expected input function to ${functionLocation} to be compiled by Functionless. Make sure you have the Functionless compiler plugin configured correctly.`
    );
  }
}

/**
 * Applies broad-spectrum validations to a {@link FunctionLike} AST. These validations
 * apply to all interpreters and are therefore located here.
 *
 * For now, the only validation is that there are no NewExprs that instantiate Constructs.
 */
function validateFunctionlessNodeSemantics<N extends FunctionlessNode>(
  node: N
): N {
  forEachChild(node, (child) => {
    if (isNewExpr(child)) {
      const references = tryResolveReferences(child.expr).filter(
        (clazz) =>
          // all classes that extend Construct have the static property, Symbol(jsii.rtti)
          // so this detects new <expr> where <expr> resolves to a Construct class
          (typeof clazz[Symbol.for("jsii.rtti")]?.fqn === "string" &&
            (function isConstruct(proto): boolean {
              if (proto === null) {
                // root of the prototype chain
                return false;
              } else if (proto.constructor?.name === "Construct") {
                return true;
              } else {
                return isConstruct(Object.getPrototypeOf(proto));
              }
            })(clazz.prototype)) ||
          // all Functionless primitives have the property, FunctionlessType
          // we should definitely make this a Symbol
          typeof clazz.FunctionlessType === "string"
      );
      if (references.length > 0) {
        throw new SynthError(
          ErrorCodes.Unsupported_initialization_of_resources,
          "Cannot initialize new CDK resources in a runtime function."
        );
      }
    }
    validateFunctionlessNodeSemantics(child);
  });
  return node;
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
