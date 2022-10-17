import * as swc from "@swc/core";

//A bunch of helper functions to build swc ast

export const zeroSpan = { ctxt: 0, start: 0, end: 0 };

/**
 * Create an import declaration
 * @param imports a, b, c in 'import { a, b, c} from "x"'
 * @param from x in 'import { a, b, c } from "x"'
 * @returns
 */
export function import_(
  imports: string[],
  {
    from,
  }: {
    from: string;
  }
): swc.ImportDeclaration {
  return {
    type: "ImportDeclaration",
    span: zeroSpan,
    specifiers: imports.map(importSpecifier),
    source: string(from),
    typeOnly: false,
  };
}

/**
 * Create an import default declaration
 * @param id a in 'import default a from "x"'
 * @param from x in 'import default a from "x"'
 * @returns
 */
export function importDefault(
  id: string,
  {
    from,
  }: {
    from: string;
  }
): swc.ImportDeclaration {
  return {
    type: "ImportDeclaration",
    span: zeroSpan,
    specifiers: [
      { type: "ImportDefaultSpecifier", local: identifier(id), span: zeroSpan },
    ],
    source: string(from),
    typeOnly: false,
  };
}

/**
 * Create an ImportSpecifier
 * @param value local identifier value
 * @returns
 */
export function importSpecifier(value: string): swc.ImportSpecifier {
  return {
    type: "ImportSpecifier",
    span: zeroSpan,
    local: identifier(value),
    isTypeOnly: false,
  };
}

/**
 * Create an identifier
 * @param value Name of the identifier
 * @param optional
 * @returns
 */
export function identifier(
  value: string,
  { optional }: { optional: boolean } = { optional: false }
): swc.Identifier {
  return { type: "Identifier", span: zeroSpan, value, optional };
}

export function string(value: string): swc.StringLiteral {
  return { type: "StringLiteral", span: zeroSpan, value, raw: `"${value}"` };
}

export function boolean(value: boolean): swc.BooleanLiteral {
  return { type: "BooleanLiteral", span: zeroSpan, value };
}

export function numeric(value: number): swc.NumericLiteral {
  return { type: "NumericLiteral", span: zeroSpan, value };
}

/**
 * Create an object expression. Values are mapped to expressions by autoExpression heuristic
 * @param value  object to express
 * @returns
 */
export function object(
  value: Record<string, AutoExpression>
): swc.ObjectExpression {
  return {
    type: "ObjectExpression",
    span: zeroSpan,
    properties: Object.entries(value).map(([k, v]) => ({
      type: "KeyValueProperty",
      key: string(k),
      value: autoExpression(v),
    })),
  };
}

/**
 * Create an export default expression
 * @param expression
 * @returns
 */
export function exportDefault(
  expression: swc.Expression
): swc.ExportDefaultExpression {
  return {
    type: "ExportDefaultExpression",
    span: zeroSpan,
    expression: expression,
  };
}

/**
 * Return an identifier referencing an environment variable of a given name
 */
export function environmentVariable(name: string): swc.Identifier {
  return identifier(`process.env.${name}`);
}

/**
 * Create a function call
 * @param callee name of the function to call
 * @param args arguments to the function, using autoExpression heurisitc
 * @returns
 */
export function call(
  callee: string,
  args: AutoExpression[]
): swc.CallExpression {
  return {
    type: "CallExpression",
    span: zeroSpan,
    callee: identifier(callee),
    arguments: args.map((exp) => ({ expression: autoExpression(exp) })),
  };
}

export type AutoExpression =
  | boolean
  | string
  | number
  | { [k in string]: AutoExpression }
  | undefined
  | swc.Expression;

const expressionTypes = [
  "ArrayExpression",
  "ArrowFunctionExpression",
  "AssignmentExpression",
  "AwaitExpression",
  "BigIntLiteral",
  "BinaryExpression",
  "BooleanLiteral",
  "CallExpression",
  "ClassExpression",
  "ConditionalExpression",
  "FunctionExpression",
  "Identifier",
  "JSXElement",
  "JSXEmptyExpression",
  "JSXFragment",
  "JSXMemberExpression",
  "JSXNamespacedName",
  "JSXText",
  "MemberExpression",
  "SuperPropExpression",
  "MetaProperty",
  "NewExpression",
  "NullLiteral",
  "NumericLiteral",
  "ObjectExpression",
  "ParenthesisExpression",
  "PrivateName",
  "RegExpLiteral",
  "SequenceExpression",
  "StringLiteral",
  "TaggedTemplateExpression",
  "TemplateLiteral",
  "ThisExpression",
  "TsAsExpression",
  "TsNonNullExpression",
  "TsTypeAssertion",
  "TsConstAssertion",
  "TsInstantiation",
  "UnaryExpression",
  "UpdateExpression",
  "YieldExpression",
  "OptionalChainingExpression",
  "Invalid",
];

/**
 * Whether the object is an Expression.
 * @param obj object under question
 * @returns
 */
function isExpression(obj: Record<string, any>): obj is swc.Expression {
  return expressionTypes.includes(obj.type);
}

/**
 * Attempt to map a value to an expression based on its runtime type
 * @param arg
 * @returns
 */
export function autoExpression(arg: AutoExpression): swc.Expression {
  switch (typeof arg) {
    case "boolean":
      return boolean(arg);
    case "string":
      return string(arg);
    case "number":
      return numeric(arg);
    case "object":
      if (isLiteralObject(arg)) {
        return isExpression(arg) ? arg : object(arg);
      } else {
        if (Array.isArray(arg)) {
          throw new Error("auto-expression arrays not supported yet");
        } else {
          throw new Error(`cannot serialize ${arg} as expression`);
        }
      }
    case "undefined":
      return identifier("undefined");
    default:
      throw new Error(`unsupported auto-expression: ${typeof arg}`);
  }
}

function isLiteralObject(a: any): a is Record<string, any> {
  return !!a && a.constructor === Object;
}

/**
 * Create a module
 * @param body
 * @returns
 */
export function module(...body: swc.ModuleItem[]): swc.Module {
  return { type: "Module", interpreter: "", span: zeroSpan, body };
}
