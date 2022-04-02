import { aws_events } from "aws-cdk-lib";
import { RuleTargetInput } from "aws-cdk-lib/aws-events";
import { assertString } from "../assert";
import { FunctionDecl, isFunctionDecl } from "../declaration";
import { Err, isErr } from "../error";
import {
  ArrayLiteralExpr,
  Expr,
  isArrayLiteralExpr,
  isBinaryExpr,
  isElementAccessExpr,
  isIdentifier,
  isObjectLiteralExpr,
  isPropAccessExpr,
  isPropAssignExpr,
  isTemplateExpr,
  ObjectLiteralExpr,
} from "../expression";
import {
  assertValidEventRefererence,
  flattenReturnEvent,
  evalToConstant,
  getReferencePath,
  isStringType,
  ReferencePath,
} from "./utils";

const PREDEFINED_VALUES = [
  "<aws.events.event>",
  "<aws.events.event.json>",
  "<aws.events.rule-arn>",
  "<aws.events.rule-name>",
  "<aws.events.ingestion-time>",
] as const;

type PREDEFINED = typeof PREDEFINED_VALUES[number];

/**
 * Generates a RuleTargetInput from a typescript function.
 *
 * Transforms an input event `event` to the return type `P`.
 *
 * TargetInputs interact with the input event using JSON Path.
 *
 * https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-transform-target-input.html
 */
export const synthesizeEventBridgeTargets = (
  decl: FunctionDecl | Err | any
): aws_events.RuleTargetInput => {
  if (isErr(decl)) {
    throw decl.error;
  } else if (!isFunctionDecl(decl)) {
    throw Error(
      "Expected parameter to synthesizeEventBridgeTargets to be compiled by functionless."
    );
  }
  const [eventDecl = undefined, utilsDecl = undefined] = decl.parameters;

  const expression = flattenReturnEvent(decl.body.statements);

  type LiteralType =
    | {
        value: Exclude<
          ReturnType<typeof evalToConstant>,
          undefined
        >["constant"];
        type: "string";
      }
    | {
        value: PREDEFINED;
        type: "predefined";
      }
    | {
        type: "path";
        value: string;
      }
    | {
        type: "object";
        value: Record<string, any> | any[];
      };

  const exprToInternalLiteral = (expr: Expr): LiteralType["value"] => {
    const lit = exprToLiteral(expr);
    if (lit.type === "path") {
      return aws_events.EventField.fromPath(lit.value);
    } else if (lit.type === "string") {
      return lit.value;
    } else {
      return lit.value;
    }
  };

  const exprToStringLiteral = (expr: Expr): LiteralType["value"] => {
    const lit = exprToLiteral(expr);
    if (lit.type === "path") {
      return aws_events.EventField.fromPath(lit.value);
    } else if (lit.type === "string" || lit.type === "predefined") {
      return lit.value;
    } else {
      return JSON.stringify(lit.value);
    }
  };

  const exprToLiteral = (expr: Expr): LiteralType => {
    const constant = evalToConstant(expr);

    if (constant) {
      return {
        value: constant.constant,
        type: "string",
      };
    } else if (
      isPropAccessExpr(expr) ||
      isElementAccessExpr(expr) ||
      isIdentifier(expr)
    ) {
      const ref = getReferencePath(expr);
      assertValidEventRefererence(ref, eventDecl?.name, utilsDecl?.name);
      // If the event parameter is used directly, replace it with the predefined <aws.events.event> reference.
      if (
        eventDecl &&
        ref.reference.length === 0 &&
        ref.identity === eventDecl.name
      ) {
        return {
          value: "<aws.events.event>",
          type: "predefined",
        };
      }
      // check to see if the value is a predefined value
      if (utilsDecl && ref.identity === utilsDecl?.name) {
        const [context = undefined, value = undefined] = ref.reference;
        if (context === "context") {
          if (value === "ruleName") {
            return {
              value: "<aws.events.rule-name>",
              type: "predefined",
            };
          } else if (value === "ruleArn") {
            return {
              value: "<aws.events.rule-arn>",
              type: "predefined",
            };
          } else if (value === "ingestionTime") {
            return {
              value: "<aws.events.ingestion-time>",
              type: "predefined",
            };
          } else if (value === "eventJson") {
            return {
              value: "<aws.events.event.json>",
              type: "predefined",
            };
          }
        }
      }
      const path = refToJsonPath(ref);

      if (!path) {
        throw Error(
          "Transform function may only use a reference to the event, $utils, or a constant."
        );
      }

      return {
        value: path,
        type: "path",
      };
    } else if (isBinaryExpr(expr)) {
      if (expr.op === "+") {
        if (isStringType(expr.left) || isStringType(expr.right)) {
          const val = `${exprToInternalLiteral(
            expr.left
          )}${exprToInternalLiteral(expr.right)}`;
          return {
            value: val,
            type: "string",
          };
        }
        throw Error(
          "Addition operator is only supported to concatinate at least one string to another value."
        );
      } else {
        throw Error(`Unsupported binary operator: ${expr.op}`);
      }
    } else if (isTemplateExpr(expr)) {
      return {
        value: expr.exprs.map((x) => exprToStringLiteral(x)).join(""),
        type: "string",
      };
    } else if (isObjectLiteralExpr(expr) || isArrayLiteralExpr(expr)) {
      return exprToObject(expr);
    } else if (isIdentifier(expr)) {
      throw Error("Unsupported direct use of the event parameter.");
    }

    throw Error(`Unsupported template expression of kind: ${expr.kind}`);
  };

  const exprToObject = (
    expr: ObjectLiteralExpr | ArrayLiteralExpr
  ): LiteralType => {
    if (isObjectLiteralExpr(expr)) {
      const obj = expr.properties.reduce((obj, expr) => {
        if (isPropAssignExpr(expr)) {
          const name = isIdentifier(expr.name)
            ? expr.name.name
            : assertString(evalToConstant(expr.name)?.constant, expr.name.kind);
          return {
            ...obj,
            [name]: exprToInternalLiteral(expr.expr),
          };
        } else {
          throw new Error(
            "Event Bridge input transforms do not support object spreading."
          );
        }
      }, {});

      return {
        type: "object",
        value: obj,
      };
    } else {
      const arr = expr.items.map((e) => exprToInternalLiteral(e));
      return { value: arr, type: "object" };
    }
  };

  const rootValue = exprToLiteral(expression);
  if (rootValue.type === "path") {
    return aws_events.RuleTargetInput.fromEventPath(rootValue.value);
  } else if (rootValue.type === "predefined") {
    // CDK doesn't support returning top level pre-defined values, so lets force it.
    if (rootValue.value === "<aws.events.event>") {
      return {
        bind: () => ({ inputPathsMap: {}, inputTemplate: rootValue.value }),
      };
    }
    return {
      bind: () => ({
        inputPathsMap: {},
        inputTemplate: `"${rootValue.value}"`,
      }),
    };
  }
  return RuleInputWrapper(
    aws_events.RuleTargetInput.fromObject(rootValue.value)
  );
};

