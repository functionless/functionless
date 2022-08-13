// sourced from the lib.*.d.ts files
import { globals, modules } from "./serialize-globals.json";
import { call, id, prop, string } from "./serialize-util";

export const Globals = new Map<any, () => ts.Expression>();

const G: any = globalThis;

for (const moduleName of modules) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module: any = require(moduleName);

  Globals.set(module, () => call(id("require"), [string(moduleName)]));

  for (const [exportName, exportValue] of Object.entries(module)) {
    Globals.set(exportValue, () =>
      prop(call(id("require"), [string(moduleName)]), exportName)
    );

    if (typeof exportValue === "function") {
      Globals.set(exportValue.prototype, () =>
        prop(
          prop(call(id("require"), [string(moduleName)]), exportName),
          "prototype"
        )
      );
    }
  }
}

for (const valueName of globals) {
  // these are references to functions or namespaces

  if (valueName in G) {
    const value = G[valueName];

    console.debug(`[${valueName}, id(${valueName})]`);
    Globals.set(value, () => id(valueName));
    if (typeof value === "function") {
      console.debug(
        `[${valueName}.prototype, prop(id(${valueName}), prototype)]`
      );
      Globals.set(value.prototype, () => prop(id(valueName), "prototype"));
    }

    // go through each of its properties
    for (const [propName, propValue] of Object.entries(value)) {
      if (value === process && propName === "env") {
        continue;
      }
      if (typeof propValue === "function") {
        console.debug(
          `[${valueName}.${propName}, prop(id(${valueName}), ${propName})]`
        );
        Globals.set(propValue, () => prop(id(valueName), propName));
      }
    }
  }
}
