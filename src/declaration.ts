import { FunctionExpr } from "./expression";
import { BaseNode, FunctionlessNode, isNode, typeGuard } from "./node";
import { BlockStmt } from "./statement";
import { AnyFunction } from "./util";

export type Decl = FunctionDecl | ParameterDecl | HoistedFunctionDecl;

export function isDecl(a: any): a is Decl {
  return isNode(a) && (isFunctionDecl(a) || isParameterDecl(a));
}

export const isFunctionDecl = typeGuard("FunctionDecl");

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

export const isHoistedFunctionDecl = typeGuard("HoistedFunctionDecl");

/**
 * Instead of serializing this function to AST, this function has been hoisted to a module export with a random name.
 */
export class HoistedFunctionDecl<
  F extends AnyFunction = AnyFunction
> extends BaseDecl<"HoistedFunctionDecl", undefined> {
  readonly _functionBrand?: F;
  constructor(
    readonly closure: AnyFunction,
    readonly parameters: ParameterDecl[]
  ) {
    super("HoistedFunctionDecl");
    parameters.forEach((param) => param.setParent(this));
  }

  public clone(): this {
    return new HoistedFunctionDecl(
      this.closure,
      this.parameters.map((param) => param.clone())
    ) as this;
  }
}

export const isParameterDecl = typeGuard("ParameterDecl");

export class ParameterDecl extends BaseDecl<
  "ParameterDecl",
  FunctionDecl | FunctionExpr
> {
  constructor(readonly name: string) {
    super("ParameterDecl");
  }

  public clone(): this {
    return new ParameterDecl(this.name) as this;
  }
}
