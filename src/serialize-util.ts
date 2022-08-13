import ts from "typescript";

export function undefined_expr() {
  return ts.factory.createIdentifier("undefined");
}

export function null_expr() {
  return ts.factory.createNull();
}

export function true_expr() {
  return ts.factory.createTrue();
}

export function false_expr() {
  return ts.factory.createFalse();
}

export function id(name: string) {
  return ts.factory.createIdentifier(name);
}

export function string(name: string) {
  return ts.factory.createStringLiteral(name);
}

export function number(num: number) {
  return ts.factory.createNumericLiteral(num);
}

export function object(obj: Record<string, ts.Expression>) {
  return ts.factory.createObjectLiteralExpression(
    Object.entries(obj).map(([name, val]) =>
      ts.factory.createPropertyAssignment(name, val)
    )
  );
}

const propNameRegex = /^[_a-zA-Z][_a-zA-Z0-9]*$/g;

export function prop(expr: ts.Expression, name: string) {
  if (name.match(propNameRegex)) {
    return ts.factory.createPropertyAccessExpression(expr, name);
  } else {
    return ts.factory.createElementAccessExpression(expr, string(name));
  }
}

export function assign(left: ts.Expression, right: ts.Expression) {
  return ts.factory.createBinaryExpression(
    left,
    ts.factory.createToken(ts.SyntaxKind.EqualsToken),
    right
  );
}

export function call(expr: ts.Expression, args: ts.Expression[]) {
  return ts.factory.createCallExpression(expr, undefined, args);
}

export function expr(expr: ts.Expression): ts.Statement {
  return ts.factory.createExpressionStatement(expr);
}

export function defineProperty(
  on: ts.Expression,
  name: ts.Expression,
  value: ts.Expression
) {
  return call(prop(id("Object"), "defineProperty"), [on, name, value]);
}

export function getOwnPropertyDescriptor(
  obj: ts.Expression,
  key: ts.Expression
) {
  return call(prop(id("Object"), "getOwnPropertyDescriptor"), [obj, key]);
}
