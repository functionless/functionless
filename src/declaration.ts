import { ErrorCodes, SynthError } from "./error-code";
import {
  ArrowFunctionExpr,
  ClassExpr,
  ComputedPropertyNameExpr,
  Expr,
  FunctionExpr,
  Identifier,
  ObjectLiteralExpr,
  OmittedExpr,
  PropName,
  StringLiteralExpr,
} from "./expression";
import { isBindingPattern, isErr, isFunctionDecl } from "./guards";
import { Integration } from "./integration";
import { BaseNode, FunctionlessNode } from "./node";
import { NodeKind } from "./node-kind";
import type {
  BlockStmt,
  CatchClause,
  ForInStmt,
  ForOfStmt,
  ForStmt,
  VariableStmt,
} from "./statement";
import { AnyClass, AnyFunction, anyOf } from "./util";

export type Decl =
  | BindingElem
  | ClassDecl
  | ClassMember
  | FunctionDecl
  | ParameterDecl
  | VariableDecl;

abstract class BaseDecl<
  Kind extends NodeKind,
  Parent extends FunctionlessNode | undefined = FunctionlessNode | undefined
> extends BaseNode<Kind, Parent> {
  readonly nodeKind: "Decl" = "Decl";
}

export class ClassDecl<C extends AnyClass = AnyClass> extends BaseDecl<
  NodeKind.ClassDecl,
  undefined
> {
  readonly _classBrand?: C;
  constructor(
    readonly name: string,
    readonly heritage: Expr | undefined,
    readonly members: ClassMember[]
  ) {
    super(NodeKind.ClassDecl, arguments);
  }
  public clone(): this {
    return new ClassDecl(
      this.name,
      this.heritage?.clone(),
      this.members.map((m) => m.clone())
    ) as this;
  }
}

export type ClassMember =
  | ClassStaticBlockDecl
  | ConstructorDecl
  | GetAccessorDecl
  | MethodDecl
  | PropDecl
  | SetAccessorDecl;

export class ClassStaticBlockDecl extends BaseDecl<NodeKind.ClassStaticBlockDecl> {
  constructor(readonly block: BlockStmt) {
    super(NodeKind.ClassStaticBlockDecl, arguments);
  }

  public clone(): this {
    return new ClassStaticBlockDecl(this.block.clone()) as this;
  }
}

export class ConstructorDecl extends BaseDecl<NodeKind.ConstructorDecl> {
  constructor(readonly parameters: ParameterDecl[], readonly body: BlockStmt) {
    super(NodeKind.ConstructorDecl, arguments);
  }

  public clone(): this {
    return new ConstructorDecl(
      this.parameters.map((p) => p.clone()),
      this.body.clone()
    ) as this;
  }
}

export class MethodDecl extends BaseDecl<NodeKind.MethodDecl> {
  constructor(
    readonly name: PropName,
    readonly parameters: ParameterDecl[],
    readonly body: BlockStmt
  ) {
    super(NodeKind.MethodDecl, arguments);
  }

  public clone(): this {
    return new MethodDecl(
      this.name.clone(),
      this.parameters.map((p) => p.clone()),
      this.body.clone()
    ) as this;
  }
}

export class PropDecl extends BaseDecl<NodeKind.PropDecl> {
  constructor(
    readonly name: PropName,
    readonly isStatic: boolean,
    readonly initializer?: Expr
  ) {
    super(NodeKind.PropDecl, arguments);
  }
  public clone(): this {
    return new PropDecl(
      this.name.clone(),
      this.isStatic,
      this.initializer?.clone()
    ) as this;
  }
}

export class GetAccessorDecl extends BaseDecl<
  NodeKind.GetAccessorDecl,
  ClassDecl | ClassExpr | ObjectLiteralExpr
