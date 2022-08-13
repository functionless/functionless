// sourced from the lib.*.d.ts files
import { globals, modules } from "./serialize-globals.json";
import { callExpr, idExpr, propAccessExpr, stringExpr } from "./serialize-util";

export const Globals = new Map<any, () => ts.Expression>();

for (const valueName of globals) {
  if (valueName in global) {
    registerValue(global[valueName as keyof typeof global], idExpr(valueName));
  }
}

for (const moduleName of modules) {
  registerValue(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(moduleName),
    callExpr(idExpr("require"), [stringExpr(moduleName)])
  );
}

function registerValue(value: any, expr: ts.Expression) {
  Globals.set(value, () => expr);
  if (typeof value === "function") {
    Globals.set(value.prototype, () => propAccessExpr(expr, "prototype"));
  }
  registerOwnProperties(value, expr);
}

function registerOwnProperties(value: any, expr: ts.Expression) {
  // go through each of its properties
  for (const propName of Object.getOwnPropertyNames(value)) {
    if (value === process && propName === "env") {
      // never serialize environment variables
      continue;
    }
    const propDesc = Object.getOwnPropertyDescriptor(value, propName);
    if (!propDesc?.writable || propDesc?.get || propDesc.set) {
      continue;
    }
    const propValue = propDesc.value;
    if (
      propValue &&
      !Globals.has(propValue) &&
      (typeof propValue === "function" || typeof propValue === "object")
    ) {
      Globals.set(propValue, () => propAccessExpr(expr, propName));
      if (typeof propValue === "function") {
        registerOwnProperties(propValue, propAccessExpr(expr, propName));
      }
    }
  }
}
