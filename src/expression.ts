import type {
  BindingElem,
  ClassMember,
  Decl,
  GetAccessorDecl,
  MethodDecl,
  ParameterDecl,
  SetAccessorDecl,
  VariableDecl,
} from "./declaration";
import {
  isIdentifier,
  isNumberLiteralExpr,
  isParenthesizedExpr,
  isPrivateIdentifier,
  isPropAssignExpr,
  isStringLiteralExpr,
} from "./guards";
import { BaseNode, FunctionlessNode } from "./node";
import { NodeKind } from "./node-kind";
import { Span } from "./span";
import type { BlockStmt, Stmt } from "./statement";
import type { AnyClass, AnyFunction } from "./util";

/**
 * An {@link Expr} (Expression) is a Node that will be interpreted to a value.
 */
export type Expr =
  | Argument
  | ArrayLiteralExpr
  | ArrowFunctionExpr
  | AwaitExpr
  | BigIntExpr
  | BinaryExpr
  | BooleanLiteralExpr
  | CallExpr
  | ClassExpr
  | ComputedPropertyNameExpr
  | ConditionExpr
  | DeleteExpr
  | ElementAccessExpr
  | FunctionExpr
  | Identifier
  | NewExpr
  | NoSubstitutionTemplateLiteralExpr
  | NullLiteralExpr
  | NumberLiteralExpr
  | ObjectLiteralExpr
  | OmittedExpr
  | ParenthesizedExpr
  | PostfixUnaryExpr
  | PrivateIdentifier
  | PropAccessExpr
  | PropAssignExpr
  | ReferenceExpr
  | RegexExpr
  | SpreadAssignExpr
  | SpreadElementExpr
  | StringLiteralExpr
  | TaggedTemplateExpr
  | TemplateExpr
  | ThisExpr
  | TypeOfExpr
  | UnaryExpr
  | UndefinedLiteralExpr
  | VoidExpr
  | YieldExpr;

export abstract class BaseExpr<
  Kind extends NodeKind,
  Parent extends FunctionlessNode | undefined =
    | BindingElem
    | Expr
    | Stmt
    | VariableDecl
> extends BaseNode<Kind, Parent> {
  readonly nodeKind: "Expr" = "Expr";
}

export class ArrowFunctionExpr<
  F extends AnyFunction = AnyFunction
> extends BaseExpr<NodeKind.ArrowFunctionExpr, FunctionlessNode | undefined> {
  readonly _functionBrand?: F;
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly parameters: ParameterDecl[],
    readonly body: BlockStmt,
    /**
     * true if this function has an `async` modifier
     * ```ts
     * async () =>  {}
     * ```
     */
    readonly isAsync: boolean,
    /**
     * Name of the source file this node originates from.
     *
     * Only set on the root of the tree, i.e. when `this` is `undefined`.
     */
    readonly filename?: string
  ) {
    super(NodeKind.ArrowFunctionExpr, span, arguments);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
    this.ensureArrayOf(parameters, "parameters", [NodeKind.ParameterDecl]);
    this.ensure(isAsync, "isAsync", ["boolean"]);
    this.ensure(filename, "filename", ["undefined", "string"]);
  }
}

export class FunctionExpr<
  F extends AnyFunction = AnyFunction
> extends BaseExpr<NodeKind.FunctionExpr> {
  readonly _functionBrand?: F;
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
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
    super(NodeKind.FunctionExpr, span, arguments);
    this.ensure(name, "name", ["undefined", "string"]);
    this.ensureArrayOf(parameters, "parameters", [NodeKind.ParameterDecl]);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
    this.ensure(isAsync, "isAsync", ["boolean"]);
    this.ensure(isAsterisk, "isAsterisk", ["boolean"]);
    this.ensure(filename, "filename", ["undefined", "string"]);
  }
}

export class ClassExpr<C extends AnyClass = AnyClass> extends BaseExpr<
  NodeKind.ClassExpr,
  FunctionlessNode | undefined
> {
  readonly _classBrand?: C;
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly name: Identifier | undefined,
    readonly heritage: Expr | undefined,
    readonly members: ClassMember[],
    /**
     * Name of the source file this node originates from.
     *
     * Only set on the root of the tree, i.e. when `this` is `undefined`.
     */
    readonly filename?: string
  ) {
    super(NodeKind.ClassExpr, span, arguments);
    this.ensure(name, "name", ["undefined", NodeKind.Identifier]);
    this.ensure(heritage, "heritage", ["undefined", "Expr"]);
    this.ensureArrayOf(members, "members", NodeKind.ClassMember);
    this.ensure(filename, "filename", ["undefined", "string"]);
  }
}

