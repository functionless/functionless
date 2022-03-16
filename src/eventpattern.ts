import { aws_events } from "aws-cdk-lib";
import { BinaryExpr, Expr, FunctionDecl, PropAccessExpr, UnaryExpr } from ".";
import { assertDefined, assertNever, assertString } from "./assert";
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
    } else {
      throw new Error(`Unsupported binary operator ${expr.op}`);
    }
  };

  const handleUnaryExpression = (expr: UnaryExpr): ClassDocument => {
    const sub = handleExpr(expr.expr);

    // TODO: Support negating more complex documents
    if (expr.op === "!") {
      return negateDocument(sub);
    }

    throw new Error(`Unsupported unary expression ${expr.op}`);
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
        : typeof pattern.anythingBut === "string" && pattern.prefix
        ? { prefix: pattern.anythingBut }
        : { value: pattern.anythingBut };
    } else if (isExactMatchClassficiation(pattern)) {
      return typeof pattern.value === "boolean"
        ? { value: !pattern.value }
        : { anythingBut: pattern.value };
    } else if (isPresentClassification(pattern)) {
      return { isPresent: !pattern.isPresent };
    } else if (isPrefixMatchClassficiation(pattern)) {
      return { anythingBut: pattern.prefix, prefix: true };
    } else if (isEmptyClassification(pattern)) {
      return pattern;
    } else if (isNullMatchClassification(pattern)) {
      return { anythingBut: null };
    } else if (isNumericRangeClassficiation(pattern)) {
      return {
        lower: pattern.upper
          ? { inclusive: !pattern.upper.inclusive, value: pattern.upper.value }
          : undefined,
        upper: pattern.lower
          ? { inclusive: !pattern.lower.inclusive, value: pattern.lower.value }
          : undefined,
      };
    }

    assertNever(pattern);
  };

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
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return eventReferenceToPattern(eventReference, { value });
    } else if (value === null) {
      return eventReferenceToPattern(eventReference, { null: true });
    }
    throw new Error(
      `Unsupported equivelency: ${eventReference.join(",")} ${value}`
    );
  };

  const handleNotEquals = (_expr: BinaryExpr): ClassDocument => {
    return { doc: {} };
  };

  const assertOneEventReference = (
    left: Expr,
    right: Expr,
    op: BinaryExpr["op"]
  ): {
    eventReference: EventReference;
    eventExpr: Expr;
    other: Expr;
    op: string;
  } => {
    const leftExpr = getEventReference(left);
    const rightExpr = getEventReference(right);
    if (Array.isArray(leftExpr) && Array.isArray(rightExpr)) {
      throw new Error("Expected exactly one event reference, got two.");
    } else if (Array.isArray(leftExpr)) {
      assertValidEventRefererence(leftExpr);
      return { eventReference: leftExpr, eventExpr: left, other: right, op };
    } else if (Array.isArray(rightExpr)) {
      assertValidEventRefererence(rightExpr);
      return {
        eventReference: rightExpr,
        eventExpr: right,
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
        return ">=";
      case "<=":
        return ">";
      case ">":
        return "<=";
      case ">=":
        return "<";
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
      const key =
        expression.kind === "PropAccessExpr"
          ? expression.name
          : assertString(getConstant(expression.element)?.value);
      const parent = getEventReference(expression.expr);
      if (parent) {
        return [...parent, key];
      }
      return undefined;
    }
    return undefined;
  };

  const getConstant = (
    expr: Expr
  ): { value: string | number | boolean | undefined } | undefined => {
    if (
      expr.kind === "StringLiteralExpr" ||
      expr.kind === "NumberLiteralExpr" ||
      expr.kind === "BooleanLiteralExpr"
    ) {
      return { value: expr.value };
    }
    // TODO: support null and undefined as separate values;
    else if (expr.kind === "NullLiteralExpr") {
      return { value: undefined };
    }
    return undefined;
  };

  /**
   * Handles a branching AND statement.
   * Merges the pattern matchers discovered on the left anf right side.
   *
   * AND Rules:
   * Merging distinct fields is OK
   * Merging varying levels of fields is an ERROR
   *    { details: [null] } CANNOT merge with { detail: { name: ["sam"] } }
   * Merging same fields is an ERROR for non-negatives values
   *    { source: ["lambda"] } CANNOT merge with { source: ["events"] }
   * Merging negation is OK
   *    { source: [{ anything-but: ["lambda"] }] } can merge with { source: [{ anything-but: ["events"] }] }
   *    => { source: [{ anything-but: ["lambda", "events"] }] }
   * Merging negation, prefix, exists with non-negative and negative values just results in the non-negagive values
   *    { source: [{ anything-but: ["lambda"] }] } can merge with { source: ["events"] }
   *    => { source: ["events"] }
   */
  // const handleAnd = (expr: BinaryExpr): FnLsEventPattern => {
  //   const left = handleExpr(expr.left);
  //   const right = handleExpr(expr.right);

  //   // TODO: fix type cheating
  //   return mergeEventPattern(
  //     left as any,
  //     right as any,
  //     // merge a single field or fail based on the contents of the pattern matchers
  //     handleAndMerge
  //   ) as FnLsEventPattern;
  // };

  // const handleAndMerge = (
  //   l: PatternClassification,
  //   r: PatternClassification
  // ): PatternClassification => {
  //   const aggregate = isAggregateClassification(l)
  //     ? l
  //     : isAggregateClassification(r)
  //     ? r
  //     : undefined;
  //   // handle as an aggregate
  //   if (aggregate) {
  //     return handleAggregateAndMerge(aggregate, l === aggregate ? r : l);
  //   } else if (isExactMatchClassficiation(l)) {
  //     if (isExactMatchClassficiation(r)) {
  //       if (l.value == r.value) {
  //         return l;
  //       }
  //       // TODO
  //       throw Error("");
  //     } else if (isPresentClassification(r)) {
  //       if (r.isPresent) {
  //         return l;
  //       } else {
  //         throw new Error(
  //           "Contradiction between equals matcher and not exists in AND."
  //         );
  //       }
  //     } else {
  //       // TODO
  //       throw new Error("");
  //     }
  //   } else if (isNullMatchClassification(l)) {
  //     if (isNullMatchClassification(r)) {
  //       return l;
  //     } else if (isPresentClassification(r)) {
  //       if (r.isPresent) {
  //         return l;
  //       } else {
  //         throw new Error(
  //           "Contradiction between null matcher and not exists in AND."
  //         );
  //       }
  //     } else {
  //       // TODO
  //       throw new Error("");
  //     }
  //   } else if (isPrefixMatchClassficiation(l)) {
  //     if (isPrefixMatchClassficiation(r)) {
  //       if (l.prefix.startsWith(r.prefix)) {
  //         return l;
  //       } else if (r.prefix.startsWith(l.prefix)) {
  //         return r;
  //       } else {
  //         // TODO
  //         throw Error("");
  //       }
  //     } else if (isPresentClassification(r)) {
  //       if (r.isPresent) {
  //         return l;
  //       } else {
  //         throw new Error(
  //           "Contradiction between prefix matcher and not exists in AND."
  //         );
  //       }
  //     } else {
  //       // TODO
  //       throw new Error("");
  //     }
  //   }
  // };

  // const handleAggregateAndMerge = (
  //   aggregate: AggregateClassification,
  //   other: PatternClassification
  // ): PatternClassification => {};

  // const mergeEventPattern = (
  //   left: Record<string, PatternClassification>,
  //   right: Record<string, PatternClassification>,
  //   mergePatternArray: (
  //     l: PatternClassification,
  //     r: PatternClassification
  //   ) => PatternClassification
  // ): Record<string, any> => {
  //   // unique keys
  //   const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];

  //   const resolveFields = (l?: any, r?: any): any | undefined => {
  //     // one is undefined, take the other
  //     if (typeof l === "undefined" || typeof l === "undefined") {
  //       return l ? l : r;
  //     } else if (Array.isArray(l) !== Array.isArray(r)) {
  //       // TODO: this error could be more specific, revisit
  //       throw new Error(
  //         `Pattern depth between conditional branches are not the same Left: ${l} Right: ${r}`
  //       );
  //     } else if (Array.isArray(l) && Array.isArray(r)) {
  //       // Merge arrays based on the rules, AND and OR will be different.
  //       return mergePatternArray(l, r);
  //     } else if (typeof l === "object" && typeof r === "object") {
  //       // Deep objects
  //       return mergeEventPattern(l, r, mergePatternArray);
  //     } else {
  //       throw new Error(
  //         `Unknown matcher type Left: ${typeof l} Right: ${typeof l}`
  //       );
  //     }
  //   };

  //   return keys.reduce((acc, field) => {
  //     const l = left[field];
  //     const r = right[field];

  //     return {
  //       ...acc,
  //       [field]: resolveFields(l, r),
  //     };
  //   }, {});
  // };

  // const handleOr = (
  //   left: aws_events.EventPattern,
  //   right: aws_events.EventPattern
  // ): FnLsEventPattern => {};

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
    | NumericRangeClassficiation
    | PresentClassification
    | NullMatchClassification
    | AnythingButClassification
  )[];
}

