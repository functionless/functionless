// import { CallExpr } from "./expression";
// import { IntegrationFunction } from "./util";
// import { VTL } from "./vtl";
// import { Function } from "./function";
// import { ASL, Task } from "./asl";

// export interface Integration {
//   vtl: (call: CallExpr, context: VTL) => string;
//   asl: (call: CallExpr, context: ASL) => Omit<Task, "Next">;
//   native: (context: Function<any, any>) => void;
// }

// export function makeCallable<T>(
//   obj: T,
//   func: IntegrationFunction
// ): T & IntegrationFunction {
//   return copyProperties(func, obj);
// }

// function copyProperties<To, From>(to: To, from: From): From & To {
//   to = Object.assign(to, from);
//   do {
//     for (const prop of Object.getOwnPropertyNames(from)) {
//       const val = (from as any)[prop];
//       if (typeof val === "function") {
//         (to as any)[prop] = val.bind(to);
//       } else {
//         (to as any)[prop] = val;
//       }
//     }
//   } while ((from = Object.getPrototypeOf(from)));
//   return to as To & From;
// }