export class ReferenceExpr<
  R = unknown
> extends BaseExpr<NodeKind.ReferenceExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    /**
     * Name of the referenced variable.
     *
     * ```ts
     * let i;
     *
     * i; // "i"
     * ```
     */
    readonly name: string,
    /**
     * A closure that produces the referred value.
     */
    readonly ref: () => R,
    /**
     * A number that uniquely identifies the variable within this AST.
     *
     * This is used to ensure that two ReferenceExpr's pointing to the same variable still point
     * to the same variable after transformation.
     */
    readonly id: number
  ) {
    super(NodeKind.ReferenceExpr, span, arguments);
    this.ensure(name, "name", ["undefined", "string"]);
    this.ensure(ref, "ref", ["function"]);
    this.ensure(id, "id", ["number"]);
  }
}

export type VariableReference = Identifier | PropAccessExpr | ElementAccessExpr;

export class Identifier extends BaseExpr<NodeKind.Identifier> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly name: string
  ) {
    super(NodeKind.Identifier, span, arguments);
    this.ensure(name, "name", ["string"]);
  }

  public lookup(): Decl | undefined {
    return this.getLexicalScope().get(this.name);
  }
}

export class PrivateIdentifier extends BaseExpr<NodeKind.PrivateIdentifier> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly name: `#${string}`
  ) {
    super(NodeKind.PrivateIdentifier, span, arguments);
    this.ensure(name, "name", ["string"]);
  }

  public lookup(): Decl | undefined {
    return this.getLexicalScope().get(this.name);
  }
}

export class PropAccessExpr extends BaseExpr<NodeKind.PropAccessExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr | SuperKeyword,
    readonly name: Identifier | PrivateIdentifier,
    /**
     * Whether this is using optional chaining.
     * ```ts
     * a?.prop
     * ```
     */
    readonly isOptional: boolean
  ) {
    super(NodeKind.PropAccessExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr", NodeKind.SuperKeyword]);
    this.ensure(name, "ref", [NodeKind.Identifier, NodeKind.PrivateIdentifier]);
  }
}

export class ElementAccessExpr extends BaseExpr<NodeKind.ElementAccessExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr,
    readonly element: Expr,
    /**
     * Whether this is using optional chaining.
     * ```ts
     * a?.[element]
     * ```
     */
    readonly isOptional: boolean
  ) {
    super(NodeKind.ElementAccessExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
    this.ensure(element, "element", ["Expr"]);
    this.ensure(isOptional, "isOptional", ["undefined", "boolean"]);
  }
}

export class Argument extends BaseExpr<NodeKind.Argument, CallExpr | NewExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr
  ) {
    super(NodeKind.Argument, span, arguments);
    this.ensure(expr, "element", ["Expr"]);
  }
}

export class CallExpr<
  E extends Expr | SuperKeyword | ImportKeyword =
    | Expr
    | SuperKeyword
    | ImportKeyword
> extends BaseExpr<NodeKind.CallExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: E,
    readonly args: Argument[]
  ) {
    super(NodeKind.CallExpr, span, arguments);
  }
}

export class NewExpr extends BaseExpr<NodeKind.NewExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr,
    readonly args: Argument[]
  ) {
    super(NodeKind.NewExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
    this.ensureArrayOf(args, "args", [NodeKind.Argument]);
  }
}

export class ConditionExpr extends BaseExpr<NodeKind.ConditionExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly when: Expr,
    readonly then: Expr,
    readonly _else: Expr
  ) {
    super(NodeKind.ConditionExpr, span, arguments);
    this.ensure(when, "when", ["Expr"]);
    this.ensure(then, "then", ["Expr"]);
    this.ensure(_else, "else", ["Expr"]);
  }
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#arithmetic_operators
 */
export type ArithmeticOp = "+" | "-" | "/" | "*" | "%" | "**";

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#assignment_operators
 */
export type AssignmentOp =
  | "="
  | "*="
  | "**="
  | "/="
  | "%="
  | "+="
  | "-="
  | "<<="
  | ">>="
  | ">>>="
  | "&="
  | "^="
  | "|="
  | "&&="
  | "||="
  | "??=";

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#binary_logical_operators
 */
