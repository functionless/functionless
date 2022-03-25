import { assertNever } from "../../assert";
import * as fnls_event_bridge from "./types";

/**
 * These are simlified and better structured interfaces/types to make it easier to work with Event Bridge Patterns.
 * Use the {@link patternToEventBridgePattern} to generate a valid object for event bridge.
 *
 * All patterns are applied to a single field {@link PatternDocument}s provide AND logic on multiple fields.
 */
export type Pattern =
  | AggregatePattern
  | ExactMatchPattern
  | PrefixMatchPattern
  | NumericRangePattern
  | PresentPattern
  | AnythingButPattern
  | AnythingButPrefixPattern
  | EmptyPattern
  | NumericAggregationPattern;

/**
 * The base of an event pattern is a object with multiple fields. Additionally some fields like detail can be deep.
 */
export type PatternDocument = {
  doc: {
    [key: string]: PatternDocument | Pattern;
  };
};

export const isPatternDocument = (
  x: Pattern | PatternDocument
): x is PatternDocument => {
  return "doc" in x;
};

/**
 * One or more patterns with OR logic between them on a single field.
 */
export interface AggregatePattern {
  patterns: (
    | ExactMatchPattern
    | PrefixMatchPattern
    | PresentPattern
    | AnythingButPattern
    | AnythingButPrefixPattern
  )[];
}

export const isAggregatePattern = (x: Pattern): x is AggregatePattern => {
  return "patterns" in x;
};

export interface NumericAggregationPattern {
  ranges: NumericRangePattern[];
}

export const isNumericAggregationPattern = (
  x: Pattern
): x is NumericAggregationPattern => {
  return "ranges" in x;
};

/**
 * Equals logic for a string, boolean, or null.
 * Number is handled using {@link NumericRangePattern} and normalized later.
 */
export interface ExactMatchPattern {
  // use NumericRange to represent a number
  value: string | boolean | null;
}

export const isExactMatchPattern = (x: Pattern): x is ExactMatchPattern => {
  return "value" in x;
};

/**
 * Starts With logic for strings.
 */
export interface PrefixMatchPattern {
  prefix: string;
}

export const isPrefixMatchPattern = (x: Pattern): x is PrefixMatchPattern => {
  return "prefix" in x;
};

/**
 * The lower or upper end of a numeric range.
 * Use {@link Number.POSITIVE_INFINITY} or {@link Number.NEGATIVE_INFINITY} to represent no LOWER or UPPER value.
 */
export interface NumericRangeOperand {
  value: number;
  inclusive: boolean;
}

/**
 * A range of values from a posible {@link Number.NEGATIVE_INFINITY} to {@link Number.POSITIVE_INFINITY}.
 *
 * Use a Upper and Lower bound of a single value to represent a single value.
 * Exclusive on upper and lower represents a NOT on the value.
 *
 * Generally represents the AND logic of a numeric range.
 */
export interface NumericRangePattern {
  lower: NumericRangeOperand;
  upper: NumericRangeOperand;
}

export const isNumericRangePattern = (x: Pattern): x is NumericRangePattern => {
  return "lower" in x || "upper" in x;
};

/**
 * Exists or `field in` logic on an object in Event Bridge
 */
export interface PresentPattern {
  isPresent: boolean;
}

export const isPresentPattern = (x: Pattern): x is PresentPattern => {
  return "isPresent" in x;
};

/**
 * NOT logic for string and null.
 *
 * Use {@link NumericRangePattern} to represent NOT logic for numbers.
 */
export type AnythingButPattern = {
  // use NumericRange to represent a number
  anythingBut: (string | null)[];
};

export const isAnythingButPattern = (x: any): x is AnythingButPattern => {
  return "anythingBut" in x;
};

/**
 * NOT logic for string and null.
 *
 * Use {@link NumericRangePattern} to represent NOT logic for numbers.
 */
export type AnythingButPrefixPattern = {
  // use NumericRange to represent a number
  anythingButPrefix: string;
};

