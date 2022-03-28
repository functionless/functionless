import { FunctionDecl } from "../../declaration";
import {
  BinaryExpr,
  CallExpr,
  ElementAccessExpr,
  Expr,
  isBooleanLiteral,
  PropAccessExpr,
  UnaryExpr,
} from "../../expression";
import {
  assertDefined,
  assertNever,
  assertNumber,
  assertString,
} from "../../assert";
import {
  PatternDocument,
  Pattern,
  isPatternDocument,
  isNumericAggregationPattern,
  isNumericRangePattern,
  isPresentPattern,
  isAggregatePattern,
  isAnythingButPattern,
  isExactMatchPattern,
  isPrefixMatchPattern,
  isEmptyPattern,
  patternDocumentToEventPattern,
  isAnythingButPrefixPattern,
  isNeverPattern,
} from "./pattern";
import * as fnls_event_bridge from "./types";
import {
  joinNumericRange,
  reduceNumericAggregate,
  mergeNumericOr,
  negateNumericRange,
  andNumericAggregation,
  andNumericAggregationWithRange,
  createSingleNumericRange,
} from "./numeric";
import {
  BinaryOp,
  isBinaryExpr,
  isCallExpr,
  isElementAccessExpr,
  isNullLiteralExpr,
  isPropAccessExpr,
  isUnaryExpr,
} from "../..";
import {
  INCLUDES_SEARCH_ELEMENT,
  OPERATIONS,
  STARTS_WITH_SEARCH_STRING,
} from "./constants";
import { invertBinaryOperator } from "./utils";
import {
  assertValidEventRefererence,
  EventReference,
  flattenReturnEvent,
  getConstant,
  getPropertyAccessKey,
  getReferencePath,
  ReferencePath,
} from "../utils";
import { Err, isErr } from "../../error";

/**
 * https://github.com/sam-goodwin/functionless/issues/37#issuecomment-1066313146
 */
