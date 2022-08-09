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
import { Span } from "./span";
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
  BlockStmt | undefined
> {
  readonly _classBrand?: C;
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly name: string,
    readonly heritage: Expr | undefined,
    readonly members: ClassMember[],
    /**
     * Name of the source file this node originates from.
     *
     * Only set on the root of the tree, i.e. when `this` is `undefined`.
     */
    readonly filename?: string
  ) {
    super(NodeKind.ClassDecl, span, arguments);
    this.ensure(name, "name", ["string"]);
    this.ensureArrayOf(members, "members", NodeKind.ClassMember);
    this.ensure(filename, "filename", ["undefined", "string"]);
  }
}

export type ClassMember =
  | ClassStaticBlockDecl
  | ConstructorDecl
  | GetAccessorDecl
  | MethodDecl
  | PropDecl
  | SetAccessorDecl;

export class ClassStaticBlockDecl extends BaseDecl<
  NodeKind.ClassStaticBlockDecl,
  ClassDecl | ClassExpr
> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly block: BlockStmt
  ) {
    super(NodeKind.ClassStaticBlockDecl, span, arguments);
    this.ensure(block, "block", [NodeKind.BlockStmt]);
  }
}

export class ConstructorDecl extends BaseDecl<NodeKind.ConstructorDecl> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly parameters: ParameterDecl[],
    readonly body: BlockStmt,
    /**
     * Name of the source file this node originates from.
     *
     * Only set on the root of the tree, i.e. when `this` is `undefined`.
     */
    readonly filename?: string
  ) {
    super(NodeKind.ConstructorDecl, span, arguments);
    this.ensureArrayOf(parameters, "parameters", [NodeKind.ParameterDecl]);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
    this.ensure(filename, "filename", ["undefined", "string"]);
  }
}

export class MethodDecl extends BaseDecl<
  NodeKind.MethodDecl,
  ClassDecl | ClassExpr | undefined
> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly name: PropName,
    readonly parameters: ParameterDecl[],
    readonly body: BlockStmt,
    /**
     * true if this function has an `async` modifier
     * ```ts
     * class Foo {
     *   async foo() {}
     *
     *   // asterisk can co-exist
     *   async *foo() {}
     * }
     * ```
     */
    readonly isAsync: boolean,
    /**
     * true if this function has an `*` modifier
     *
     * ```ts
     * class Foo {
     *   foo*() {}
     *
     *   // async can co-exist
     *   async *foo() {}
     * }
     * ```
     */
    readonly isAsterisk: boolean,
    /**
     * Name of the source file this node originates from.
     *
     * Only set on the root of the tree, i.e. when `this` is `undefined`.
     */
    readonly filename?: string
  ) {
    super(NodeKind.MethodDecl, span, arguments);
    this.ensure(name, "name", NodeKind.PropName);
    this.ensureArrayOf(parameters, "parameters", [NodeKind.ParameterDecl]);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
    this.ensure(isAsync, "isAsync", ["boolean"]);
    this.ensure(isAsterisk, "isAsterisk", ["boolean"]);
    this.ensure(filename, "filename", ["undefined", "string"]);
  }
}

export class PropDecl extends BaseDecl<NodeKind.PropDecl> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly name: PropName,
    readonly isStatic: boolean,
    readonly initializer?: Expr
  ) {
    super(NodeKind.PropDecl, span, arguments);
    this.ensure(name, "name", NodeKind.PropName);
    this.ensure(isStatic, "isStatic", ["boolean"]);
    this.ensure(initializer, "initializer", ["undefined", "Expr"]);
  }
}

export class GetAccessorDecl extends BaseDecl<
  NodeKind.GetAccessorDecl,
  ClassDecl | ClassExpr | ObjectLiteralExpr
> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly name: PropName,
    readonly body: BlockStmt
  ) {
    super(NodeKind.GetAccessorDecl, span, arguments);
    this.ensure(name, "name", NodeKind.PropName);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
  }
}
export class SetAccessorDecl extends BaseDecl<
  NodeKind.SetAccessorDecl,
  ClassDecl | ClassExpr | ObjectLiteralExpr
> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly name: PropName,
    readonly parameter: ParameterDecl,
    readonly body: BlockStmt
  ) {
    super(NodeKind.SetAccessorDecl, span, arguments);
    this.ensure(name, "name", NodeKind.PropName);
    this.ensure(parameter, "parameter", [NodeKind.ParameterDecl]);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
  }
}

export type FunctionLike<F extends AnyFunction = AnyFunction> =
  | FunctionDecl<F>
  | FunctionExpr<F>
  | ArrowFunctionExpr<F>;

export class FunctionDecl<F extends AnyFunction = AnyFunction> extends BaseDecl<
  NodeKind.FunctionDecl,
  BlockStmt | undefined
> {
  readonly _functionBrand?: F;
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    // TODO: narrow to string once we migrate compile.ts to produce a 1:1 AST node
    // right now, Arrow and FunctionExpr are parsed to FunctionDecl, so name can be undefined
    // according to the spec, name is mandatory on a FunctionDecl and FunctionExpr
    readonly name: string | undefined,
    readonly parameters: ParameterDecl[],
    readonly body: BlockStmt,
    /**
     * true if this function has an `async` modifier
     * ```ts
     * async function foo() {}
     * // asterisk can co-exist
     * async function *foo() {}
     * ```
     */
    readonly isAsync: boolean,
    /**
     * true if this function has an `*` modifier
     *
     * ```ts
     * function foo*() {}
     *
     * // async can co-exist
     * async function *foo() {}
     * ```
     */
    readonly isAsterisk: boolean,
    /**
     * Name of the source file this node originates from.
     *
     * Only set on the root of the tree, i.e. when `this` is `undefined`.
     */
    readonly filename?: string
  ) {
    super(NodeKind.FunctionDecl, span, arguments);
    this.ensure(name, "name", ["undefined", "string"]);
    this.ensureArrayOf(parameters, "parameters", [NodeKind.ParameterDecl]);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
    this.ensure(isAsync, "isAsync", ["boolean"]);
    this.ensure(isAsterisk, "isAsterisk", ["boolean"]);
    this.ensure(filename, "filename", ["undefined", "string"]);
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
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly name: BindingName,
    readonly initializer: Expr | undefined,
    /**
     * Whether this ParameterDecl is a rest parameter
     * ```ts
     * function foo(...rest) {}
     * ```
     */
    readonly isRest: boolean
  ) {
    super(NodeKind.ParameterDecl, span, arguments);
    this.ensure(name, "name", NodeKind.BindingNames);
    this.ensure(initializer, "initializer", ["undefined", "Expr"]);
    this.ensure(isRest, "isRest", ["boolean"]);
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
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly name: BindingName,
    readonly rest: boolean,
    readonly propertyName?: PropName,
    readonly initializer?: Expr
  ) {
    super(NodeKind.BindingElem, span, arguments);
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

  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly bindings: BindingElem[]
  ) {
    super(NodeKind.ObjectBinding, span, arguments);
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

  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly bindings: (BindingElem | OmittedExpr)[]
  ) {
    super(NodeKind.ArrayBinding, span, arguments);
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

export enum VariableDeclKind {
  Const = 0,
  Let = 1,
  Var = 2,
}

export class VariableDecl<
  E extends Expr | undefined = Expr | undefined
> extends BaseDecl<NodeKind.VariableDecl, VariableDeclParent> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly name: BindingName,
    readonly initializer: E
  ) {
    super(NodeKind.VariableDecl, span, arguments);
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

  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly decls: VariableDecl[],
    readonly varKind: VariableDeclKind
  ) {
    super(NodeKind.VariableDeclList, span, arguments);
    this.ensureArrayOf(decls, "decls", [NodeKind.VariableDecl]);
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
