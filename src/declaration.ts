import { BaseNode, isNode, setParent, typeGuard } from "./node";
import { BlockStmt } from "./statement";
import { AnyFunction } from "./util";

export type Decl = FunctionDecl | ParameterDecl;

export function isDecl(a: any): a is Decl {
  return isNode(a) && (isFunctionDecl(a) || isParameterDecl(a));
}

export const isFunctionDecl = typeGuard("FunctionDecl");

export class FunctionDecl<
  F extends AnyFunction = AnyFunction
> extends BaseNode<"FunctionDecl"> {
  readonly _functionBrand?: F;
  constructor(readonly parameters: ParameterDecl[], readonly body: BlockStmt) {
    super("FunctionDecl");
    setParent(this, parameters);
    body.parent = this;
  }
}

export const isParameterDecl = typeGuard("ParameterDecl");

export class ParameterDecl extends BaseNode<"ParameterDecl"> {
  constructor(readonly name: string) {
    super("ParameterDecl");
  }
}
