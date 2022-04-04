export function makeCallable<T, F extends (...args: any[]) => any>(
  obj: T,
  func: F
): T & F {
  return copyProperties(func, obj);
}

function copyProperties<To, From>(to: To, from: From): From & To {
  to = Object.assign(to, from);
  do {
    for (const prop of Object.getOwnPropertyNames(from)) {
      const val = (from as any)[prop];
      if (typeof val === "function") {
        (to as any)[prop] = val.bind(to);
      } else {
        (to as any)[prop] = val;
      }
    }
  } while ((from = Object.getPrototypeOf(from)));
  return to as To & From;
}
