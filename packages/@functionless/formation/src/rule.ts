import {
  FnAnd,
  FnContains,
  FnEachMemberEquals,
  FnEachMemberIn,
  FnEquals,
  FnIf,
  FnNot,
  FnOr,
  FnRefAll,
  FnValueOf,
  FnValueOfAll,
  isFnAnd,
  isFnContains,
  isFnEachMemberEquals,
  isFnEachMemberIn,
  isFnEquals,
  isFnIf,
  isFnNot,
  isFnOr,
  isFnRefAll,
  isFnValueOf,
  isFnValueOfAll,
} from "./function";
// @ts-ignore - improted for tsdoc
import { ParameterValues } from "./parameter";

/**
 * The optional {@link Rules} section validates a parameter or a combination of parameters passed to a template during a stack creation or stack update. To use template rules, explicitly declare {@link Rules} in your template followed by an assertion. Use the rules section to validate parameter values before creating or updating resources.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/rules-section-structure.html
 */
export interface Rules {
  [ruleId: string]: Rule;
}

/**
 * A {@link Rule} can include a {@link RuleFunction} property and must include an {@link Assertions} property. For each {@link RUle}, you can define only one {@link RuleFunction}. You can define one or more asserts within the Assertions property. If you don't define a {@link RuleFunction}, the {@link Rule}'s {@link Assertion}s always take effect.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/rules-section-structure.html#rules-specific-intrinsic-section-structure
 */
export interface Rule {
  /**
   * Describes what values users can specify for a particular {@link Parameter}.
   */
  Assertions: Assertion[];
  /**
   * Determines when a {@link Rule} takes effect.
   */
  RuleCondition?: RuleFunction;
}

/**
 * An {@link Assertion} applies a {@link RuleFunction} to the {@link Stack}'s {@link ParameterValues}.
 */
export interface Assertion {
  /**
   * A {@link RuleFunction} to validate the {@link ParameterValues} input to the {@link Stack}.
   */
  Assert: RuleFunction;
  /**
   * A custom description to output when {@link Assert} evaluates to `false`.
   *
   * @default - generic message derived from the Assertion.
   */
  AssertDescription?: string;
}

/**
 * A {@link RuleFunction} is an Intrinsic Function which evaluates to a Boolean value.
 *
 * {@link RuleFunction}s are used within {@link Rule}s and {@link Assertion}s during {@link Stack} deployment.
 *
 * @see {@link Rule}
 * @see {@link FnAnd}
 * @see {@link FnContains}
 * @see {@link FnEachMemberEquals}
 * @see {@link FnEachMemberIn}
 * @see {@link FnEquals}
 * @see {@link FnNot}
 * @see {@link FnOr}
 * @see {@link FnRefAll}
 * @see {@link FnValueOf}
 * @see {@link FnValueOfAll}
 */
export type RuleFunction =
  | FnAnd
  | FnContains
  | FnEachMemberEquals
  | FnEachMemberIn
  | FnEquals
  | FnIf // not actually in the CFN spec, but seems like no big deal to add it
  | FnNot
  | FnOr
  | FnRefAll
  | FnValueOf
  | FnValueOfAll;

export function isRuleFunction(a: any): a is RuleFunction {
  return (
    isFnAnd(a) ||
    isFnContains(a) ||
    isFnEachMemberEquals(a) ||
    isFnEachMemberIn(a) ||
    isFnEquals(a) ||
    isFnIf(a) || // not actually in the CFN spec, but seems like no big deal to add it
    isFnNot(a) ||
    isFnOr(a) ||
    isFnRefAll(a) ||
    isFnValueOf(a) ||
    isFnValueOfAll(a)
  );
}