export const synthesizeEventPattern = (
  predicate: FunctionDecl | Err
): fnls_event_bridge.FnLsEventPattern => {
  if (isErr(predicate)) {
    throw predicate.error;
  }
  const [eventDecl = undefined] = predicate.parameters;

  const handleExpr = (expr: Expr): PatternDocument => {
    if (isBinaryExpr(expr)) {
      return handleBinary(expr);
    } else if (isPropAccessExpr(expr)) {
      return handlePropAccess(expr);
    } else if (isUnaryExpr(expr)) {
      return handleUnaryExpression(expr);
    } else if (isCallExpr(expr)) {
      return handleCall(expr);
    } else if (isBooleanLiteral(expr)) {
      return { doc: {} };
    } else {
      throw new Error(`${expr.kind} is unsupported`);
    }
    // assertNever(expr);
  };

  const handleBinary = (expr: BinaryExpr): PatternDocument => {
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

  const handleAnd = (expr: BinaryExpr): PatternDocument => {
    const left = handleExpr(expr.left);
    const right = handleExpr(expr.right);

    return andDocuments(left, right);
  };

  const andDocuments = (
    classDocument1: PatternDocument,
    classDocument2: PatternDocument
  ): PatternDocument => {
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
    }, {} as PatternDocument);
  };

  const andMergePattern = (
    key: string,
    pattern1: PatternDocument | Pattern,
    pattern2: PatternDocument | Pattern
  ): PatternDocument | Pattern => {
    // both are documents, lets merge the documents
    if (isPatternDocument(pattern1) && isPatternDocument(pattern2)) {
      return andDocuments(pattern1, pattern2);
      // both are patterns, merge the patterns
    } else if (!isPatternDocument(pattern1) && !isPatternDocument(pattern2)) {
      if (isPresentPattern(pattern1)) {
        if (isPresentPattern(pattern2)) {
          // same pattern, merge
          if (pattern1.isPresent === pattern2.isPresent) {
            return pattern1;
          } else {
            throw new Error("Field cannot both be present and not present.");
          }
        }
        // If the pattern checks for presense, return othe other pattern, they should all imply the pattern is present.
        if (pattern1.isPresent) {
          return pattern2;
        }
        // checks for not present
        // take anything but, because !x && x !== "x" => !x
        if (isAnythingButPattern(pattern2)) {
          return pattern1;
        }
        // cannot && exists: false and any other pattern as it would be impossible.
        throw new Error(
          "Invalid comparison: pattern cannot both be not present as a positive value."
        );
      }
      if (isPresentPattern(pattern2)) {
        // If the pattern checks for presense, return othe other pattern, they should all imply the pattern is present.
        if (pattern2.isPresent) {
          return pattern1;
        }
        // checks for not present
        // take anything but, because !x && x !== "x" => !x
        if (isAnythingButPattern(pattern1)) {
          return pattern2;
        }
        // cannot && exists: false and any other pattern as it would be impossible.
        throw new Error(
          "Invalid comparison: Pattern cannot both be not present as a positive value."
        );
      }
      if (isNumericAggregationPattern(pattern1)) {
        if (isNumericAggregationPattern(pattern2)) {
          return andNumericAggregation(pattern1, pattern2);
        }
        if (isNumericRangePattern(pattern2)) {
          return andNumericAggregationWithRange(pattern1, pattern2);
        }
      }
      if (isNumericAggregationPattern(pattern2)) {
        if (isNumericRangePattern(pattern1)) {
          return andNumericAggregationWithRange(pattern2, pattern1);
        }
      }
      if (isNumericRangePattern(pattern1) && isNumericRangePattern(pattern2)) {
        return joinNumericRange(pattern1, pattern2);
      }
      if (isAnythingButPattern(pattern1)) {
        if (isAnythingButPattern(pattern2)) {
          return {
            anythingBut: [...pattern1.anythingBut, ...pattern2.anythingBut],
          };
        }
      }
      if (isAnythingButPrefixPattern(pattern1)) {
        if (isAnythingButPrefixPattern(pattern2)) {
          if (pattern1.anythingButPrefix === pattern2.anythingButPrefix) {
            return pattern1;
          }
        }
        throw Error(
          "Event Bridge patterns do not support AND logic between NOT prefix and any other logic."
        );
      }
      if (isAnythingButPrefixPattern(pattern2)) {
        throw Error(
          "Event Bridge patterns do not support AND logic between NOT prefix and any other logic."
        );
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

  /**
   * OR Boolean logic handler.
   *
   * Resolves the left and right branches and then tries to merge together the results of each.
   */
  const handleOr = (expr: BinaryExpr): PatternDocument => {
    const left = handleExpr(expr.left);
    const right = handleExpr(expr.right);

    return orDocuments(left, right);
  };

  /**
   * Event bridge does not support OR across fields, only AND logic
   * If applying OR and there are already multiple fields on either side of the or the field on either side are different, fail
   */
  const orDocuments = (
    patternDocument1: PatternDocument,
    patternDocument2: PatternDocument
  ): PatternDocument => {
    const doc1Keys = Object.keys(patternDocument1.doc);
    const doc2Keys = Object.keys(patternDocument2.doc);
    if (doc1Keys.length > 1 || doc2Keys.length > 1) {
      throw Error(
        `Event bridge does not support OR logic between multiple fields, found ${doc1Keys.join(
          ","
        )} and ${doc2Keys.join(",")}.`
      );
    }
    if (doc1Keys.length === 0) {
      return patternDocument2;
    }
    if (doc2Keys.length === 0) {
      return patternDocument1;
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
          patternDocument1.doc[key],
          patternDocument2.doc[key]
        ),
      },
    };
  };

  /**
   * Logic to merge patterns on a single field.
   * See table: https://github.com/sam-goodwin/functionless/issues/37#issuecomment-1066313146
   *
   * Is Present/Exists and Numers are special, for all else, return an aggregate with all patterns.
   */
  const orMergePattern = (
    key: string,
    pattern1: PatternDocument | Pattern,
    pattern2: PatternDocument | Pattern
  ): PatternDocument | Pattern => {
    // both are documents, lets merge the documents
    if (isPatternDocument(pattern1) && isPatternDocument(pattern2)) {
      return orDocuments(pattern1, pattern2);
      // both are patterns, merge the patterns
    } else if (!isPatternDocument(pattern1) && !isPatternDocument(pattern2)) {
      if (isPresentPattern(pattern1)) {
        if (isPresentPattern(pattern2)) {
          // when the logic is "name" in event.detail || !("name" in event.detail), simplify to empty logic
          if (pattern1.isPresent != pattern2.isPresent) {
            return { empty: true };
          }
          // if both are exists: true or exists: false
          return pattern1;
        }
        // If one of the patterns are exists: true, return exists: true
        if (pattern1.isPresent) {
          return pattern1;
        }
      }
      if (isPresentPattern(pattern2)) {
        // If one of the patterns are exists: true, return exists: true
        if (pattern2.isPresent) {
          return pattern1;
        }
      }
      if (isNumericAggregationPattern(pattern1)) {
        if (isNumericAggregationPattern(pattern2)) {
          return reduceNumericAggregate({
            ranges: [...pattern1.ranges, ...pattern2.ranges],
          });
        }
        if (isNumericRangePattern(pattern2)) {
          return reduceNumericAggregate({
            ranges: [...pattern1.ranges, pattern2],
          });
        }
        throw Error("Cannot OR a numeric ranges with any other pattern.");
      }
      if (isNumericAggregationPattern(pattern2)) {
        if (isNumericRangePattern(pattern1)) {
          return reduceNumericAggregate({
            ranges: [...pattern2.ranges, pattern1],
          });
        }
        throw Error("Cannot OR a numeric ranges with any other pattern.");
      }
      if (isNumericRangePattern(pattern1)) {
        if (isNumericRangePattern(pattern2)) {
          return mergeNumericOr(pattern1, pattern2);
        }
        throw Error("Cannot OR a numeric ranges with any other pattern.");
      }
      // TODO support OR logic with exists: false
      if (isNumericRangePattern(pattern2)) {
        throw Error("Cannot OR a numeric ranges with any other pattern.");
      }
      if (isAnythingButPattern(pattern1)) {
        // x !== "a" || x !== "b" => true
        if (isAnythingButPattern(pattern2)) {
          return { empty: true };
        }
      }
      return {
        patterns: [
          ...(isAggregatePattern(pattern1)
            ? pattern1.patterns
            : isEmptyPattern(pattern1)
            ? []
            : [pattern1]),
          ...(isAggregatePattern(pattern2)
            ? pattern2.patterns
            : isEmptyPattern(pattern2)
            ? []
            : [pattern2]),
        ],
      };
    }
    // we don't know how to do this (yet?)
    throw new Error(`Patterns of key ${key} defined at different levels.`);
  };

  const handleNumericRange = (expr: BinaryExpr): PatternDocument => {
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

    const value = assertNumber(getConstant(other)?.constant);

    assertValidEventRefererence(eventReference, eventDecl?.name);
    const range = createSingleNumericRange(value, op);
    if (range) {
      return eventReferenceToPatternDocument(eventReference, range);
    }

    throw Error(`Unsupported numeric range operation: ${op}.`);
  };

  /**
   * Any call that we encouter.
   * Event bridge pattern match calls must all be results at build time.
   *
   * Limited to just Includes and StartsWith.
   */
  const handleCall = (expr: CallExpr): PatternDocument => {
    if (
      // the expr of the call
      isPropAccessExpr(expr.expr) ||
      isElementAccessExpr(expr.expr)
    ) {
      const operation = getPropertyAccessKey(expr.expr);

      if (operation === OPERATIONS.INCLUDES) {
        return handleIncludesCall(
          expr as CallExpr & { expr: PropAccessExpr | ElementAccessExpr }
        );
      } else if (operation === OPERATIONS.STARTS_WITH) {
        return handleStartsWithCall(
          expr as CallExpr & { expr: PropAccessExpr | ElementAccessExpr }
        );
      }

      throw new Error(`Unsupported operation ${operation}`);
    }

    throw new Error("Operations only supported on properties of the event.");
  };

  /**
   * Array includes method.
   *
   * Does not support the start position parameter.
   *
   * someArray.includes(someValue)
   */
  const handleIncludesCall = (
    expr: CallExpr & { expr: PropAccessExpr | ElementAccessExpr }
  ): PatternDocument => {
    const searchElement = getConstant(
      assertDefined(
        expr.args.length > 0 ? Object.values(expr.args)[0] : undefined,
        `Includes must have a single string argument ${INCLUDES_SEARCH_ELEMENT}.`
      ).expr
    )?.constant;

    if (
      Object.values(expr.args).filter((e) => !isNullLiteralExpr(e)).length > 1
    ) {
      throw new Error("Includes only supports the searchElement argument");
    }

    // the property the call is on
    const eventReference = getEventReference(expr.expr.expr);

    if (!eventReference) {
      throw new Error("Includes operation must be on a property of the event.");
    }

    if (
      isPropAccessExpr(expr.expr.expr) ||
      isElementAccessExpr(expr.expr.expr)
    ) {
      assertValidEventRefererence(eventReference, eventDecl?.name);
      if (expr.expr.expr.type === "number[]") {
        const num = assertNumber(searchElement);
        return eventReferenceToPatternDocument(eventReference, {
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
          throw Error("Includes operation only supports string or booleans.");
        }

        return eventReferenceToPatternDocument(eventReference, {
          value: searchElement,
        });
      }

      // TODO: support for strings
      throw new Error(
        `Includes operation only supported on Arrays, found ${expr.expr.expr.type}.`
      );
    }

    throw new Error(
      "Includes must be called on a property of the event that is an array."
    );
  };

  const handleStartsWithCall = (
    expr: CallExpr & { expr: PropAccessExpr | ElementAccessExpr }
  ): PatternDocument => {
    const arg = assertDefined(
      expr.args.length > 0 ? Object.values(expr.args)[0] : undefined,
      `StartsWith must contain a single string argument ${STARTS_WITH_SEARCH_STRING}`
    );
    const searchString = assertString(getConstant(arg.expr)?.constant);

    if (
      Object.values(expr.args).filter((e) => !isNullLiteralExpr(e)).length > 1
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
      isPropAccessExpr(expr.expr.expr) ||
      isElementAccessExpr(expr.expr.expr)
    ) {
      if (expr.expr.expr.type === "string") {
        assertValidEventRefererence(eventReference, eventDecl?.name);
        return eventReferenceToPatternDocument(eventReference, {
          prefix: searchString,
        });
      }

      // TODO: support for strings
      throw new Error(
        `Starts With operation only supported on strings, found ${expr.expr.expr.type}.`
      );
    }

    throw new Error(
      "Starts With must be called on a property of the event that is a string."
    );
  };

  const handleUnaryExpression = (expr: UnaryExpr): PatternDocument => {
    const sub = handleExpr(expr.expr);

    // TODO: Support negating more complex documents
    if (expr.op === "!") {
      return negateDocument(sub);
    }

    throw new Error(`Unsupported unary expression ${expr.op}`);
  };

  // TODO: validate that the right side is an object, though the compiler should take care of most cases
  const handleInOperation = (expr: BinaryExpr): PatternDocument => {
    const eventReference = getEventReference(expr.right);

    const value = assertString(getConstant(expr.left)?.constant);

    if (!eventReference) {
      throw new Error(
        "Expected the right side of an in operator to be a event reference."
      );
    }

    const updateEventReference: ReferencePath = {
      identity: eventReference.identity,
      reference: [...eventReference.reference, value],
    };

    assertValidEventRefererence(updateEventReference, eventDecl?.name);

    return eventReferenceToPatternDocument(updateEventReference, {
      isPresent: true,
    });
  };

  /*
   * event.detail.bool
   * event.detail.string
   */
  const handlePropAccess = (expr: PropAccessExpr): PatternDocument => {
    const eventReference = getEventReference(expr);

    if (!eventReference) {
      throw Error("Expected lone property reference to reference the event.");
    }

    assertValidEventRefererence(eventReference, eventDecl?.name);

    return eventReferenceToPatternDocument(
      eventReference,
      expr.type === "boolean"
        ? { value: true }
        : // for all other fields, assert they are simply present
          { isPresent: true }
    );
  };

  /**
   * event.x === "a"
   * event.x === 1
   * event.x === true
   * event.x === undefined => exists: false
   * event.x === null => null: true
   */
  const handleEquals = (expr: BinaryExpr): PatternDocument => {
    const { eventReference, other } = assertOneEventReference(
      expr.left,
      expr.right,
      expr.op
    );

    const { constant: value } = assertDefined(
      getConstant(other),
      "Equivency must compare to a constant value."
    );

    if (typeof value === "undefined") {
      return eventReferenceToPatternDocument(eventReference, {
        isPresent: false,
      });
    } else if (typeof value === "number") {
      // represent a single numeric value using a range to simplify range computation
      // [x, x]
      return eventReferenceToPatternDocument(eventReference, {
        lower: { value, inclusive: true },
        upper: { value, inclusive: true },
      });
    } else if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      return eventReferenceToPatternDocument(eventReference, { value });
    }
    const __exchaustive: never = value;
    return __exchaustive;
  };

  const handleNotEquals = (expr: BinaryExpr): PatternDocument => {
    return negateDocument(handleEquals(expr));
  };

  const assertOneEventReference = (
    left: Expr,
    right: Expr,
    op: BinaryOp
  ): {
    eventReference: EventReference;
    eventExpr: PropAccessExpr | ElementAccessExpr;
    other: Expr;
    op: BinaryOp;
  } => {
    const leftExpr = getEventReference(left);
    const rightExpr = getEventReference(right);
    if (leftExpr !== undefined && rightExpr !== undefined) {
      throw new Error("Expected exactly one event reference, got two.");
    } else if (leftExpr !== undefined) {
      assertValidEventRefererence(leftExpr, eventDecl?.name);
      return {
        eventReference: leftExpr,
        eventExpr: left as PropAccessExpr | ElementAccessExpr,
        other: right,
        op,
      };
    } else if (rightExpr !== undefined) {
      assertValidEventRefererence(rightExpr, eventDecl?.name);
      return {
        eventReference: rightExpr,
        eventExpr: right as PropAccessExpr | ElementAccessExpr,
        other: left,
        op: invertBinaryOperator(op),
      };
    }
    throw new Error("Expected exactly one event reference, got zero.");
  };

  /**
   * Recurse an expression to find a reference to the event.
   */
  const getEventReference = (expression: Expr): ReferencePath | undefined => {
    return getReferencePath(expression);
  };

  const flattenedExpression = flattenReturnEvent(predicate.body.statements);

  const result = handleExpr(flattenedExpression);

  const doc = patternDocumentToEventPattern(result);

  const isEmpty = !Object.values(doc).some(
    (x) => !!x && (!Array.isArray(x) || x.length > 0)
  );

  // empty prefix on source should always be true and represent a match all rule.
  return isEmpty ? { source: [{ prefix: "" }] } : doc;
};