export const isAggregateClassification = (
  x: PatternClassification
): x is AggregateClassification => {
  return "classificaiton" in x;
};

export interface ExactMatchClassficiation {
  value: string | number | boolean;
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

interface NumericRangeClassficiation {
  lower?: { value: number; inclusive: boolean };
  upper?: { value: number; inclusive: boolean };
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
  anythingBut: number | string | null;
  prefix?: boolean;
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
  | EmptyClassification;

const classDocumentToEventPattern = (
  classDocument: ClassDocument
): SubPattern => {
  return Object.entries(classDocument.doc).reduce(
    (pattern, [key, entry]) => ({
      ...pattern,
      [key]: isClassDocument(entry)
        ? classDocumentToEventPattern(entry)
        : classificationToPattern(entry),
    }),
    {}
  );
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
          classification.prefix
            ? { prefix: classification.anythingBut }
            : classification.anythingBut,
      },
    ];
  } else if (isNumericRangeClassficiation(classification)) {
    if (!classification.lower && !classification.upper) {
      return undefined;
    }
    return [
      {
        number: [
          ...(classification.lower
            ? [
                classification.lower.inclusive ? ">=" : "=",
                classification.lower.value,
              ]
            : []),
          ...(classification.upper
            ? [
                classification.upper.inclusive ? "<=" : "<",
                classification.upper.value,
              ]
            : []),
        ] as [string, number, string, number] | [string, number],
      },
    ];
  } else if (isAggregateClassification(classification)) {
    return classification.classifications
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
