import ts from "typescript";

export function undefinedExpr() {
  return ts.factory.createIdentifier("undefined");
}

export function nullExpr() {
  return ts.factory.createNull();
}

export function trueExpr() {
  return ts.factory.createTrue();
}

export function falseExpr() {
  return ts.factory.createFalse();
}

export function idExpr(name: string) {
  return ts.factory.createIdentifier(name);
}

export function stringExpr(name: string) {
  return ts.factory.createStringLiteral(name);
}

export function numberExpr(num: number) {
  return ts.factory.createNumericLiteral(num);
}

export function objectExpr(obj: Record<string, ts.Expression>) {
  return ts.factory.createObjectLiteralExpression(
    Object.entries(obj).map(([name, val]) =>
      ts.factory.createPropertyAssignment(name, val)
    )
  );
}

const propNameRegex = /^[_a-zA-Z][_a-zA-Z0-9]*$/g;

export function propAccessExpr(expr: ts.Expression, name: string) {
  if (name.match(propNameRegex)) {
    return ts.factory.createPropertyAccessExpression(expr, name);
  } else {
    return ts.factory.createElementAccessExpression(expr, stringExpr(name));
  }
}

export function assignExpr(left: ts.Expression, right: ts.Expression) {
  return ts.factory.createBinaryExpression(
    left,
    ts.factory.createToken(ts.SyntaxKind.EqualsToken),
    right
  );
}

export function callExpr(expr: ts.Expression, args: ts.Expression[]) {
  return ts.factory.createCallExpression(expr, undefined, args);
}

export function exprStmt(expr: ts.Expression): ts.Statement {
  return ts.factory.createExpressionStatement(expr);
}

export function setPropertyStmt(
  on: ts.Expression,
  key: string,
  value: ts.Expression
) {
  return exprStmt(setPropertyExpr(on, key, value));
}

export function setPropertyExpr(
  on: ts.Expression,
  key: string,
  value: ts.Expression
) {
  return assignExpr(propAccessExpr(on, key), value);
}

export function definePropertyExpr(
  on: ts.Expression,
  name: ts.Expression,
  value: ts.Expression
) {
  return callExpr(propAccessExpr(idExpr("Object"), "defineProperty"), [
    on,
    name,
    value,
  ]);
}

export function getOwnPropertyDescriptorExpr(
  obj: ts.Expression,
  key: ts.Expression
) {
  return callExpr(
    propAccessExpr(idExpr("Object"), "getOwnPropertyDescriptor"),
    [obj, key]
  );
}
