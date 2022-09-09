// sourced from the lib.*.d.ts files
import module from "module";
import globals from "./serialize-globals.json";
import { callExpr, idExpr, propAccessExpr, stringExpr } from "./serialize-util";

export const Globals = new Map<any, () => string>();

for (const valueName of globals) {
  if (valueName in global) {
    registerValue(global[valueName as keyof typeof global], idExpr(valueName));
  }
}

for (const moduleName of module.builtinModules) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require(moduleName);
  const requireModule = callExpr(idExpr("require"), [stringExpr(moduleName)]);
  registerValue(module, requireModule);
  registerOwnProperties(module, requireModule, true);
}

function registerValue(value: any, expr: string) {
  if (Globals.has(value)) {
    return;
  }
  if (typeof value === "object" || typeof value === "function") {
    Globals.set(value, () => expr);
    registerOwnProperties(value, expr, false);
    if (typeof value === "function") {
      registerValue(value.prototype, propAccessExpr(expr, "prototype"));
    } else if (value && typeof value === "object") {
      // registerValue(value.constructor, propAccessExpr(expr, "constructor"));
    }
  }
}

function registerOwnProperties(value: any, expr: string, isModule: boolean) {
  if (
    value &&
    (typeof value === "object" || typeof value === "function") &&
    !(Array.isArray(value) && value !== Array.prototype)
  ) {
    // go through each of its properties

    for (const propName of Object.getOwnPropertyNames(value)) {
      if (value === process && propName === "env") {
        // never serialize environment variables
        continue;
      }
      const propDesc = Object.getOwnPropertyDescriptor(value, propName);
      if (propDesc?.get && isModule) {
        registerValue(propDesc.get(), propAccessExpr(expr, propName));
      } else if (!propDesc?.writable) {
        continue;
      }
      registerValue(propDesc.value, propAccessExpr(expr, propName));
    }
  }
}