/**
 * { isPresent: true } => { isPresent: false }
 * { value: true } => { value: false }
 * { value "a" } => { "anything-but": "a" }
 * Do not support
 *   * documents with more than one field in in - do not support OR accross multiple fields, inverting multiple AND fields is OR
 *   * aggregate pattern (OR logic) - do not support AND within a field, inverting OR statements becomes AND, the one exception are numeric ranges.
 */
const negateDocument = (classDocument: PatternDocument): PatternDocument => {
  if (Object.keys(classDocument.doc).length > 1) {
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
      [key]: isPatternDocument(entry)
        ? negateDocument(entry)
        : negateClassification(entry),
    },
  };
};

const negateClassification = (pattern: Pattern): Pattern => {
  if (isAggregatePattern(pattern)) {
    throw Error("Can only negate simple statments like boolean and equals.");
  } else if (isAnythingButPattern(pattern)) {
    return Array.isArray(pattern.anythingBut)
      ? pattern.anythingBut.length > 1
        ? { patterns: pattern.anythingBut.map((x) => ({ value: x })) }
        : { value: pattern.anythingBut[0] }
      : { value: pattern.anythingBut };
  } else if (isAnythingButPrefixPattern(pattern)) {
    return { prefix: pattern.anythingButPrefix };
  } else if (isExactMatchPattern(pattern)) {
    return typeof pattern.value === "boolean"
      ? { value: !pattern.value }
      : { anythingBut: [pattern.value] };
  } else if (isPresentPattern(pattern)) {
    return { isPresent: !pattern.isPresent };
  } else if (isPrefixMatchPattern(pattern)) {
    return { anythingButPrefix: pattern.prefix };
  } else if (isEmptyPattern(pattern)) {
    return { never: true };
  } else if (isNumericRangePattern(pattern)) {
    return negateNumericRange(pattern);
  } else if (isNumericAggregationPattern(pattern)) {
    if (pattern.ranges.length === 0) {
      return { empty: true };
    }
    // numeric range aggregations are ORs, when we negate an OR, we need to flip each range and turn it into an AND
    return pattern.ranges
      .map((r) => negateNumericRange(r))
      .reduce((joined, range) => joinNumericRange(joined, range));
  } else if (isNeverPattern(pattern)) {
    return { empty: true };
  }

  assertNever(pattern);
};

const eventReferenceToPatternDocument = (
  eventReference: EventReference,
  pattern: Pattern
): PatternDocument => {
  const __inner = (refs: [string, ...string[]]): PatternDocument => {
    const [head, ...tail] = refs;
    if (tail.length < 1) {
      return {
        doc: {
          [head]: pattern,
        },
      };
    }
    return {
      doc: {
        [head]: __inner(tail as [string, ...string[]]),
      },
    };
  };

  return __inner(eventReference.reference);
};
