import { BinaryOp } from "../../expression";
import {
  NumericRangePattern,
  NumericRangeLimit,
  NumericAggregationPattern,
  EmptyPattern,
  isNumericAggregationPattern,
  NeverPattern,
  isNeverPattern,
  isNumericRangePattern,
} from "./pattern";

/**
 * Join two numeric ranges together to represent values in both ranges.
 * Throw an error if the range could not match a single value.
 * x > 10 && x > 5 => x > 10
 * x >= 10 && x > 9 => x >= 10
 * x > 10 && x >= 10 => x > 10
 */
export const intersectNumericRange = (
  pattern1: NumericRangePattern | NeverPattern,
  pattern2: NumericRangePattern | NeverPattern,
  allowZeroRange?: boolean
): NumericRangePattern | NeverPattern => {
  if (isNeverPattern(pattern1) || isNeverPattern(pattern2)) {
    return isNeverPattern(pattern1) ? pattern1 : pattern2;
  }
  const newLower = maxComparison(pattern1.lower, pattern2.lower);
  const newUpper = minComparison(pattern1.upper, pattern2.upper);
  // merging ranges that are conflicting 1.lower = 10, 2.upper = 5
  const newRange = { upper: newUpper, lower: newLower };
  if (!allowZeroRange && !validateNumericRange(newRange)) {
    return {
      never: true,
      reason: `Found zero range numeric range lower ${newRange.lower?.value} inclusive: ${newRange.lower?.inclusive}, upper ${newRange.upper?.value} inclusive: ${newRange.upper?.inclusive}`,
    };
  }
  return newRange;
};

/**
 * Given two limits of two ranges, return the limit that is the largest.
 *
 * The symbol of the limit doesn't matter.
 *
 * 10, 9 => 10
 * 100, 1000 => 1000
 * 100 (inclusive), 100 (exclusive) => 100 (exclusive)
 */
const maxComparison = (
  limit1: NumericRangeLimit,
  limit2: NumericRangeLimit
): NumericRangeLimit => {
  // one is strictly greater than the other
  if (limit1.value > limit2.value) return limit1;
  if (limit2.value > limit1.value) return limit2;
  // resolve conflicting inclusivity - inclusive is lower
  return {
    value: limit1.value,
    inclusive: limit1.inclusive && limit2.inclusive,
  };
};

/**
 * Given two limits of two ranges, return the limit that is the smallest.
 *
 * The symbol of the limit doesn't matter.
 *
 * 10, 9 => 9
 * 100, 1000 => 100
 * 100 (inclusive), 100 (exclusive) => 100 (inclusive)
 * 100 (exclusive), 100 (exclusive) => 100 (exclusive)
 */
const minComparison = (
  limit1: NumericRangeLimit,
  limit2: NumericRangeLimit
): NumericRangeLimit => {
  // one is strictly less than the other
  if (limit1.value < limit2.value) return limit1;
  if (limit2.value < limit1.value) return limit2;
  // resolve conflicting inclusivity - inclusive is lower
  return {
    value: limit1.value,
    inclusive: limit1.inclusive || limit2.inclusive,
  };
};

/**
 * If the ranges overlap, return the union of them.
 * If the range are mutually exclusive, return an aggregate with two ranges.
 *
 * [10, 20] [15, 30] => [10, 30]
 * [10, 20] [21, 30] => [10, 20] [21, 30]
 * [10, 20] [20, 30] => [10, 30]
 * [10, 20) (20, 30] => [10, 20) (20, 30]
 */
export const unionNumericRange = (
  pattern1: NumericRangePattern,
  pattern2: NumericRangePattern
): NumericAggregationPattern | NumericRangePattern => {
  if (isOverlappngRange(pattern1, pattern2)) {
    // merge the overlapping ranges by finding the min lower and max upper
    const minLower = minComparison(pattern1.lower, pattern2.lower);
    const maxUpper = maxComparison(pattern1.upper, pattern2.upper);

    return { lower: minLower, upper: maxUpper };
  }

  // when not overlapping, return who sets of numeric ranges
  return { ranges: [pattern1, pattern2] };
};

