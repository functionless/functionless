import { assertNever } from "../../assert";
import * as functionless_event_bridge from "../types";

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
  | NumericAggregationPattern
  | NeverPattern;

/**
 * The base of an event pattern is a object with multiple fields. Additionally some fields like detail can be deep.
 */
export interface PatternDocument {
  doc: {
    [key: string]: PatternDocument | Pattern;
  };
}

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
    | NeverPattern
  )[];
}

export const isAggregatePattern = (x: Pattern): x is AggregatePattern => {
  return "patterns" in x;
};

/**
 * One or more {@link NumericRangePattern} with OR/Union logic applied.
 */
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
export interface NumericRangeLimit {
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
  lower: NumericRangeLimit;
  upper: NumericRangeLimit;
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
 * A Pattern that represents logic that is always true.
 * This pattern will be filtered out by the end of the compilation.
 * If the only pattern remaining is a EmptyPattern, the field will be removed from the pattern.
 */
export interface EmptyPattern {
  empty: true;
}

export const isEmptyPattern = (x: Pattern): x is EmptyPattern => {
  return "empty" in x;
};

/**
 * A Pattern that represents logic that is never true.
 * This pattern may be filtered out at the end.
 * It is the opposite of EmptyPattern
 * If it is applied to AND logic, either between or within a field, an error is thrown.
 *
 * When to return NeverPattern and when to Error
 * * NeverPattern - when the logic is impossible, but valid aka, contradictions x !== "a" && x === "a". These MAY later be evaluated to possible using an OR.
 * * Error - When the combination is unsupported by Event Bridge or Functionless.
 *           For example, if we do not know how to represent !x.startsWith("x") && x.startsWith("y"),
 *           then we need to fail compilation as the logic may filter a event if it was supported and not ignored.
 */
export interface NeverPattern {
  never: true;
  reason?: string;
}

export const isNeverPattern = (x: Pattern): x is NeverPattern => {
  return "never" in x;
};

export const isPositiveSingleValueRange = (pattern: NumericRangePattern) =>
  pattern.lower.value === pattern.upper.value &&
  pattern.lower.inclusive &&
  pattern.upper.inclusive;

export const isNegativeSingleValueRange = (pattern: NumericRangePattern) =>
  pattern.lower.value === pattern.upper.value &&
  !pattern.lower.inclusive &&
  !pattern.upper.inclusive;

/**
 * Transforms the proprietary {@link PatternDocuemnt} into AWS's EventPattern schema.
 * https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html
 *
 * For each field,
 *  if the field is a nested PatternDocument, recurse.
 *  if the field is a Pattern, output the pattern as a EvnetPattern.
 *
 * We will not maintain empty patterns or pattern documents.
 */
export const patternDocumentToEventPattern = (
  patternDocument: PatternDocument
): functionless_event_bridge.SubPattern => {
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
  }, {} as functionless_event_bridge.SubPattern);
};

/**
 * Transforms the proprietary {@link Pattern} into a EventBridge's {@link functionless_event_bridge.PatternList} schema.
 */
export const patternToEventBridgePattern = (
  pattern: Pattern,
  aggregate?: boolean
): functionless_event_bridge.PatternList | undefined => {
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
    /**
     * turns the structured numeric range {@link NumericRangePattern}
     * into the EventBridge format {@link functionless_event_bridge.NumberPattern}
     *
     * if the Lower or Upper are NEGATIVE_INFINITY or POSITIVE_INFIITY respectively, do not include in the range.
     * if the Lower or Upper range values are inclusive, add a `=` to the sign.
     *
     * { lower: { value: 10, inclusive: false }, upper: { value: POSITIVE_INFINITY } } =>  { numeric: [">", 10] }
     * { lower: { value: 10, inclusive: true }, upper: { value: POSITIVE_INFINITY } } =>  { numeric: [">=", 10] }
     * { lower: { value: 10, inclusive: true }, upper: { value: 100, inclusive: false } } =>  { numeric: [">=", 10, "<", 100] }
     * { lower: { value: NEGATIVE_INFINITY }, upper: { value: 100, inclusive: true } } =>  { numeric: ["<=", 100] }
     */
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
      .map((p) => patternToEventBridgePattern(p, pattern.patterns.length > 1))
      .reduce(
        (acc, pattern) => [...(acc ?? []), ...(pattern ?? [])],
        [] as functionless_event_bridge.PatternList
      );
  } else if (isNumericAggregationPattern(pattern)) {
    if (pattern.ranges.length === 0) {
      return undefined;
    }
    return pattern.ranges
      .map((x) => patternToEventBridgePattern(x, true))
      .reduce(
        (acc, pattern) => [...(acc ?? []), ...(pattern ?? [])],
        [] as functionless_event_bridge.PatternList
      );
  } else if (isNeverPattern(pattern)) {
    // if never is in an aggregate and not the lone pattern, return undefined
    // if never is the lone value, either in an aggregate or directly on a field, fail
    if (!aggregate) {
      throw Error(
        pattern.reason
          ? `Impossible logic discovered: ${pattern.reason}`
          : "Impossible logic discovered."
      );
    }
    return undefined;
  }

  assertNever(pattern);
};
