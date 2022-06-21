import { ErrorCodes, SynthError } from "./error-code";
import { Argument, FunctionExpr } from "./expression";
import { NativePreWarmContext } from "./function-prewarm";
import { isErr, isFunctionDecl, isNode, isParameterDecl } from "./guards";
import { Integration } from "./integration";
import { BaseNode, FunctionlessNode } from "./node";
import { BlockStmt } from "./statement";
import { AnyFunction, anyOf } from "./util";

export type Decl = FunctionDecl | ParameterDecl | NativeFunctionDecl;

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

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