// [lower1, upper1]
//              [lower2, upper2]
// https://stackoverflow.com/questions/325933/determine-whether-two-date-ranges-overlap/325964#325964
// When one of the factors is exclusive in a pair, use > or <
// [lower1, upper1)
//                (lower2, upper2]
//                (lower1, upper2]
// [lower2, upper2)
export const isOverlappngRange = (
  pattern1: NumericRangePattern,
  pattern2: NumericRangePattern
) => {
  const lower1 = pattern1.lower?.value ?? Number.NEGATIVE_INFINITY;
  const lower2 = pattern2.lower?.value ?? Number.NEGATIVE_INFINITY;
  const upper1 = pattern1.upper?.value ?? Number.POSITIVE_INFINITY;
  const upper2 = pattern2.upper?.value ?? Number.POSITIVE_INFINITY;
  const firstInclusive = pattern1.lower?.inclusive && pattern2.upper?.inclusive;
  const secondInclusive =
    pattern1.upper?.inclusive && pattern2.lower?.inclusive;

  return (
    (firstInclusive ? lower1 <= upper2 : lower1 < upper2) &&
    (secondInclusive ? upper1 >= lower2 : upper1 > lower2)
  );
};

/**
 * In a valid range, the lower is before the upper.
 *
 * [10, 5] => invalid
 * [5, 10] => valid
 * [10, 10) => invalid
 * [10, 10] => valid
 */
export const validateNumericRange = (range: NumericRangePattern): boolean => {
  if (range.lower) {
    if (range.upper) {
      // when both lower and upper are given, the lower must be lower than the upper
      // when the lower and the upper are the same, the values must be inclusive, else there is zero range.
      if (range.lower.value == range.upper.value) {
        // x >= 10 && x <= 10 => valid (can be 10)
        // x >= 10 && x < 10 => invalid (zero range)
        // x > 10 && x <= 10 => invalid (zero range)
        // x > 10 && x < 10 => invalid (zero range)
        if (range.lower.inclusive && range.upper.inclusive) {
          return true;
        }
        return false;
      }
      // lower value must be less than upper value
      // x > 10 && x < 100
      return range.lower?.value < range.upper?.value;
    }
  }
  return !!range.lower || !!range.upper;
};

/**
 * Runs {@link reduceNumericRanges} and then checks to see if the outcome is
 * empty, singular, or still an aggregate.
 */
export const reduceNumericAggregate = (
  pattern: NumericAggregationPattern
): EmptyPattern | NumericRangePattern | NumericAggregationPattern => {
  const reduced = reduceNumericRanges(pattern.ranges);

  if (reduced.length === 0) {
    return { empty: true };
  } else if (reduced.length === 1) {
    return reduced[0];
  }
  return { ranges: reduced };
};

/**
 * Given one to many ranges, collapse them all to the least number of ranges when one or more overlap.
 * This operation may take multiple iterations to find all overlappting ranges.
 *
 * TODO: this can probably be simplified to a single iteration by ordering the ranges, the performance impact will be minimal.
 *
 * one or more ranges merge with multiple other ranges
 * [1, 10], [11, 20], [8, 12]
 * [1, 10], [11, 20]
 * [1, 12], [8, 20]
 * [1, 20]
 *
 * one or more ranges merge with one other range
 * [1, 10], [11, 20], [12, 21]
 * [1, 10], [11, 20]
 * [1, 10], [11, 21]
 *
 * one or more ranges merge with multiple other range early
 * [8, 12], [1, 10], [11, 20]
 * [1, 12]
 * [1, 20]
 *
 * no ranges merge
 * [1, 10], [11, 20], [21, 22]
 * [1, 10], [11, 20], [21, 22]
 */
export const reduceNumericRanges = (
  ranges: NumericRangePattern[]
): NumericRangePattern[] => {
  return ranges.reduce((newRanges, range) => {
    const [overlappingRanges, otherRanges] = newRanges.reduce(
      ([over, other], r) =>
        isOverlappngRange(range, r)
          ? [[...over, r], other]
          : [over, [...other, r]],
      [[], []] as [NumericRangePattern[], NumericRangePattern[]]
    );

    if (overlappingRanges.length === 0) {
      return [...newRanges, range];
    }

    const mergedRanges = overlappingRanges
      .map((r) => unionNumericRange(r, range))
      .reduce(
        (acc, r) => [
          ...acc,
          ...(isNumericAggregationPattern(r) ? r.ranges : [r]),
        ],
        [] as NumericRangePattern[]
      );

    const reducedRanges = reduceNumericRanges(mergedRanges);

    return [...reducedRanges, ...otherRanges];
  }, [] as NumericRangePattern[]);
};