/**
 * CDK does not support pre-defined values.
 *
 * Event Bridge pre-defined values do not work consistently,
 * as documented here: https://github.com/aws/aws-cdk/blob/v2.17.0/packages/@aws-cdk/aws-events/lib/input.ts#L114
 *
 * Replicate some of the CDK behavior to get the format we need for predefined values.
 */
const RuleInputWrapper = (wrapped: RuleTargetInput): RuleTargetInput => ({
  bind: (rule) => {
    const value = wrapped.bind(rule);
    if (!!value.inputTemplate) {
      if (!value.inputPathsMap) {
        return {
          ...value,
          inputPathsMap: {},
        };
      }
    }
    if (value.input) {
      // These values should all be runtime resolvable.
      const input: string = rule.stack.resolve(value.input);
      if (input) {
        if (PREDEFINED_VALUES.some((v) => input.includes(v))) {
          return {
            inputTemplate: input.replace(
              /\"(\<aws\.events.*\>)\"/g,
              (_a, b) => b
            ),
            inputPathsMap: {},
          };
        }
      }
    }

    return value;
  },
});

const refToJsonPath = (ref: ReferencePath): string | undefined => {
  return formatJsonPath("$", ...ref.reference);
};

const formatJsonPath = (first: string, ...path: (string | number)[]): string =>
  path.reduce(
    (acc: string, seg) =>
      acc + (typeof seg === "string" ? `.${seg}` : `[${seg.toString()}]`),
    first
  );
