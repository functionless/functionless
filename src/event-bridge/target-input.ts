import { aws_events } from "aws-cdk-lib";
import { RuleTargetInput } from "aws-cdk-lib/aws-events";
import { assertConstantValue, assertString } from "../assert";
import { FunctionDecl, validateFunctionDecl } from "../declaration";
import { Err } from "../error";
import { ErrorCodes, SynthError } from "../error-code";
import { ArrayLiteralExpr, Expr, ObjectLiteralExpr } from "../expression";
import {
  isArrayLiteralExpr,
  isAwaitExpr,
  isBinaryExpr,
  isCallExpr,
  isElementAccessExpr,
  isIdentifier,
  isObjectLiteralExpr,
  isPropAccessExpr,
  isPropAssignExpr,
  isReferenceExpr,
  isPromiseExpr,
  isTemplateExpr,
} from "../guards";
import { isIntegration } from "../integration";
import { evalToConstant } from "../util";
import {
  assertValidEventReference,
  flattenReturnEvent,
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
  maybeDecl: FunctionDecl | Err | unknown
): aws_events.RuleTargetInput => {
  const decl = validateFunctionDecl(maybeDecl, "EventBridgeTarget");

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

    if (
      constant &&
      (constant.constant === null || typeof constant.constant !== "object")
    ) {
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
      assertValidEventReference(ref, eventDecl?.name, utilsDecl?.name);
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
          "Addition operator is only supported to concatenate at least one string to another value."
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
    } else if (isPromiseExpr(expr) || isAwaitExpr(expr)) {
      // pass these through, most promises will fail later, await could be benign
      return exprToLiteral(expr.expr);
    } else if (isCallExpr(expr)) {
      if (isReferenceExpr(expr.expr)) {
        const ref = expr.expr.ref();
        if (isIntegration(ref)) {
          throw new SynthError(
            ErrorCodes.EventBus_Input_Transformers_do_not_support_Integrations
          );
        }
      }
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
            [name]: assertConstantValue(
              exprToInternalLiteral(expr.expr),
              "Event Bridge input transforms can only output constant values."
            ),
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
      const input = rule.stack.resolve(value.input);
      if (typeof input === "string" && input) {
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