export const isAnythingButPrefixPattern = (
  x: any
): x is AnythingButPrefixPattern => {
  return "anythingButPrefix" in x;
};

/**
 * A Pattern that represents no logic.
 * This pattern will be filtered out by the end of the compilation.
 * If the only pattern remaining is a EmptyPattern, the field will be removed from the pattern.
 */
export interface EmptyPattern {
  empty: true;
}

export const isEmptyPattern = (x: Pattern): x is EmptyPattern => {
  return "empty" in x;
};

export const isPositiveSingleValueRange = (pattern: NumericRangePattern) =>
  pattern.lower.value === pattern.upper.value &&
  pattern.lower.inclusive &&
  pattern.upper.inclusive;

export const isNegativeSingleValueRange = (pattern: NumericRangePattern) =>
  pattern.lower.value === pattern.upper.value &&
  !pattern.lower.inclusive &&
  !pattern.upper.inclusive;

export const patternDocumentToEventPattern = (
  patternDocument: PatternDocument
): fnls_event_bridge.SubPattern => {
  return Object.entries(patternDocument.doc).reduce((pattern, [key, entry]) => {
    const keyPattern = isPatternDocument(entry)
      ? patternDocumentToEventPattern(entry)
      : patternToEventBridgePattern(entry);
    if (!keyPattern || Object.keys(keyPattern).length === 0) {
      return pattern;
    }
    return {
      ...pattern,
      [key]: keyPattern,
    };
  }, {} as fnls_event_bridge.SubPattern);
};

export const patternToEventBridgePattern = (
  pattern: Pattern
): fnls_event_bridge.PatternList | undefined => {
  if (isEmptyPattern(pattern)) {
    return undefined;
  } else if (isExactMatchPattern(pattern)) {
    return [pattern.value];
  } else if (isPresentPattern(pattern)) {
    return [{ exists: pattern.isPresent }];
  } else if (isPrefixMatchPattern(pattern)) {
    return [{ prefix: pattern.prefix }];
  } else if (isAnythingButPattern(pattern)) {
    return Array.isArray(pattern.anythingBut) &&
      pattern.anythingBut.length === 1
      ? [{ "anything-but": pattern.anythingBut[0] }]
      : [
          {
            "anything-but": pattern.anythingBut,
          },
        ];
  } else if (isAnythingButPrefixPattern(pattern)) {
    return [{ "anything-but": { prefix: pattern.anythingButPrefix } }];
  } else if (isNumericRangePattern(pattern)) {
    if (
      pattern.lower.value === Number.NEGATIVE_INFINITY &&
      pattern.upper.value === Number.POSITIVE_INFINITY
    ) {
      return undefined;
    }
    if (isPositiveSingleValueRange(pattern)) {
      return [pattern.lower.value];
    } else if (isNegativeSingleValueRange(pattern)) {
      return [{ "anything-but": pattern.lower.value }];
    }
    return [
      {
        numeric: [
          ...(pattern.lower.value !== Number.NEGATIVE_INFINITY
            ? [pattern.lower.inclusive ? ">=" : ">", pattern.lower.value]
            : []),
          ...(pattern.upper.value !== Number.POSITIVE_INFINITY
            ? [pattern.upper.inclusive ? "<=" : "<", pattern.upper.value]
            : []),
        ] as [string, number, string, number] | [string, number],
      },
    ];
  } else if (isAggregatePattern(pattern)) {
    if (pattern.patterns.length === 0) {
      return undefined;
    }
    return pattern.patterns
      .map(patternToEventBridgePattern)
      .reduce(
        (acc, pattern) => [...(acc ?? []), ...(pattern ?? [])],
        [] as fnls_event_bridge.PatternList
      );
  } else if (isNumericAggregationPattern(pattern)) {
    if (pattern.ranges.length === 0) {
      return undefined;
    }
    return pattern.ranges
      .map(patternToEventBridgePattern)
      .reduce(
        (acc, pattern) => [...(acc ?? []), ...(pattern ?? [])],
        [] as fnls_event_bridge.PatternList
      );
  }

  assertNever(pattern);
};