export type BinaryLogicalOp = "&&" | "||" | "??";

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#bitwise_shift_operators
 */
export type BitwiseShiftOp = "<<" | ">>" | ">>>";

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#binary_bitwise_operators
 */
export type BitwiseBinaryOp = "&" | "|" | "^";

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#comma_operator
 */
export type CommaOp = ",";

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#equality_operators
 */
export type EqualityOp = "==" | "!=" | "===" | "!==";

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#relational_operators
 */
export type RelationalOp = "in" | "instanceof" | "<" | ">" | "<=" | ">=";

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators
 */
export type BinaryOp =
  | ArithmeticOp
  | AssignmentOp
  | BinaryLogicalOp
  | BitwiseShiftOp
  | BitwiseBinaryOp
  | CommaOp
  | EqualityOp
  | RelationalOp;

export class BinaryExpr extends BaseExpr<NodeKind.BinaryExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly left: Expr,
    readonly op: BinaryOp,
    readonly right: Expr
  ) {
    super(NodeKind.BinaryExpr, span, arguments);
    this.ensure(left, "left", ["Expr"]);
    this.ensure(right, "right", ["Expr"]);
  }
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#increment_and_decrement
 */
export type PostfixUnaryOp = "--" | "++";

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#unary_operators
 */
export type UnaryOp = "!" | "+" | "-" | "~" | PostfixUnaryOp;

export class UnaryExpr extends BaseExpr<NodeKind.UnaryExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly op: UnaryOp,
    readonly expr: Expr
  ) {
    super(NodeKind.UnaryExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
}

export class PostfixUnaryExpr extends BaseExpr<NodeKind.PostfixUnaryExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly op: PostfixUnaryOp,
    readonly expr: Expr
  ) {
    super(NodeKind.PostfixUnaryExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
}

// literals

export class NullLiteralExpr extends BaseExpr<NodeKind.NullLiteralExpr> {
  readonly value = null;
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span
  ) {
    super(NodeKind.NullLiteralExpr, span, arguments);
  }
}

export class UndefinedLiteralExpr extends BaseExpr<NodeKind.UndefinedLiteralExpr> {
  readonly value = undefined;

  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span
  ) {
    super(NodeKind.UndefinedLiteralExpr, span, arguments);
  }
}

export class BooleanLiteralExpr extends BaseExpr<NodeKind.BooleanLiteralExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly value: boolean
  ) {
    super(NodeKind.BooleanLiteralExpr, span, arguments);
    this.ensure(value, "value", ["boolean"]);
  }
}

export class BigIntExpr extends BaseExpr<NodeKind.BigIntExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly value: bigint
  ) {
    super(NodeKind.BigIntExpr, span, arguments);
    this.ensure(value, "value", ["bigint"]);
  }
}

export class NumberLiteralExpr extends BaseExpr<NodeKind.NumberLiteralExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly value: number
  ) {
    super(NodeKind.NumberLiteralExpr, span, arguments);
    this.ensure(value, "value", ["number"]);
  }
}

export class StringLiteralExpr extends BaseExpr<NodeKind.StringLiteralExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly value: string
  ) {
    super(NodeKind.StringLiteralExpr, span, arguments);
    this.ensure(value, "value", ["string"]);
  }
}

export class ArrayLiteralExpr extends BaseExpr<NodeKind.ArrayLiteralExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly items: Expr[]
  ) {
    super(NodeKind.ArrayLiteralExpr, span, arguments);
    this.ensureArrayOf(items, "items", ["Expr"]);
  }
}

export type ObjectElementExpr =
  | GetAccessorDecl
  | MethodDecl
  | PropAssignExpr
  | SetAccessorDecl
  | SpreadAssignExpr;

