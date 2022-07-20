import { ErrorCodes, SynthError } from "./error-code";
import {
  Argument,
  ComputedPropertyNameExpr,
  Expr,
  FunctionExpr,
  Identifier,
  StringLiteralExpr,
} from "./expression";
import {
  anyOf,
  isErr,
  isFunctionDecl,
  isFunctionLike,
  isNode,
  isParameterDecl,
} from "./guards";
import { Integration } from "./integration";
import { BaseNode, FunctionlessNode, FunctionLike } from "./node";
import { reflect } from "./reflect";
import { BlockStmt } from "./statement";
import { AnyFunction } from "./util";

export type Decl = FunctionDecl | ParameterDecl | BindingElem;

export function isDecl(a: any): a is Decl {
  return isNode(a) && (isFunctionDecl(a) || isParameterDecl(a));
}

abstract class BaseDecl<
  Kind extends FunctionlessNode["kind"],
  Parent extends FunctionlessNode | undefined
> extends BaseNode<Kind, Parent> {
  readonly nodeKind: "Decl" = "Decl";
}

export class FunctionDecl<F extends AnyFunction = AnyFunction> extends BaseDecl<
  "FunctionDecl",
  undefined
> {
  readonly _functionBrand?: F;
  constructor(readonly parameters: ParameterDecl[], readonly body: BlockStmt) {
    super("FunctionDecl");
    parameters.forEach((param) => param.setParent(this));
    body.setParent(this);
  }

  public clone(): this {
    return new FunctionDecl(
      this.parameters.map((param) => param.clone()),
      this.body.clone()
    ) as this;
  }
}

export interface IntegrationInvocation {
  integration: Integration<any>;
  args: Argument[];
}

export class ParameterDecl extends BaseDecl<
  "ParameterDecl",
  FunctionDecl | FunctionExpr
> {
  constructor(readonly name: string | BindingPattern) {
    super("ParameterDecl");
  }

  public clone(): this {
    return new ParameterDecl(this.name) as this;
  }
}

export const isFunctionDeclOrErr = anyOf(isFunctionDecl, isErr);

export function validateFunctionLike(
  a: any,
  functionLocation: string
): FunctionLike {
  return validateFunctionlessNode(a, functionLocation, isFunctionLike);
}

export function validateFunctionlessNode<E extends FunctionlessNode>(
  a: any,
  functionLocation: string,
  validate: (e: FunctionlessNode) => e is E
): E {
  if (typeof a === "function") {
    return validateFunctionlessNode(reflect(a), functionLocation, validate);
  } else if (validate(a)) {
    return a;
  } else if (isErr(a)) {
    throw a.error;
  } else {
    // eslint-disable-next-line no-debugger
    debugger;
    throw new SynthError(
      ErrorCodes.FunctionDecl_not_compiled_by_Functionless,
      `Expected input function to ${functionLocation} to be compiled by Functionless. Make sure you have the Functionless compiler plugin configured correctly.`
    );
  }
}

export type BindingPattern = ObjectBinding | ArrayBinding;

/**
 * A binding element declares new variable or acts as the root to a nested {@link BindingPattern}
 * when destructuring an object or an array.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
 *
 * It represents a single named element in a {@link BindingPattern}.
 *
 * ```ts
 * const { a } = right;
 *      // ^ BindingElm
 * const [ a ] = right;
 *      // ^ BindingElm
 * ```
 *
 * * `a` - creates a variable called a with the value of the right side (`const a = right.a`).
 * * `a: b` - creates a variable called b with the value of the right side (`const b = right.b`).
 * * `a = "value"` - creates a variable called a with the value of the right side or "value" when the right side is undefined (`const a = right.a ?? "value"`)
 * * `a: { b }` - creates a variable called b with the value of the right side's a value. (`const b = right.a.b`)
 * * `...rest`- creates a variable called rest with all of the unused keys in the right side
 *
 * > Note: for {@link ArrayBinding}, the accessor will be a numeric index instead of a named property
 * > `const a = right[0]`
 *
 * Rest (`...rest`) example:
 *
 * ```ts
 * const val = { a: 1, b:2 };
 * const { a, ...rest } = val;
 *             // ^ { b: 2 }
 * ```
 */
export class BindingElem extends BaseDecl<"BindingElem", BindingPattern> {
  constructor(
    readonly name: Identifier | BindingPattern,
    readonly rest: boolean,
    readonly propertyName?:
      | Identifier
      | ComputedPropertyNameExpr
      | StringLiteralExpr,
    readonly initializer?: Expr
  ) {
    super("BindingElem");
    name.setParent(this);
    propertyName?.setParent(this);
    initializer?.setParent(this);
  }

  public clone(): this {
    return new BindingElem(
      this.name,
      this.rest,
      this.propertyName,
      this.initializer
    ) as this;
  }
}

/**
 * Extract properties or sub-objects out of an object.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
 *
 * Container of {@link BindingElem}.
 *
 * ```ts
 * const { a: { b = "value" }, ...rest } = obj;
 * ```
 *
 * is the same as
 *
 * ```ts
 * const b = obj.a.b ?? "value"
 * const rest = { ...obj };
 * delete rest.a;
 * ```
 *
 * @see BindingElm for more details.
 */
export class ObjectBinding extends BaseNode<"ObjectBinding"> {
  readonly nodeKind: "Node" = "Node";

  constructor(readonly bindings: BindingElem[]) {
    super("ObjectBinding");
    bindings.forEach((b) => b.setParent(this));
  }

  public clone(): this {
    return new ObjectBinding(this.bindings.map((b) => b.clone())) as this;
  }
}

/**
 * Extract properties or sub-objects out of an array.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
 *
 * Container of {@link BindingElem}.
 *
 * ```ts
 * const [ a: [ b = "value" ], ...rest ] = arr;
 * ```
 *
 * is the same as
 *
 * ```ts
 * const b = arr[0][0] ?? "value";
 * const rest = arr.slice(1);
 * ```
 *
 * @see BindingElm for more details.
 */
export class ArrayBinding extends BaseNode<"ArrayBinding"> {
  readonly nodeKind: "Node" = "Node";

  constructor(readonly bindings: (BindingElem | undefined)[]) {
    super("ArrayBinding");
    bindings.forEach((b) => b?.setParent(this));
  }

  public clone(): this {
    return new ArrayBinding(this.bindings.map((b) => b?.clone())) as this;
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
