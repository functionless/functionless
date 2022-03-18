import { BinaryOp } from "../..";
import {
  NumericRangePattern,
  NumericRangeOperand,
  NumericAggregationPattern,
  EmptyPattern,
  isNumericAggregationPattern,
} from "./pattern";

export const joinNumericRange = (
  pattern1: NumericRangePattern,
  pattern2: NumericRangePattern,
  allowZeroRange?: boolean
): NumericRangePattern => {
  // x > 10 && x > 5 => x > 10
  // x >= 10 && x > 9 => x >= 10
  // x > 10 && x >= 10 => x > 10
  const newLower = maxComparison(pattern1.lower, pattern2.lower);
  const newUpper = minComparison(pattern1.upper, pattern2.upper);
  // merging ranges that are conflicting 1.lower = 10, 2.upper = 5
  const newRange = { upper: newUpper, lower: newLower };
  if (!allowZeroRange && !validateNumericRange(newRange)) {
    throw new Error(
      `Found zero range numeric range lower ${newRange.lower?.value} inclusive: ${newRange.lower?.inclusive}, upper ${newRange.upper?.value} inclusive: ${newRange.upper?.inclusive}`
    );
  }
  return newRange;
};

const maxComparison = (
  comp1: NumericRangeOperand,
  comp2: NumericRangeOperand
): NumericRangeOperand => {
  // one is strictly greater than the other
  if (comp1.value > comp2.value) return comp1;
  if (comp2.value > comp1.value) return comp2;
  // resolve conflicting inclusivity - inclusive is lower
  return {
    value: comp1.value,
    inclusive: comp1.inclusive && comp2.inclusive,
  };
};

const minComparison = (
  comp1: NumericRangeOperand,
  comp2: NumericRangeOperand
): NumericRangeOperand => {
  // one is strictly less than the other
  if (comp1.value < comp2.value) return comp1;
  if (comp2.value < comp1.value) return comp2;
  // resolve conflicting inclusivity - inclusive is lower
  return {
    value: comp1.value,
    inclusive: comp1.inclusive || comp2.inclusive,
  };
};

/**
 * If the ranges overlap, merge them.
 * If the range are mutually exclusive, return an aggregate.
 */
export const mergeNumericOr = (
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

export const validateNumericRange = (
  range: NumericRangePattern
): boolean => {
  if (range.lower) {
    if (range.upper) {
      // when both lower and upper are given, the lower must be lower than the upper
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
      // lower vakue must be less than upper value
      // x > 10 && x < 100
      return range.lower?.value < range.upper?.value;
    }
  }
  return !!range.lower || !!range.upper;
};

export const reduceNumericAggregate = (
  classification: NumericAggregationPattern
):
  | EmptyPattern
  | NumericRangePattern
  | NumericAggregationPattern => {
  const reduced = reduceNumericRanges(classification.ranges);

  if (reduced.length === 0) {
    return { empty: true };
  } else if (reduced.length === 1) {
    return reduced[0];
  }
  return { ranges: reduced };
};

/**
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
      .map((r) => mergeNumericOr(r, range))
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

export const andNumericAggregation = (
  aggregation1: NumericAggregationPattern,
  aggregation2: NumericAggregationPattern
):
  | NumericAggregationPattern
  | NumericRangePattern
  | EmptyPattern => {
  const joinedRanges = aggregation1.ranges.reduce((ranges, range) => {
    const joinedRanges = aggregation2.ranges
      .map((r) => joinNumericRange(r, range, true))
      .filter((r) => validateNumericRange(r));
    if (joinedRanges.length === 0) {
      throw new Error(
        `At least one OR statement in a numeric range must be valid with the other side`
      );
    }
    return [...ranges, ...joinedRanges];
  }, [] as NumericRangePattern[]);

  return reduceNumericAggregate({ ranges: joinedRanges });
};

export const andNumericAggregationWithRange = (
  aggregation: NumericAggregationPattern,
  range: NumericRangePattern
):
  | NumericAggregationPattern
  | NumericRangePattern
  | EmptyPattern => {
  const joinedRanges = aggregation.ranges.map((r) =>
    joinNumericRange(range, r)
  );
  return reduceNumericAggregate({ ranges: joinedRanges });
};

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
