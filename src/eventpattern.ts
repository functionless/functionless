import { aws_events } from "aws-cdk-lib";
import {
  BinaryExpr,
  CallExpr,
  ElementAccessExpr,
  Expr,
  FunctionDecl,
  PropAccessExpr,
  UnaryExpr,
} from ".";
import {
  assertDefined,
  assertNever,
  assertNumber,
  assertString,
} from "./assert";
import { Stmt } from "./statement";

/**
 * https://github.com/sam-goodwin/functionless/issues/37#issuecomment-1066313146
 */
export const synthesizeEventPattern = (
  predicate: FunctionDecl
): FnLsEventPattern => {
  const eventDecl = predicate.parameters[0];

  const handleExpr = (expr: Expr): ClassDocument => {
    if (expr.kind === "BinaryExpr") {
      return handleBinary(expr);
    } else if (expr.kind === "PropAccessExpr") {
      return handlePropAccess(expr);
    } else if (expr.kind === "UnaryExpr") {
      return handleUnaryExpression(expr);
    } else if (expr.kind === "CallExpr") {
      return handleCall(expr);
    } else {
      throw new Error(`${expr.kind} is unsupported`);
    }
    // assertNever(expr);
  };

  const handleSmnt = (stmt: Stmt): ClassDocument => {
    if (stmt.kind === "ReturnStmt") {
      return handleExpr(stmt.expr);
    } else {
      throw new Error(`Unsupported statement ${stmt.kind}`);
    }
  };

  const handleBinary = (expr: BinaryExpr): ClassDocument => {
    if (expr.op === "==") {
      return handleEquals(expr);
    } else if (expr.op === "!=") {
      return handleNotEquals(expr);
    } else if ([">", ">=", "<", "<="].includes(expr.op)) {
      return handleNumericRange(expr);
    } else if (expr.op === "in") {
      return handleInOperation(expr);
    } else if (expr.op === "&&") {
      return handleAnd(expr);
    } else if (expr.op === "||") {
      return handleOr(expr);
    } else {
      throw new Error(`Unsupported binary operator ${expr.op}`);
    }
  };

  const handleAnd = (expr: BinaryExpr): ClassDocument => {
    const left = handleExpr(expr.left);
    const right = handleExpr(expr.right);

    return andDocuments(left, right);
  };

  const andDocuments = (
    classDocument1: ClassDocument,
    classDocument2: ClassDocument
  ): ClassDocument => {
    const allKeys = [
      ...new Set([
        ...Object.keys(classDocument1.doc),
        ...Object.keys(classDocument2.doc),
      ]),
    ];

    return allKeys.reduce((doc, key) => {
      // if key is only in one document, return it
      const pattern = !(key in classDocument1.doc)
        ? classDocument2.doc?.[key]
        : !(key in classDocument2.doc)
        ? classDocument1.doc?.[key]
        : undefined;
      // if the key is in both documents, try to merge them
      const mergedPattern =
        pattern ??
        andMergePattern(key, classDocument1.doc[key], classDocument2.doc[key]);
      return {
        doc: {
          ...doc.doc,
          [key]: mergedPattern,
        },
      };
    }, {} as ClassDocument);
  };

  const andMergePattern = (
    key: string,
    pattern1: ClassDocument | PatternClassification,
    pattern2: ClassDocument | PatternClassification
  ): ClassDocument | PatternClassification => {
    // both are documents, lets merge the documents
    if (isClassDocument(pattern1) && isClassDocument(pattern2)) {
      return andDocuments(pattern1, pattern2);
      // both are patterns, merge the patterns
    } else if (!isClassDocument(pattern1) && !isClassDocument(pattern2)) {
      if (isNumericAggregationClassification(pattern1)) {
        if (isNumericAggregationClassification(pattern2)) {
          const joinedRanges = pattern1.ranges.reduce((ranges, range) => {
            const joinedRanges = pattern2.ranges
              .map((r) => joinNumericRange(r, range, true))
              .filter((r) => validateNumericRange(r));
            if (joinedRanges.length === 0) {
              throw new Error(
                `At least one OR statement in a numeric range must be valid with the other side`
              );
            }
            return [...ranges, ...joinedRanges];
          }, [] as NumericRangeClassficiation[]);

          return reduceNumericAggregate({ ranges: joinedRanges });
        }
        if (isNumericRangeClassficiation(pattern2)) {
          const joinedRanges = pattern1.ranges.map((r) =>
            joinNumericRange(pattern2, r)
          );
          return reduceNumericAggregate({ ranges: joinedRanges });
        }
      }
      if (isNumericAggregationClassification(pattern2)) {
        if (isNumericRangeClassficiation(pattern1)) {
          const joinedRanges = pattern2.ranges.map((r) =>
            joinNumericRange(pattern1, r)
          );
          return reduceNumericAggregate({ ranges: joinedRanges });
        }
      }
      if (
        isNumericRangeClassficiation(pattern1) &&
        isNumericRangeClassficiation(pattern2)
      ) {
        return joinNumericRange(pattern1, pattern2);
      }
      // TODO: expand the supported cases
      throw new Error(
        `Cannot apply AND to patterns ${JSON.stringify(
          pattern1
        )} and ${JSON.stringify(pattern2)}`
      );
    }
    // we don't know how to do this (yet?)
    throw new Error(`Patterns of key ${key} defined at different levels.`);
  };

  const joinNumericRange = (
    pattern1: NumericRangeClassficiation,
    pattern2: NumericRangeClassficiation,
    allowZeroRange?: boolean
  ): NumericRangeClassficiation => {
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

  const handleOr = (expr: BinaryExpr): ClassDocument => {
    const left = handleExpr(expr.left);
    const right = handleExpr(expr.right);

    return orDocuments(left, right);
  };

  /**
   * Event bridge does not support OR across fields, only AND logic
   * If applying OR and there are already multiple fields on either side of the or the field on either side are different, fail
   */
  const orDocuments = (
    classDocument1: ClassDocument,
    classDocument2: ClassDocument
  ): ClassDocument => {
    const doc1Keys = Object.keys(classDocument1.doc);
    const doc2Keys = Object.keys(classDocument2.doc);
    if (doc1Keys.length > 1 || doc2Keys.length > 1) {
      throw Error(
        `Event bridge does not support OR logic between multiple fields, found ${doc1Keys.join(
          ","
        )} and ${doc2Keys.join(",")}.`
      );
    }
    if (doc1Keys.length === 0) {
      return classDocument2;
    }
    if (doc2Keys.length === 0) {
      return classDocument1;
    }
    if (doc1Keys[0] !== doc2Keys[0]) {
      throw Error(
        `Event bridge does not support OR logic between multiple fields, found ${doc1Keys[0]} and ${doc2Keys[0]}.`
      );
    }
    const key = doc1Keys[0];

    return {
      doc: {
        [key]: orMergePattern(
          key,
          classDocument1.doc[key],
          classDocument2.doc[key]
        ),
      },
    };
  };

  /**
   * See table: https://github.com/sam-goodwin/functionless/issues/37#issuecomment-1066313146
   */
  const orMergePattern = (
    key: string,
    pattern1: ClassDocument | PatternClassification,
    pattern2: ClassDocument | PatternClassification
  ): ClassDocument | PatternClassification => {
    // both are documents, lets merge the documents
    if (isClassDocument(pattern1) && isClassDocument(pattern2)) {
      return orDocuments(pattern1, pattern2);
      // both are patterns, merge the patterns
    } else if (!isClassDocument(pattern1) && !isClassDocument(pattern2)) {
      if (isPresentClassification(pattern1)) {
        if (isPresentClassification(pattern2)) {
          // when the logic is "name" in event.detail || !("name" in event.detail), simplify to empty logic
          if (pattern1.isPresent != pattern2.isPresent) {
            return <EmptyClassification>{ empty: true };
          }
          // if both are exists: true or exists: false
          return pattern1;
        }
        // If one of the classifications are exists: true, return exists: true
        if (pattern1.isPresent) {
          return pattern1;
        }
      }
      if (isPresentClassification(pattern2)) {
        // If one of the classifications are exists: true, return exists: true
        if (pattern2.isPresent) {
          return pattern1;
        }
      }
      if (isNumericAggregationClassification(pattern1)) {
        if (isNumericAggregationClassification(pattern2)) {
          return reduceNumericAggregate({
            ranges: [...pattern1.ranges, ...pattern2.ranges],
          });
        }
        if (isNumericRangeClassficiation(pattern2)) {
          return reduceNumericAggregate({
            ranges: [...pattern1.ranges, pattern2],
          });
        }
      }
      if (isNumericAggregationClassification(pattern2)) {
        if (isNumericRangeClassficiation(pattern1)) {
          return reduceNumericAggregate({
            ranges: [...pattern2.ranges, pattern1],
          });
        }
      }
      if (isNumericRangeClassficiation(pattern1)) {
        if (isNumericRangeClassficiation(pattern2)) {
          return mergeNumericOr(pattern1, pattern2);
        }
      }
      return <AggregateClassification>{
        classifications: [pattern1, pattern2],
      };
    }
    // we don't know how to do this (yet?)
    throw new Error(`Patterns of key ${key} defined at different levels.`);
  };

  /**
   * If the ranges overlap, merge them.
   * If the range are mutually exclusive, return an aggregate.
   */
  const mergeNumericOr = (
    pattern1: NumericRangeClassficiation,
    pattern2: NumericRangeClassficiation
  ): NumericAggregationClassification | NumericRangeClassficiation => {
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
  const isOverlappngRange = (
    pattern1: NumericRangeClassficiation,
    pattern2: NumericRangeClassficiation
  ) => {
    const lower1 = pattern1.lower?.value ?? Number.NEGATIVE_INFINITY;
    const lower2 = pattern2.lower?.value ?? Number.NEGATIVE_INFINITY;
    const upper1 = pattern1.upper?.value ?? Number.POSITIVE_INFINITY;
    const upper2 = pattern2.upper?.value ?? Number.POSITIVE_INFINITY;
    const firstInclusive =
      pattern1.lower?.inclusive && pattern2.upper?.inclusive;
    const secondInclusive =
      pattern1.upper?.inclusive && pattern2.lower?.inclusive;

    return (
      (firstInclusive ? lower1 <= upper2 : lower1 < upper2) &&
      (secondInclusive ? upper1 >= lower2 : upper1 > lower2)
    );
  };

  const validateNumericRange = (range: NumericRangeClassficiation): boolean => {
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

  const handleNumericRange = (expr: BinaryExpr): ClassDocument => {
    const { eventReference, eventExpr, other, op } = assertOneEventReference(
      expr.left,
      expr.right,
      expr.op
    );

    if (eventExpr.type !== "number") {
      throw new Error(
        "Numeric range only supported for event properties of type number"
      );
    }

    const value = assertNumber(getConstant(other)?.value);

    assertValidEventRefererence(eventReference);
    if (op === "<" || op === "<=") {
      return eventReferenceToPattern(eventReference, {
        upper: { value, inclusive: op === "<=" },
        lower: { value: Number.NEGATIVE_INFINITY, inclusive: true },
      });
    } else if (op === ">" || op === ">=") {
      return eventReferenceToPattern(eventReference, {
        lower: { value, inclusive: op === ">=" },
        upper: { value: Number.POSITIVE_INFINITY, inclusive: true },
      });
    }

    throw Error(`Unsupported numeric range operation: ${op}.`);
  };

  const reduceNumericAggregate = (
    classification: NumericAggregationClassification
  ):
    | EmptyClassification
    | NumericRangeClassficiation
    | NumericAggregationClassification => {
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
  const reduceNumericRanges = (
    ranges: NumericRangeClassficiation[]
  ): NumericRangeClassficiation[] => {
    return ranges.reduce((newRanges, range) => {
      const [overlappingRanges, otherRanges] = newRanges.reduce(
        ([over, other], r) =>
          isOverlappngRange(range, r)
            ? [[...over, r], other]
            : [over, [...other, r]],
        [[], []] as [NumericRangeClassficiation[], NumericRangeClassficiation[]]
      );

      if (overlappingRanges.length === 0) {
        return [...newRanges, range];
      }

      const mergedRanges = overlappingRanges
        .map((r) => mergeNumericOr(r, range))
        .reduce(
          (acc, r) => [
            ...acc,
            ...(isNumericAggregationClassification(r) ? r.ranges : [r]),
          ],
          [] as NumericRangeClassficiation[]
        );

      const reducedRanges = reduceNumericRanges(mergedRanges);

      return [...reducedRanges, ...otherRanges];
    }, [] as NumericRangeClassficiation[]);
  };

  const handleCall = (expr: CallExpr): ClassDocument => {
    if (
      // the expr of the call
      expr.expr.kind === "PropAccessExpr" ||
      expr.expr.kind === "ElementAccessExpr"
    ) {
      const operation = getPropertyAccessKey(expr.expr);

      if (operation === "includes") {
        const searchElement = getConstant(expr.args["searchElement"])?.value;

        if (
          Object.values(expr.args).filter((e) => e.kind !== "NullLiteralExpr")
            .length > 1
        ) {
          throw new Error("Includes only supports the searchElement argument");
        }

        // the property the call is on
        const eventReference = getEventReference(expr.expr.expr);

        if (!eventReference) {
          throw new Error(
            "Includes operation must be on a property of the event."
          );
        }

        if (
          expr.expr.expr.kind === "PropAccessExpr" ||
          expr.expr.expr.kind === "ElementAccessExpr"
        ) {
          if (expr.expr.expr.type === "number[]") {
            const num = assertNumber(searchElement);
            assertValidEventRefererence(eventReference);
            return eventReferenceToPattern(eventReference, {
              lower: { value: num, inclusive: true },
              upper: { value: num, inclusive: true },
            });
          }
          if (
            expr.expr.expr.type === "string[]" ||
            expr.expr.expr.type === "boolean[]"
          ) {
            if (
              typeof searchElement !== "string" &&
              typeof searchElement !== "boolean"
            ) {
              throw Error(
                "Includes operation only supports string or booleans."
              );
            }

            assertValidEventRefererence(eventReference);
            return eventReferenceToPattern(eventReference, {
              value: searchElement,
            });
          }

          // TODO: support for strings
          throw new Error(
            `Includes operation only supported on Arrays, found ${expr.expr.expr.type}.`
          );
        }
      } else if (operation === "startsWith") {
        const searchString = assertString(
          getConstant(expr.args["searchString"])?.value
        );

        if (
          Object.values(expr.args).filter((e) => e.kind !== "NullLiteralExpr")
            .length > 1
        ) {
          throw new Error("Includes only supports the searchString argument");
        }

        // the property the call is on
        const eventReference = getEventReference(expr.expr.expr);

        if (!eventReference) {
          throw new Error(
            "StartsWith operation must be on a property of the event."
          );
        }

        if (
          expr.expr.expr.kind === "PropAccessExpr" ||
          expr.expr.expr.kind === "ElementAccessExpr"
        ) {
          if (expr.expr.expr.type === "string") {
            assertValidEventRefererence(eventReference);
            return eventReferenceToPattern(eventReference, {
              prefix: searchString,
            });
          }

          // TODO: support for strings
          throw new Error(
            `Includes operation only supported on Arrays, found ${expr.expr.expr.type}.`
          );
        }
      }

      throw new Error(`Unsupported operation ${operation}`);
    }

    throw new Error("Operations only supported on properties of the event.");
  };

  const handleUnaryExpression = (expr: UnaryExpr): ClassDocument => {
    const sub = handleExpr(expr.expr);

    // TODO: Support negating more complex documents
    if (expr.op === "!") {
      return negateDocument(sub);
    }

    throw new Error(`Unsupported unary expression ${expr.op}`);
  };

  // TODO: validate that the right side is an object, though the compiler should take care of most cases
  const handleInOperation = (expr: BinaryExpr): ClassDocument => {
    const eventReference = getEventReference(expr.right);

    const value = assertString(getConstant(expr.left)?.value);

    if (!eventReference) {
      throw new Error(
        "Expected the right side of an in operator to be a event reference."
      );
    }

    const upadteEventReference = [...eventReference, value];

    assertValidEventRefererence(upadteEventReference);

    return eventReferenceToPattern(upadteEventReference, { isPresent: true });
  };

  /**
   * { isPresent: true } => { isPresent: false }
   * { value: true } => { value: false }
   * { value "a" } => { "anything-but": "a" }
   * Do not support
   *   * documents with more than one field in in - do not support OR accross multiple fields, inverting multiple AND fields is OR
   *   * aggregate classifications (OR logic) - do not support AND within a field, inverting OR statements becomes AND
   */
  const negateDocument = (classDocument: ClassDocument): ClassDocument => {
    if (Object.keys(classDocument).length > 1) {
      throw Error(
        "Can only negate simple statements like equals, doesn't equals, and prefix."
      );
    }
    const [key = undefined] = Object.keys(classDocument.doc);
    if (!key) {
      return { doc: {} };
    }

    const entry = classDocument.doc[key];

    return {
      doc: {
        [key]: isClassDocument(entry)
          ? negateDocument(entry)
          : negateClassification(entry),
      },
    };
  };

  const negateClassification = (
    pattern: PatternClassification
  ): PatternClassification => {
    if (isAggregateClassification(pattern)) {
      throw Error("Can only negate simple statments like boolean and equals.");
    } else if (isAnythingButClassification(pattern)) {
      return pattern.anythingBut === null
        ? { null: true }
        : typeof pattern.anythingBut === "string" && pattern.isPrefix
        ? { prefix: pattern.anythingBut }
        : { value: pattern.anythingBut };
    } else if (isExactMatchClassficiation(pattern)) {
      return typeof pattern.value === "boolean"
        ? { value: !pattern.value }
        : { anythingBut: pattern.value };
    } else if (isPresentClassification(pattern)) {
      return { isPresent: !pattern.isPresent };
    } else if (isPrefixMatchClassficiation(pattern)) {
      return { anythingBut: pattern.prefix, isPrefix: true };
    } else if (isEmptyClassification(pattern)) {
      return pattern;
    } else if (isNullMatchClassification(pattern)) {
      return { anythingBut: null };
    } else if (isNumericRangeClassficiation(pattern)) {
      return negateNumericRange(pattern);
    } else if (isNumericAggregationClassification(pattern)) {
      if (pattern.ranges.length === 0) {
        return { empty: true };
      }
      // numeric range aggregations are ORs, when we negate an OR, we need to flip each range and turn it into an AND
      return pattern.ranges
        .map((r) => negateNumericRange(r))
        .reduce((joined, range) => joinNumericRange(joined, range));
    }

    assertNever(pattern);
  };

  const negateNumericRange = (
    pattern: NumericRangeClassficiation
  ): NumericRangeClassficiation => ({
    lower:
      pattern.upper.value !== Number.POSITIVE_INFINITY
        ? { inclusive: !pattern.upper.inclusive, value: pattern.upper.value }
        : { value: Number.NEGATIVE_INFINITY, inclusive: true },
    upper:
      pattern.lower.value !== Number.NEGATIVE_INFINITY
        ? { inclusive: !pattern.lower.inclusive, value: pattern.lower.value }
        : { value: Number.POSITIVE_INFINITY, inclusive: true },
  });

  /*
   * event.detail.bool
   * event.detail.string
   */
  const handlePropAccess = (expr: PropAccessExpr): ClassDocument => {
    const eventReference = getEventReference(expr);

    if (!eventReference) {
      throw Error("Expected lone property reference to reference the event.");
    }

    assertValidEventRefererence(eventReference);

    if (expr.type === "boolean") {
      return eventReferenceToPattern(eventReference, { value: true });
    } else {
      // for all other fields, assert they are simply present
      return eventReferenceToPattern(eventReference, { isPresent: true });
    }
  };

  /**
   * event.x === "a"
   * event.x === 1
   * event.x === true
   * event.x === undefined => exists: false
   * event.x === null => null: true
   */
  const handleEquals = (expr: BinaryExpr): ClassDocument => {
    const { eventReference, other } = assertOneEventReference(
      expr.left,
      expr.right,
      expr.op
    );

    const { value } = assertDefined(
      getConstant(other),
      "Equivency must compare to a constant value."
    );

    if (typeof value === "undefined") {
      return eventReferenceToPattern(eventReference, <PresentClassification>{
        isPresent: false,
      });
    } else if (value === null) {
      return eventReferenceToPattern(eventReference, { null: true });
      // represent a single numeric value using a range to simplify range computation
      // [x, x]
    } else if (typeof value === "number") {
      return eventReferenceToPattern(eventReference, {
        lower: { value, inclusive: true },
        upper: { value, inclusive: true },
      });
    } else if (typeof value === "string" || typeof value === "boolean") {
      return eventReferenceToPattern(eventReference, { value });
    } else if (value === null) {
      return eventReferenceToPattern(eventReference, { null: true });
    }
    throw new Error(
      `Unsupported equivelency: ${eventReference.join(",")} ${value}`
    );
  };

  const handleNotEquals = (expr: BinaryExpr): ClassDocument => {
    return negateDocument(handleEquals(expr));
  };

  const assertOneEventReference = (
    left: Expr,
    right: Expr,
    op: BinaryExpr["op"]
  ): {
    eventReference: EventReference;
    eventExpr: PropAccessExpr | ElementAccessExpr;
    other: Expr;
    op: string;
  } => {
    const leftExpr = getEventReference(left);
    const rightExpr = getEventReference(right);
    if (Array.isArray(leftExpr) && Array.isArray(rightExpr)) {
      throw new Error("Expected exactly one event reference, got two.");
    } else if (Array.isArray(leftExpr)) {
      assertValidEventRefererence(leftExpr);
      return {
        eventReference: leftExpr,
        eventExpr: left as PropAccessExpr | ElementAccessExpr,
        other: right,
        op,
      };
    } else if (Array.isArray(rightExpr)) {
      assertValidEventRefererence(rightExpr);
      return {
        eventReference: rightExpr,
        eventExpr: right as PropAccessExpr | ElementAccessExpr,
        other: left,
        op: invertBinaryOperator(op),
      };
    }
    throw new Error("Expected exactly one event reference, got zero.");
  };

  const eventReferenceToPattern = (
    eventReference: [string, ...string[]],
    classification: PatternClassification
  ): ClassDocument => {
    const [head, ...tail] = eventReference;
    if (tail.length < 1) {
      return {
        doc: {
          [head]: classification,
        },
      };
    }
    return {
      doc: {
        [head]: eventReferenceToPattern(
          tail as [string, ...string[]],
          classification
        ),
      },
    };
  };

  const invertBinaryOperator = (op: BinaryExpr["op"]): string => {
    switch (op) {
      case "<":
        return ">";
      case "<=":
        return ">=";
      case ">":
        return "<";
      case ">=":
        return "<=";
      default:
        return op;
    }
  };

  const getEventReference = (expression: Expr): string[] | undefined => {
    if (expression.kind === "Identifier") {
      if (expression.name === eventDecl.name) {
        return [];
      }
      // TODO: support references
      throw Error(
        `All identifiers must point to the event parameter, found: ${expression.name}`
      );
    } else if (
      expression.kind === "PropAccessExpr" ||
      expression.kind === "ElementAccessExpr"
    ) {
      const key = getPropertyAccessKey(expression);
      const parent = getEventReference(expression.expr);
      if (parent) {
        return [...parent, key];
      }
      return undefined;
    }
    return undefined;
  };

  const getPropertyAccessKey = (
    expr: PropAccessExpr | ElementAccessExpr
  ): string => {
    return expr.kind === "PropAccessExpr"
      ? expr.name
      : assertString(getConstant(expr.element)?.value);
  };

  const getConstant = (
    expr: Expr
  ): { value: string | number | boolean | undefined | null } | undefined => {
    if (
      expr.kind === "StringLiteralExpr" ||
      expr.kind === "NumberLiteralExpr" ||
      expr.kind === "BooleanLiteralExpr"
    ) {
      return { value: expr.value };
    }
    // TODO: support null and undefined as separate values;
    else if (expr.kind === "NullLiteralExpr") {
      return { value: expr.undefined ? undefined : null };
    } else if (expr.kind === "UnaryExpr" && expr.op === "-") {
      const number = assertNumber(getConstant(expr.expr)?.value);
      return { value: -number };
    }
    return undefined;
  };

  // find the return, we'll the resolve the rest as needed.
  const [ret] = predicate.body.statements.filter(
    (expr) => expr.kind === "ReturnStmt"
  );

  if (!ret) {
    throw new Error("Missing return statement in predicate block.");
  }

  const result = handleSmnt(ret);

  return classDocumentToEventPattern(result);
};

interface AggregateClassification {
  classifications: (
    | ExactMatchClassficiation
    | PrefixMatchClassficiation
    | PresentClassification
    | NullMatchClassification
    | AnythingButClassification
  )[];
}

export const isAggregateClassification = (
  x: PatternClassification
): x is AggregateClassification => {
  return "classifications" in x;
};

interface NumericAggregationClassification {
  ranges: NumericRangeClassficiation[];
}

export const isNumericAggregationClassification = (
  x: PatternClassification
): x is NumericAggregationClassification => {
  return "ranges" in x;
};

export interface ExactMatchClassficiation {
  // use NumericRange to represent a number
  value: string | boolean;
}

export const isExactMatchClassficiation = (
  x: PatternClassification
): x is ExactMatchClassficiation => {
  return "value" in x;
};

export interface NullMatchClassification {
  null: true;
}

export const isNullMatchClassification = (
  x: PatternClassification
): x is NullMatchClassification => {
  return "null" in x;
};

interface PrefixMatchClassficiation {
  prefix: string;
}

export const isPrefixMatchClassficiation = (
  x: PatternClassification
): x is PrefixMatchClassficiation => {
  return "prefix" in x;
};

interface NumericRangeOperand {
  value: number;
  inclusive: boolean;
}

interface NumericRangeClassficiation {
  lower: NumericRangeOperand;
  upper: NumericRangeOperand;
}

export const isNumericRangeClassficiation = (
  x: PatternClassification
): x is NumericRangeClassficiation => {
  return "lower" in x || "upper" in x;
};

interface PresentClassification {
  isPresent: boolean;
}

export const isPresentClassification = (
  x: PatternClassification
): x is PresentClassification => {
  return "isPresent" in x;
};

type AnythingButClassification = {
  // use NumericRange to represent a number
  anythingBut: string | null;
  isPrefix?: boolean;
};

export const isAnythingButClassification = (
  x: any
): x is AnythingButClassification => {
  return "anythingBut" in x;
};

interface EmptyClassification {
  empty: true;
}

export const isEmptyClassification = (
  x: PatternClassification
): x is EmptyClassification => {
  return "empty" in x;
};

// TODO: the naming here is stupid, fix it..
type PatternClassification =
  | AggregateClassification
  | ExactMatchClassficiation
  | PrefixMatchClassficiation
  | NumericRangeClassficiation
  | PresentClassification
  | NullMatchClassification
  | AnythingButClassification
  | EmptyClassification
  | NumericAggregationClassification;

const isPositiveSingleValueRange = (
  classification: NumericRangeClassficiation
) =>
  classification.lower.value === classification.upper.value &&
  classification.lower.inclusive &&
  classification.upper.inclusive;

const isNegativeSingleValueRange = (
  classification: NumericRangeClassficiation
) =>
  classification.lower.value === classification.upper.value &&
  !classification.lower.inclusive &&
  !classification.upper.inclusive;

const classDocumentToEventPattern = (
  classDocument: ClassDocument
): SubPattern => {
  return Object.entries(classDocument.doc).reduce((pattern, [key, entry]) => {
    const keyPattern = isClassDocument(entry)
      ? classDocumentToEventPattern(entry)
      : classificationToPattern(entry);
    if (!keyPattern) {
      return pattern;
    }
    return {
      ...pattern,
      [key]: keyPattern,
    };
  }, {});
};

const classificationToPattern = (
  classification: PatternClassification
): PatternList | undefined => {
  if (isEmptyClassification(classification)) {
    return undefined;
  } else if (isExactMatchClassficiation(classification)) {
    return [classification.value];
  } else if (isNullMatchClassification(classification)) {
    return [null];
  } else if (isPresentClassification(classification)) {
    return [{ exists: classification.isPresent }];
  } else if (isPrefixMatchClassficiation(classification)) {
    return [{ prefix: classification.prefix }];
  } else if (isAnythingButClassification(classification)) {
    return [
      {
        "anything-but":
          typeof classification.anythingBut === "string" &&
          classification.isPrefix
            ? { prefix: classification.anythingBut }
            : classification.anythingBut,
      },
    ];
  } else if (isNumericRangeClassficiation(classification)) {
    if (!classification.lower && !classification.upper) {
      return undefined;
    }
    if (isPositiveSingleValueRange(classification)) {
      return [classification.lower.value];
    } else if (isNegativeSingleValueRange(classification)) {
      return [{ "anything-but": classification.lower.value }];
    }
    if (
      classification.lower.value === Number.NEGATIVE_INFINITY &&
      classification.upper.value === Number.POSITIVE_INFINITY
    ) {
      return undefined;
    }
    return [
      {
        number: [
          ...(classification.lower.value !== Number.NEGATIVE_INFINITY
            ? [
                classification.lower.inclusive ? ">=" : ">",
                classification.lower.value,
              ]
            : []),
          ...(classification.upper.value !== Number.POSITIVE_INFINITY
            ? [
                classification.upper.inclusive ? "<=" : "<",
                classification.upper.value,
              ]
            : []),
        ] as [string, number, string, number] | [string, number],
      },
    ];
  } else if (isAggregateClassification(classification)) {
    if (classification.classifications.length === 0) {
      return undefined;
    }
    return classification.classifications
      .map(classificationToPattern)
      .reduce(
        (acc, pattern) => [...(acc ?? []), ...(pattern ?? [])],
        [] as PatternList
      );
  } else if (isNumericAggregationClassification(classification)) {
    if (classification.ranges.length === 0) {
      return undefined;
    }
    return classification.ranges
      .map(classificationToPattern)
      .reduce(
        (acc, pattern) => [...(acc ?? []), ...(pattern ?? [])],
        [] as PatternList
      );
  }

  assertNever(classification);
};

interface ExistsPattern {
  exists: boolean;
}

export const isExistsPattern = (x: any): x is ExistsPattern => {
  return "exists" in x;
};

interface PrefixPattern {
  prefix: string;
}

export const isPrefixPattern = (x: any): x is PrefixPattern => {
  return "prefix" in x;
};

/**
 * Can only contain a single prefix pattern.
 */
interface AnythingButPattern {
  "anything-but": (string | number)[] | string | number | PrefixPattern | null;
}

export const isAnythingButPattern = (x: any): x is AnythingButPattern => {
  return "anything-but" in x;
};

interface NumberPattern {
  number: [string, number, string, number] | [string, number];
}

export const isNumberPattern = (x: any): x is NumberPattern => {
  return typeof x === "object" && "number" in x;
};

export const isMatchPattern = (x: any): x is MatchPattern => {
  return x === null || typeof x === "string" || typeof x === "number";
};

export const isNonNegative = (x: any): x is string | NumberPattern =>
  isNumberPattern(x) || isMatchPattern(x);

type MatchPattern = number | string | null | boolean;

interface SubPattern extends Record<string, Pattern> {}

type PatternList = (
  | MatchPattern
  | AnythingButPattern
  | NumberPattern
  | PrefixPattern
  | ExistsPattern
)[];

type Pattern = PatternList | undefined | SubPattern;

/**
 * As of CDK 2.14, Event Bridge doesn't support the content matchers.
 * To use with CDK, cast to {@link aws_events.EventPattern}.
 * https://github.com/aws/aws-cdk/issues/6184
 */
export type FnLsEventPattern = {
  [key in keyof aws_events.EventPattern]: key extends "detail"
    ? Pattern
    : Exclude<Pattern, SubPattern>;
};

export type ClassDocument = {
  doc: {
    [key: string]: ClassDocument | PatternClassification;
  };
};

export const isClassDocument = (
  x: PatternClassification | ClassDocument
): x is ClassDocument => {
  return "doc" in x;
};

export type EventClassDocument = {
  [key in keyof aws_events.EventPattern]: key extends "detail"
    ? ClassDocument | PatternClassification
    : PatternClassification;
};

export const isSubSet = (set1: any[], set2: any[]): boolean => {
  const [subSet, superSet] =
    set1.length > set2.length ? [set2, set1] : [set1, set2];

  return subSet.every((s) => superSet.includes(s));
};

type EventReference = [string] | ["detail", ...string[]];

// TODO: validate again object schema?
function assertValidEventRefererence(
  eventReference: string[]
): asserts eventReference is EventReference {
  if (eventReference.length === 0) {
    throw new Error("Direct use of the event is invalid.");
  }
  if (eventReference.length > 1) {
    const [first] = eventReference;
    if (first !== "detail") {
      throw `Event references with depth greater than one must be on the detail propert, got ${eventReference.join(
        ","
      )}`;
    }
  }
}
