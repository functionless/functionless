import type { Expression } from "./expression";
import type { RuleFunction, RuleNestedFunction } from "./rule";
import { guard } from "./util";

export const isFnEquals = guard<FnEquals>("Fn::Equals");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-rules.html#fn-equals
 */
export interface FnEquals {
  "Fn::Equals": [
    left: Expression | RuleFunction,
    right: Expression | RuleFunction
  ];
}

export const isFnNot = guard<FnNot>("Fn::Not");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-rules.html#fn-not
 */
export interface FnNot {
  "Fn::Not": [RuleNestedFunction];
}

export const isFnAnd = guard<FnAnd>("Fn::And");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-rules.html#fn-and
 */
export interface FnAnd {
  "Fn::And": RuleNestedFunction[];
}

export const isFnOr = guard<FnOr>("Fn::Or");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-rules.html#fn-or
 */
export interface FnOr {
  "Fn::Or": RuleNestedFunction[];
}

export const isConditionRef = guard<ConditionRef>("Condition");

export interface ConditionRef {
  Condition: string;
}

/**
 * Top level functions supported by {@link Condition}.
 *
 * ```json
 * "myCondition": {
 *     "Fn::If": {...}
 * }
 * ```
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-conditions.html
 */
export type ConditionFunction = FnAnd | FnEquals | FnNot | FnOr | ConditionRef;

export function isConditionFunction(a: any): a is RuleFunction {
  return (
    isFnAnd(a) || isFnEquals(a) || isFnNot(a) || isFnOr(a) || isConditionRef(a)
  );
}

/**
 * The optional Conditions section contains statements that define the circumstances under which entities are created or configured. For example, you can create a condition and then associate it with a resource or output so that AWS CloudFormation only creates the resource or output if the condition is true. Similarly, you can associate the condition with a property so that AWS CloudFormation only sets the property to a specific value if the condition is true. If the condition is false, AWS CloudFormation sets the property to a different value that you specify.
 *
 * You might use conditions when you want to reuse a template that can create resources in different contexts, such as a test environment versus a production environment. In your template, you can add an EnvironmentType input parameter, which accepts either prod or test as inputs. For the production environment, you might include Amazon EC2 instances with certain capabilities; however, for the test environment, you want to use reduced capabilities to save money. With conditions, you can define which resources are created and how they're configured for each environment type.
 *
 * Conditions are evaluated based on predefined pseudo parameters or input parameter values that you specify when you create or update a stack. Within each condition, you can reference another condition, a parameter value, or a mapping. After you define all your conditions, you can associate them with resources and resource properties in the Resources and Outputs sections of a template.
 *
 * At stack creation or stack update, AWS CloudFormation evaluates all the conditions in your template before creating any resources. Resources that are associated with a true condition are created. Resources that are associated with a false condition are ignored. AWS CloudFormation also re-evaluates these conditions at each stack update before updating any resources. Resources that are still associated with a true condition are updated. Resources that are now associated with a false condition are deleted.
 *
 * All {@link RuleFunctions} are not supported by {@link Condition} in the CloudFormation spec. Only {@link ConditionFunction}s are.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/conditions-section-structure.html
 */
export interface Conditions {
  [logicalId: string]: RuleFunction;
}
