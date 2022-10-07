export function memoize<F extends (input?: any) => any>(f: F): F {
  let t: any | undefined;
  let set = false;
  return ((input) => {
    if (!set) {
      t = f(input);
    }
    return t!;
  }) as F;
}
