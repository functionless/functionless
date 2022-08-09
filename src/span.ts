/**
 * A {@link Span} is a range of text within a source file, represented
 * by two numbers, a `start` and `end` character position.
 */
export type Span = [
  /**
   * Character position where this span starts.
   */
  start: number,
  /**
   * Character position where this span ends.
   */
  end: number
];

/**
 * Determines if {@link a} is a {@link Span}.
 */
export function isSpan(a: any): a is Span {
  return (
    Array.isArray(a) &&
    a.length === 2 &&
    typeof a[0] === "number" &&
    typeof a[1] === "number"
  );
}

export function emptySpan(): Span {
  return [0, 0];
}