export class ObjectLiteralExpr extends BaseExpr<NodeKind.ObjectLiteralExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly properties: ObjectElementExpr[]
  ) {
    super(NodeKind.ObjectLiteralExpr, span, arguments);
    this.ensureArrayOf(properties, "properties", NodeKind.ObjectElementExpr);
  }

  public getProperty(name: string) {
    return this.properties.find((prop) => {
      if (isPropAssignExpr(prop)) {
        if (isIdentifier(prop.name) || isPrivateIdentifier(prop.name)) {
          return prop.name.name === name;
        } else if (isStringLiteralExpr(prop.name)) {
          return prop.name.value === name;
        } else if (isNumberLiteralExpr(prop.name)) {
          // compare by string
          return prop.name.value.toString(10) === name;
        } else if (isStringLiteralExpr(prop.name.expr)) {
          return prop.name.expr.value === name;
        }
      }
      return false;
    });
  }
}

export type PropName =
  | Identifier
  | PrivateIdentifier
  | ComputedPropertyNameExpr
  | StringLiteralExpr
  | NumberLiteralExpr;

export class PropAssignExpr extends BaseExpr<
  NodeKind.PropAssignExpr,
  ObjectLiteralExpr
> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly name: PropName,
    readonly expr: Expr
  ) {
    super(NodeKind.PropAssignExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
}

export class ComputedPropertyNameExpr extends BaseExpr<
  NodeKind.ComputedPropertyNameExpr,
  PropAssignExpr
> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr
  ) {
    super(NodeKind.ComputedPropertyNameExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
}

export class SpreadAssignExpr extends BaseExpr<
  NodeKind.SpreadAssignExpr,
  ObjectLiteralExpr
> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr
  ) {
    super(NodeKind.SpreadAssignExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
}

export class SpreadElementExpr extends BaseExpr<
  NodeKind.SpreadElementExpr,
  ObjectLiteralExpr
> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr
  ) {
    super(NodeKind.SpreadElementExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
}

export type TemplateLiteral = TemplateExpr | NoSubstitutionTemplateLiteralExpr;

/**
 * A Template literal with no substitutions.
 *
 * ```ts
 * `has no substitutions`
 * ```
 */
export class NoSubstitutionTemplateLiteralExpr extends BaseExpr<NodeKind.NoSubstitutionTemplateLiteral> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly text: string
  ) {
    super(NodeKind.NoSubstitutionTemplateLiteral, span, arguments);
    this.ensure(text, "text", ["string"]);
  }
}

/**
 * A template expression.
 *
 * ```ts
 * `<head>(${expr}<literal>)*
 * ```
 */
export class TemplateExpr extends BaseExpr<NodeKind.TemplateExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    /**
     * The literal text prefix of the template.
     * ```
     * `head${expr}` // "head"
     * `${expr}` // ""
     * ```
     */
    readonly head: TemplateHead,
    /**
     * A chain of {@link TemplateSpan}s. The last {@link TemplateSpan}'s `literal` is always a
     * {@link TemplateTail} and the former are always {@link TemplateMiddle}s.
     */
    readonly spans: [
      ...TemplateSpan<TemplateMiddle>[],
      TemplateSpan<TemplateTail>
    ]
  ) {
    super(NodeKind.TemplateExpr, span, arguments);
    this.ensure(head, "head", [NodeKind.TemplateHead]);
    this.ensureArrayOf(spans, "spans", [NodeKind.TemplateSpan]);
  }
}

/**
 * A tagged template expression.
 *
 * ```ts
 * <tag>`<head>(${expr}<literal>)*
 * ```
 */
export class TaggedTemplateExpr extends BaseExpr<NodeKind.TaggedTemplateExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly tag: Expr,
    readonly template: TemplateLiteral
  ) {
    super(NodeKind.TaggedTemplateExpr, span, arguments);
    this.ensure(tag, "tag", ["Expr"]);
    this.ensure(template, "template", [
      NodeKind.TemplateExpr,
      NodeKind.NoSubstitutionTemplateLiteral,
    ]);
  }
}

/**
 * The first quasi string at the beginning of a {@link TemplateExpr}.
 *
 * ```ts
 * const s = `abc${def}`
 *          // ^ TemplateHead
 * ```
 *
 * Is empty in the case when there is no head quasi:
 * ```ts
 * `${abc}`
 * // TemplateHead is "".
 * ```
 */
export class TemplateHead extends BaseNode<NodeKind.TemplateHead> {
  readonly nodeKind = "Node";

  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly text: string
  ) {
    super(NodeKind.TemplateHead, span, arguments);
    this.ensure(text, "text", ["string"]);
  }
}

/**
 * A span of text and expression within a {@link TemplateExpr} or {@link TaggedTemplateExpr}.
 *
 * ```ts
 * `${expr}<literal>`
 * ```
 */