/**
 * Invert numeric ranges!
 *
 * [10, 20] => [neg_inf, 10), (20, inf]
 * (10, 20) => [neg_inf, 10], [20, inf]
 * (10, inf] => [neg_inf, 10]
 * [neg_inf, 20] => (20, inf]
 */
export const negateNumericRange = (
  pattern: NumericRangePattern
): NumericRangePattern => ({
  lower:
    pattern.upper.value !== Number.POSITIVE_INFINITY
      ? { inclusive: !pattern.upper.inclusive, value: pattern.upper.value }
      : { value: Number.NEGATIVE_INFINITY, inclusive: true },
  upper:
    pattern.lower.value !== Number.NEGATIVE_INFINITY
      ? { inclusive: !pattern.lower.inclusive, value: pattern.lower.value }
      : { value: Number.POSITIVE_INFINITY, inclusive: true },
});

/**
 * Intersect multiple numeric ranges.
 * 1. attempt to intersect each numeric ranges.
 * 2. validate each result
 * 3. filter invalid result.
 * 4. Fail if no results are valid.
 *
 * [10, 20] AND ( [5, 15] OR [25, 30] ) => [10, 15]
 * [10, 20] AND ( [25, 30] OR [35, 40] ) => INVALID (cannot AND either range on the other side)
 * ([10, 20] OR [30, 40]) AND ( [5, 15] OR [25, 30] ) => [10,15] OR 30
 * ([10, 20] OR [30, 40]) AND ( [5, 15] OR [25, 30) ) => INVALID
 */
export const intersectNumericAggregation = (
  aggregation1: NumericAggregationPattern,
  aggregation2: NumericAggregationPattern
):
  | NumericAggregationPattern
  | NumericRangePattern
  | EmptyPattern
  | NeverPattern => {
  const joinedRanges = aggregation1.ranges.reduce((ranges, range) => {
    const joinedRanges = aggregation2.ranges
      .map((r) => intersectNumericRange(r, range, true))
      .filter(isNumericRangePattern)
      .filter(validateNumericRange);
    return [...ranges, ...joinedRanges];
  }, [] as NumericRangePattern[]);

  if (joinedRanges.length === 0) {
    return {
      never: true,
      reason: `Zero intersection numeric ranges.`,
    };
  }

  return reduceNumericAggregate({ ranges: joinedRanges });
};

/**
 * Apply intersection logic between a single range and set of aggregate ranges (OR logic).
 */
export const intersectNumericAggregationWithRange = (
  aggregation: NumericAggregationPattern,
  range: NumericRangePattern
):
  | NumericAggregationPattern
  | NumericRangePattern
  | EmptyPattern
  | NeverPattern => {
  const joinedRanges = aggregation.ranges
    .map((r) => intersectNumericRange(range, r))
    .filter(isNumericRangePattern)
    .filter(validateNumericRange);
  if (joinedRanges.length === 0) {
    return {
      never: true,
      reason: `Zero intersection numeric ranges.`,
    };
  }
  return reduceNumericAggregate({ ranges: joinedRanges });
};

/**
 * Creates a single numeric range entry with only one limit (lower or upper) set.
 */
export const createSingleNumericRange = (
  value: number,
  op: BinaryOp
): NumericRangePattern | undefined => {
  if (op === "<" || op === "<=") {
    return {
      upper: { value, inclusive: op === "<=" },
      lower: { value: Number.NEGATIVE_INFINITY, inclusive: true },
    };
  } else if (op === ">" || op === ">=") {
    return {
      lower: { value, inclusive: op === ">=" },
      upper: { value: Number.POSITIVE_INFINITY, inclusive: true },
    };
  }
  return;
};
