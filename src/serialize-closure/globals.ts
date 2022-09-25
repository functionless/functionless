// @ts-nocheck

// sourced from the lib.*.d.ts files
import module from "module";
import globals from "./globals.json";
import { callExpr, idExpr, propAccessExpr, stringExpr } from "./util";

export const Globals = new Map<any, () => string>();

// for (const valueName of globals) {
//   if (valueName in global) {
//     registerValue(global[valueName as keyof typeof global], idExpr(valueName));
//   }
// }

const ignore = [
  "_http_agent",
  "_http_client",
  "_http_common",
  "_http_incoming",
  "_http_outgoing",
  "_http_server",
  "_stream_duplex",
  "_stream_passthrough",
  "_stream_readable",
  "_stream_transform",
  "_stream_wrap",
  "_stream_writable",
  "_tls_common",
  "_tls_wrap",
  // "assert",
  // "assert/strict",
  // "async_hooks",
  // "buffer",
  // "child_process",
  // "cluster",
  // "console",
  // "constants",
  // "crypto",
  // "dgram",
  // "diagnostics_channel",
  // "dns",
  // "dns/promises",
  // "domain",
  // "events",
  // "fs",
  // "fs/promises",
  // "http",
  // "http2",
  // "https",
  // "inspector",
  // "module",
  // "net",
  // "os",
  // "path",
  // "path/posix",
  // "path/win32",
  // "perf_hooks",
  // "process",
  // "punycode",
  // "querystring",
  // "readline",
  // "repl",
  // "stream",
  // "stream/consumers",
  // "stream/promises",
  // "stream/web",
  // "string_decoder",
  "sys",
  // "timers",
  // "timers/promises",
  // "tls",
  // "trace_events",
  // "tty",
  // "url",
  // "util",
  // "util/types",
  // "v8",
  // "vm",
  // "worker_threads",
  // "zlib",
];

// for (const moduleName of module.builtinModules) {
//   if (ignore.includes(moduleName) || moduleName.startsWith("_")) {
//     continue;
//   }
//   // eslint-disable-next-line @typescript-eslint/no-require-imports
//   const module = require(moduleName);
//   const requireModule = callExpr(idExpr("require"), [stringExpr(moduleName)]);
//   registerValue(module, requireModule);
//   registerOwnProperties(
//     module,
//     requireModule,
//     true,
//     // skip crypto.DEFAULT_ENCODING to avoid complaints about deprecated APIs
//     // TODO: is this a good tenet? Only support non-deprecated APIs?
//     moduleName === "crypto" ? ["DEFAULT_ENCODING"] : []
//   );
// }

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

function registerOwnProperties(
  value: any,
  expr: string,
  isModule: boolean,
  skip: string[] = []
) {
  if (
    value &&
    (typeof value === "object" || typeof value === "function") &&
    !(Array.isArray(value) && value !== Array.prototype)
  ) {
    // go through each of its properties

    for (const propName of Object.getOwnPropertyNames(value)) {
      if (skip.includes(propName)) {
        continue;
      } else if (value === process && propName === "env") {
        // never serialize environment variables
        continue;
      } else if (value === module && propName === "_cache") {
        // never serialize the module cache
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
