import { Argument, FunctionExpr } from "./expression";
import { NativePreWarmContext } from "./function";
import { Integration } from "./integration";
import { BaseNode, FunctionlessNode, isNode, typeGuard } from "./node";
import { BlockStmt } from "./statement";
import { AnyFunction } from "./util";

export type Decl = FunctionDecl | ParameterDecl | NativeFunctionDecl;

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

export interface IntegrationInvocation {
  integration: Integration;
  args: Argument[];
}

export const isNativeFunctionDecl = typeGuard("NativeFunctionDecl");

/**
 * A function declaration which contains the original closure instead of Functionless expressions.
 */
export class NativeFunctionDecl<
  F extends AnyFunction = AnyFunction
> extends BaseDecl<"NativeFunctionDecl", undefined> {
  readonly _functionBrand?: F;
  constructor(
    readonly parameters: ParameterDecl[],
    // Compiler generates a closure that can inject in the preWarm context.
    readonly closure: (preWarmContext: NativePreWarmContext) => AnyFunction,
    readonly integrations: IntegrationInvocation[]
  ) {
    super("NativeFunctionDecl");
    parameters.forEach((param) => param.setParent(this));
  }

  public clone(): this {
    return new NativeFunctionDecl(
      this.parameters.map((param) => param.clone()),
      this.closure,
      this.integrations
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
