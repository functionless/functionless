export function assertNever(value: never): never {
  throw new Error(`reached unreachable branch with value: ${value}`);
}
