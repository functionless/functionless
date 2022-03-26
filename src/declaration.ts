import { FunctionExpr } from "./expression";
import { BaseNode, FunctionlessNode, isNode, typeGuard } from "./node";
import { BlockStmt } from "./statement";
import { AnyFunction } from "./util";

export type Decl = FunctionDecl | ParameterDecl;

export function isDecl(a: any): a is Decl {
  return isNode(a) && (isFunctionDecl(a) || isParameterDecl(a));
}

export const isFunctionDecl = typeGuard("FunctionDecl");

class BaseDecl<
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
}

export const isParameterDecl = typeGuard("ParameterDecl");

export class ParameterDecl extends BaseDecl<
  "ParameterDecl",
  FunctionDecl | FunctionExpr
> {
  constructor(readonly name: string) {
    super("ParameterDecl");
  }
}