> {
  constructor(readonly name: PropName, readonly body: BlockStmt) {
    super(NodeKind.GetAccessorDecl, arguments);
  }
  public clone(): this {
    return new GetAccessorDecl(this.name.clone(), this.body.clone()) as this;
  }
}
export class SetAccessorDecl extends BaseDecl<
  NodeKind.SetAccessorDecl,
  ClassDecl | ClassExpr | ObjectLiteralExpr
> {
  constructor(
    readonly name: PropName,
    readonly parameter: ParameterDecl,
    readonly body: BlockStmt
  ) {
    super(NodeKind.SetAccessorDecl, arguments);
  }
  public clone(): this {
    return new SetAccessorDecl(
      this.name.clone(),
      this.parameter.clone(),
      this.body.clone()
    ) as this;
  }
}

export class FunctionDecl<
  F extends AnyFunction = AnyFunction
> extends BaseDecl<NodeKind.FunctionDecl> {
  readonly _functionBrand?: F;
  constructor(
    readonly name: string,
    readonly parameters: ParameterDecl[],
    readonly body: BlockStmt
  ) {
    super(NodeKind.FunctionDecl, arguments);
  }

  public clone(): this {
    return new FunctionDecl(
      this.name,
      this.parameters.map((param) => param.clone()),
      this.body.clone()
    ) as this;
  }
}

export interface IntegrationInvocation {
  integration: Integration<any>;
  args: Expr[];
}

export type BindingName = Identifier | BindingPattern;

export class ParameterDecl extends BaseDecl<
  NodeKind.ParameterDecl,
  ArrowFunctionExpr | FunctionDecl | FunctionExpr | SetAccessorDecl
> {
  constructor(readonly name: BindingName, readonly initializer?: Expr) {
    super(NodeKind.ParameterDecl, arguments);
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
 * * `a: b` - creates a variable called b with the value of the right side (`const b = right.a`).
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
export class BindingElem extends BaseDecl<
  NodeKind.BindingElem,
  BindingPattern
> {
  constructor(
    readonly name: BindingName,
    readonly rest: boolean,
    readonly propertyName?:
      | Identifier
      | ComputedPropertyNameExpr
      | StringLiteralExpr,
    readonly initializer?: Expr
  ) {
    super(NodeKind.BindingElem, arguments);
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
export class ObjectBinding extends BaseNode<
  NodeKind.ObjectBinding,
  VariableDecl
> {
  readonly nodeKind: "Node" = "Node";

  constructor(readonly bindings: BindingElem[]) {
    super(NodeKind.ObjectBinding, arguments);
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
export class ArrayBinding extends BaseNode<
  NodeKind.ArrayBinding,
  VariableDecl
> {
  readonly nodeKind: "Node" = "Node";

  constructor(readonly bindings: (BindingElem | OmittedExpr)[]) {
    super(NodeKind.ArrayBinding, arguments);
  }

  public clone(): this {
    return new ArrayBinding(this.bindings.map((b) => b?.clone())) as this;
  }
}

export type VariableDeclParent =
  | CatchClause
  | ForInStmt
  | ForOfStmt
  | VariableDeclList;

export class VariableDecl<
  E extends Expr | undefined = Expr | undefined
> extends BaseDecl<NodeKind.VariableDecl, VariableDeclParent> {
  constructor(readonly name: BindingName, readonly initializer: E) {
    super(NodeKind.VariableDecl, arguments);
  }

  public clone(): this {
    return new VariableDecl(
      isBindingPattern(this.name) ? this.name.clone() : this.name,
      this.initializer?.clone()
    ) as this;
  }
}

export type VariableDeclListParent = ForStmt | VariableStmt;

export class VariableDeclList extends BaseNode<
  NodeKind.VariableDeclList,
  VariableDeclListParent
> {
  readonly nodeKind: "Node" = "Node";

  constructor(readonly decls: VariableDecl[]) {
    super(NodeKind.VariableDeclList, arguments);
  }

  public clone(): this {
    return new VariableDeclList(this.decls.map((decl) => decl.clone())) as this;
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
