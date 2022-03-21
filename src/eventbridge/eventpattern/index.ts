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
import { isReturn, Stmt } from "../../statement";
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
import { getConstant, getPropertyAccessKey, getReferencePath } from "../utils";

/**
 * https://github.com/sam-goodwin/functionless/issues/37#issuecomment-1066313146
 */
export const synthesizeEventPattern = (
  predicate: FunctionDecl
): fnls_event_bridge.FnLsEventPattern => {
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

  const handleSmnt = (stmt: Stmt): PatternDocument => {
    if (isReturn(stmt)) {
      return handleExpr(stmt.expr);
    } else {
      throw new Error(`Unsupported statement ${stmt.kind}`);
    }
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

    const value = assertNumber(getConstant(other)?.value);

    assertValidEventRefererence(eventReference);
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
      expr.args[INCLUDES_SEARCH_ELEMENT]
    )?.value;

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
      if (expr.expr.expr.type === "number[]") {
        const num = assertNumber(searchElement);
        assertValidEventRefererence(eventReference);
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

        assertValidEventRefererence(eventReference);
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
    const searchString = assertString(
      getConstant(expr.args[STARTS_WITH_SEARCH_STRING])?.value
    );

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
        assertValidEventRefererence(eventReference);
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

    const value = assertString(getConstant(expr.left)?.value);

    if (!eventReference) {
      throw new Error(
        "Expected the right side of an in operator to be a event reference."
      );
    }

    const upadteEventReference = [...eventReference, value];

    assertValidEventRefererence(upadteEventReference);

    return eventReferenceToPatternDocument(upadteEventReference, {
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

    assertValidEventRefererence(eventReference);

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

    const { value } = assertDefined(
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
    throw new Error(
      `Unsupported equivelency: ${eventReference.join(",")} ${value}`
    );
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

  /**
   * Recurse an expression to find a reference to the event.
   */
  const getEventReference = (expression: Expr): string[] | undefined => {
    return getReferencePath(expression, eventDecl?.name);
  };

  // find the return, we'll the resolve the rest as needed.
  const [ret] = predicate.body.statements.filter((expr) => isReturn(expr));

  if (!ret) {
    throw new Error("Missing return statement in predicate block.");
  }

  const result = handleSmnt(ret);

  const doc = patternDocumentToEventPattern(result);

  const isEmpty = !Object.values(doc).some(
    (x) => !!x && (!Array.isArray(x) || x.length > 0)
  );

  // empty prefix on source should always be true and represent a match all rule.
  return isEmpty ? { source: [{ prefix: "" }] } : doc;
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

/**
 * { isPresent: true } => { isPresent: false }
 * { value: true } => { value: false }
 * { value "a" } => { "anything-but": "a" }
 * Do not support
 *   * documents with more than one field in in - do not support OR accross multiple fields, inverting multiple AND fields is OR
 *   * aggregate pattern (OR logic) - do not support AND within a field, inverting OR statements becomes AND, the one exception are numeric ranges.
 */
const negateDocument = (classDocument: PatternDocument): PatternDocument => {
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
    return typeof pattern.anythingBut === "string" && pattern.isPrefix
      ? { prefix: pattern.anythingBut }
      : { value: pattern.anythingBut };
  } else if (isExactMatchPattern(pattern)) {
    return typeof pattern.value === "boolean"
      ? { value: !pattern.value }
      : { anythingBut: pattern.value };
  } else if (isPresentPattern(pattern)) {
    return { isPresent: !pattern.isPresent };
  } else if (isPrefixMatchPattern(pattern)) {
    return { anythingBut: pattern.prefix, isPrefix: true };
  } else if (isEmptyPattern(pattern)) {
    return pattern;
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
  }

  assertNever(pattern);
};

const eventReferenceToPatternDocument = (
  eventReference: [string, ...string[]],
  pattern: Pattern
): PatternDocument => {
  const [head, ...tail] = eventReference;
  if (tail.length < 1) {
    return {
      doc: {
        [head]: pattern,
      },
    };
  }
  return {
    doc: {
      [head]: eventReferenceToPatternDocument(
        tail as [string, ...string[]],
        pattern
      ),
    },
  };
};
