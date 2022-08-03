import {
  ArrowFunctionExpr,
  ClassExpr,
  Expr,
  FunctionExpr,
  Identifier,
  ObjectLiteralExpr,
  OmittedExpr,
  PropName,
} from "./expression";
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
import { AnyClass, AnyFunction } from "./util";

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
    this.ensure(name, "name", ["string"]);
    this.ensureArrayOf(members, "members", NodeKind.ClassMember);
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
    this.ensure(block, "block", [NodeKind.BlockStmt]);
  }
}

export class ConstructorDecl extends BaseDecl<NodeKind.ConstructorDecl> {
  constructor(readonly parameters: ParameterDecl[], readonly body: BlockStmt) {
    super(NodeKind.ConstructorDecl, arguments);
    this.ensureArrayOf(parameters, "parameters", [NodeKind.ParameterDecl]);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
  }
}

export class MethodDecl extends BaseDecl<NodeKind.MethodDecl> {
  constructor(
    readonly name: PropName,
    readonly parameters: ParameterDecl[],
    readonly body: BlockStmt
  ) {
    super(NodeKind.MethodDecl, arguments);
    this.ensure(name, "name", NodeKind.PropName);
    this.ensureArrayOf(parameters, "parameters", [NodeKind.ParameterDecl]);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
  }
}

export class PropDecl extends BaseDecl<NodeKind.PropDecl> {
  constructor(
    readonly name: PropName,
    readonly isStatic: boolean,
    readonly initializer?: Expr
  ) {
    super(NodeKind.PropDecl, arguments);
    this.ensure(name, "name", NodeKind.PropName);
    this.ensure(isStatic, "isStatic", ["boolean"]);
    this.ensure(initializer, "initializer", ["undefined", "Expr"]);
  }
}

export class GetAccessorDecl extends BaseDecl<
  NodeKind.GetAccessorDecl,
  ClassDecl | ClassExpr | ObjectLiteralExpr
> {
  constructor(readonly name: PropName, readonly body: BlockStmt) {
    super(NodeKind.GetAccessorDecl, arguments);
    this.ensure(name, "name", NodeKind.PropName);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
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
    this.ensure(name, "name", NodeKind.PropName);
    this.ensure(parameter, "parameter", [NodeKind.ParameterDecl]);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
  }
}

export type FunctionLike<F extends AnyFunction = AnyFunction> =
  | FunctionDecl<F>
  | FunctionExpr<F>
  | ArrowFunctionExpr<F>;

export class FunctionDecl<
  F extends AnyFunction = AnyFunction
> extends BaseDecl<NodeKind.FunctionDecl> {
  readonly _functionBrand?: F;
  constructor(
    // TODO: narrow to string once we migrate compile.ts to produce a 1:1 AST node
    // right now, Arrow and FunctionExpr are parsed to FunctionDecl, so name can be undefined
    // according to the spec, name is mandatory on a FunctionDecl and FunctionExpr
    readonly name: string | undefined,
    readonly parameters: ParameterDecl[],
    readonly body: BlockStmt,
    readonly isAsync: boolean,
    readonly isAsterisk: boolean
  ) {
    super(NodeKind.FunctionDecl, arguments);
    this.ensure(name, "name", ["undefined", "string"]);
    this.ensureArrayOf(parameters, "parameters", [NodeKind.ParameterDecl]);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
    this.ensure(isAsync, "isAsync", ["boolean"]);
    this.ensure(isAsterisk, "isAsterisk", ["boolean"]);
  }
}

export interface IntegrationInvocation {
  integration: Integration<any>;
  args: Expr[];
}
export class ParameterDecl extends BaseDecl<
  NodeKind.ParameterDecl,
  ArrowFunctionExpr | FunctionDecl | FunctionExpr | SetAccessorDecl
> {
  constructor(readonly name: BindingName, readonly initializer?: Expr) {
    super(NodeKind.ParameterDecl, arguments);
    this.ensure(name, "name", NodeKind.BindingNames);
    this.ensure(initializer, "initializer", ["undefined", "Expr"]);
  }
}

export type BindingPattern = ObjectBinding | ArrayBinding;

export type BindingName = Identifier | BindingPattern;

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
    readonly propertyName?: PropName,
    readonly initializer?: Expr
  ) {
    super(NodeKind.BindingElem, arguments);
    this.ensure(name, "name", NodeKind.BindingNames);
    this.ensure(rest, "rest", ["boolean"]);
    this.ensure(propertyName, "propertyName", [
      "undefined",
      ...NodeKind.PropName,
    ]);
    this.ensure(initializer, "initializer", ["undefined", "Expr"]);
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
    this.ensureArrayOf(bindings, "bindings", [NodeKind.BindingElem]);
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
    this.ensureArrayOf(bindings, "bindings", [
      NodeKind.BindingElem,
      NodeKind.OmittedExpr,
    ]);
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
    this.ensure(name, "name", NodeKind.BindingNames);
    this.ensure(initializer, "initializer", ["undefined", "Expr"]);
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
    this.ensureArrayOf(decls, "decls", [NodeKind.VariableDecl]);
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
