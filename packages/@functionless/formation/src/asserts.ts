export function assertIsString(
  string: any,
  argumentName: string
): asserts string is string {
  if (typeof string !== "string") {
    throw new Error(
      `The ${argumentName} must be a string, but was ${typeof string}`
    );
  }
}

export function assertIsListOfStrings(
  strings: any,
  argumentName: string
): asserts strings is string[] {
  if (
    !Array.isArray(strings) ||
    strings.find((s) => typeof s !== "string") !== undefined
  ) {
    throw new Error(
      `The ${argumentName} argument must be a list of strings, but was ${typeof strings}`
    );
  } else if (strings.length === 0) {
    throw new Error(`The ${argumentName} cannot be empty.`);
  }
}
