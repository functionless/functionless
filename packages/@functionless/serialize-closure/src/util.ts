import path from "path";
import { FunctionlessNode } from "@functionless/ast";
import { SourceNode } from "source-map";

export function undefinedExpr() {
  return "undefined";
}

export function nullExpr() {
  return "null";
}

export function trueExpr() {
  return "true";
}

export function falseExpr() {
  return "false";
}

export function idExpr(name: string) {
  return name;
}

export function stringExpr(name: string) {
  // this seems dangerous - are we handling this right?
  return `"${name.replaceAll('"', '\\"').replaceAll("\n", "\\n")}"`;
}

export function numberExpr(num: number) {
  return num.toString(10);
}

export function bigIntExpr(num: bigint) {
  return `${num.toString(10)}n`;
}

export function regExpr(regex: RegExp) {
  return `/${regex.source}/${regex.flags}`;
}

export function objectExpr(obj: Record<string, SourceNodeOrString>) {
  return createSourceNodeWithoutSpan(
    "{",
    ...Object.entries(obj).flatMap(([name, val]) => [
      createSourceNodeWithoutSpan(name, " : ", val),
      ",",
    ]),
    "}"
  );
}

export type SourceNodeOrString = string | SourceNode;

export function createSourceNodeWithoutSpan<S extends SourceNodeOrString[]>(
  ...exprs: S
): S extends string ? string : SourceNodeOrString {
  if (exprs.every((expr) => typeof expr === "string")) {
    return exprs.join("");
  } else {
    return new SourceNode(null, null, "index.js", exprs) as any;
  }
}

export function createSourceNode(
  node: FunctionlessNode,
  chunks: string | SourceNodeOrString[]
) {
  const absoluteFileName = node.getFileName();

  return new SourceNode(
    node.span[0],
    node.span[1],
    path.relative(process.cwd(), absoluteFileName),
    chunks
  );
}

const propNameRegex = /^[_a-zA-Z][_a-zA-Z0-9]*$/g;

export function propAccessExpr<S extends SourceNodeOrString>(
  expr: S,
  name: string
): S extends string ? string : SourceNodeOrString {
  if (name.match(propNameRegex)) {
    return createSourceNodeWithoutSpan(expr, ".", name) as S extends string
      ? string
      : SourceNodeOrString;
  } else {
    return createSourceNodeWithoutSpan(
      expr,
      "[",
      stringExpr(name),
      "]"
    ) as S extends string ? string : SourceNodeOrString;
  }
}

export function assignExpr(
  left: SourceNodeOrString | SourceNode,
  right: SourceNodeOrString | SourceNode
) {
  return createSourceNodeWithoutSpan(left, " = ", right);
}

export function callExpr<
  E extends SourceNodeOrString,
  A extends SourceNodeOrString
>(expr: E, args: A[]): E | A extends string ? string : SourceNodeOrString {
  return createSourceNodeWithoutSpan(
    expr,
    "(",
    ...args.flatMap((arg, i) => (i < args.length - 1 ? [arg, ","] : [arg])),
    ")"
  ) as E | A extends string ? string : SourceNodeOrString;
}

export function newExpr(expr: string, args: string[]): string;
export function newExpr(expr: SourceNodeOrString, args: SourceNodeOrString[]) {
  return createSourceNodeWithoutSpan(
    "new ",
    expr,
    "(",
    ...args.flatMap((arg) => [arg, ","]),
    ")"
  );
}

export function exprStmt(expr: SourceNodeOrString | SourceNode) {
  return createSourceNodeWithoutSpan(expr, ";");
}

export function setPropertyStmt(
  on: SourceNodeOrString,
  key: string,
  value: SourceNodeOrString
) {
  return createSourceNodeWithoutSpan(setPropertyExpr(on, key, value), ";");
}

export function setPropertyExpr(
  on: SourceNodeOrString,
  key: string,
  value: SourceNodeOrString
) {
  return assignExpr(propAccessExpr(on, key), value);
}

export function definePropertyExpr(
  on: SourceNodeOrString,
  name: SourceNodeOrString,
  value: SourceNodeOrString
) {
  return callExpr(propAccessExpr(idExpr("Object"), "defineProperty"), [
    on,
    name,
    value,
  ]);
}

export function getOwnPropertyDescriptorExpr(
  obj: SourceNodeOrString,
  key: SourceNodeOrString
) {
  return callExpr(
    propAccessExpr(idExpr("Object"), "getOwnPropertyDescriptor"),
    [obj, key]
  );
}
