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
  if (Globals.has(value)) {
    return;
  }
  Globals.set(value, () => expr);
  registerOwnProperties(value, expr);
  if (typeof value === "function") {
    registerValue(value.prototype, propAccessExpr(expr, "prototype"));
  } else if (value && typeof value === "object") {
    registerValue(value.constructor, propAccessExpr(expr, "constructor"));
  }
}

function registerOwnProperties(value: any, expr: ts.Expression) {
  if (value && (typeof value === "object" || typeof value === "function")) {
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
      registerValue(propDesc.value, propAccessExpr(expr, propName));
    }
  }
}
