import { ErrorCodes, SynthError } from "./error-code";
import {
  Argument,
  ComputedPropertyNameExpr,
  Expr,
  FunctionExpr,
  Identifier,
  StringLiteralExpr,
} from "./expression";
import { isErr, isFunctionDecl, isNode, isParameterDecl } from "./guards";
import { Integration } from "./integration";
import { BaseNode, FunctionlessNode } from "./node";
import { BlockStmt } from "./statement";
import { AnyFunction, anyOf } from "./util";

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

export function validateFunctionDecl(
  a: any,
  functionLocation: string
): FunctionDecl {
  return validateFunctionlessNode(a, functionLocation, isFunctionDecl);
}

export function validateFunctionlessNode<E extends FunctionlessNode>(
  a: any,
  functionLocation: string,
  validate: (e: FunctionlessNode) => e is E
): E {
  if (validate(a)) {
    return a;
  } else if (isErr(a)) {
    throw a.error;
  } else {
    debugger;
    throw new SynthError(
      ErrorCodes.FunctionDecl_not_compiled_by_Functionless,
      `Expected input function to ${functionLocation} to be compiled by Functionless. Make sure you have the Functionless compiler plugin configured correctly.`
    );
  }
}

export type BindingPattern = ObjectBinding | ArrayBinding;

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