export class TemplateSpan<
  Literal extends TemplateMiddle | TemplateTail = TemplateMiddle | TemplateTail
> extends BaseNode<NodeKind.TemplateSpan> {
  readonly nodeKind = "Node";

  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr,
    readonly literal: Literal
  ) {
    super(NodeKind.TemplateSpan, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
    this.ensure(literal, "literal", [
      NodeKind.TemplateMiddle,
      NodeKind.TemplateTail,
    ]);
  }
}

export class TemplateMiddle extends BaseNode<NodeKind.TemplateMiddle> {
  readonly nodeKind = "Node";

  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly text: string
  ) {
    super(NodeKind.TemplateMiddle, span, arguments);
    this.ensure(text, "text", ["string"]);
  }
}

export class TemplateTail extends BaseNode<NodeKind.TemplateTail> {
  readonly nodeKind = "Node";

  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly text: string
  ) {
    super(NodeKind.TemplateTail, span, arguments);
    this.ensure(text, "text", ["string"]);
  }
}

export class TypeOfExpr extends BaseExpr<NodeKind.TypeOfExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr
  ) {
    super(NodeKind.TypeOfExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
}

export class AwaitExpr extends BaseExpr<NodeKind.AwaitExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr
  ) {
    super(NodeKind.AwaitExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
}

export class ThisExpr<T = any> extends BaseExpr<NodeKind.ThisExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    /**
     * Produce the value of `this`
     */
    readonly ref: () => T
  ) {
    super(NodeKind.ThisExpr, span, arguments);
    this.ensure(ref, "ref", ["function"]);
  }
}

export class SuperKeyword extends BaseNode<NodeKind.SuperKeyword> {
  // `super` is not an expression - a reference to it does not yield a value
  // it only supports the following interactions
  // 1. call in a constructor - `super(..)`
  // 2. call a method on it - `super.method(..)`.
  readonly nodeKind = "Node";
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span
  ) {
    super(NodeKind.SuperKeyword, span, arguments);
  }
}

export class ImportKeyword extends BaseNode<NodeKind.ImportKeyword> {
  readonly nodeKind = "Node";
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span
  ) {
    super(NodeKind.ImportKeyword, span, arguments);
  }
}

export class YieldExpr<
  Delegate extends boolean = boolean
> extends BaseExpr<NodeKind.YieldExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    /**
     * The expression to yield (or delegate) to.
     *
     * If {@link delegate} is `true`, then {@link expr} must be defined, because
     * `yield*` defers to another Generator, which `undefined` is not.
     */
    readonly expr: Expr | Delegate extends true ? undefined : never,
    /**
     * Is a `yield*` delegate expression.
     */
    readonly delegate: Delegate
  ) {
    super(NodeKind.YieldExpr, span, arguments);
    this.ensure(delegate, "delegate", ["boolean"]);
    if (delegate) {
      this.ensure(expr, "expr", ["Expr"]);
    } else {
      this.ensure(expr, "expr", ["undefined", "Expr"]);
    }
  }
}

export class RegexExpr extends BaseExpr<NodeKind.RegexExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly regex: RegExp
  ) {
    super(NodeKind.RegexExpr, span, arguments);
  }
}

export class VoidExpr extends BaseExpr<NodeKind.VoidExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    /**
     * The expression to yield (or delegate) to.
     */
    readonly expr: Expr
  ) {
    super(NodeKind.VoidExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
}

export class DeleteExpr extends BaseExpr<NodeKind.DeleteExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: PropAccessExpr | ElementAccessExpr
  ) {
    super(NodeKind.DeleteExpr, span, arguments);
    this.ensure(expr, "expr", [
      NodeKind.PropAccessExpr,
      NodeKind.ElementAccessExpr,
    ]);
  }
}

export class ParenthesizedExpr extends BaseExpr<NodeKind.ParenthesizedExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr
  ) {
    super(NodeKind.ParenthesizedExpr, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }

  public unwrap(): Expr | undefined {
    if (isParenthesizedExpr(this.expr)) {
      return this.expr.unwrap();
    }
    return this.expr;
  }
}

export class OmittedExpr extends BaseExpr<NodeKind.OmittedExpr> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span
  ) {
    super(NodeKind.OmittedExpr, span, arguments);
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
