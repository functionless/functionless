import type { Expression } from "./expression";
import type { AwsParameterType, Parameters } from "./parameter";
import { RuleFunction } from "./rule";
import { guard } from "./util";

// TODO: Support Condition (!Condition)
// TODO: Support new intrinsic functions (AWS::LanguageExtensions): ToJsonString, Length
export function isIntrinsicFunction(a: any): a is IntrinsicFunction {
  return (
    isFnBase64(a) ||
    isFnCidr(a) ||
    isFnFindInMap(a) ||
    isFnGetAtt(a) ||
    isFnGetAZs(a) ||
    isFnIf(a) ||
    isFnImportValue(a) ||
    isFnJoin(a) ||
    isFnSelect(a) ||
    isFnSplit(a) ||
    isFnSub(a) ||
    isFnTransform(a) ||
    isRef(a)
  );
}

export type IntrinsicFunction =
  | FnBase64
  | FnCidr
  | FnFindInMap
  | FnGetAtt
  | FnGetAZs
  | FnImportValue
  | FnJoin
  | FnSelect
  | FnSplit
  | FnSub
  | FnTransform
  | Ref;

/**
 * Checks if the {@link expr} string is a short-hand {@link Ref} string.
 *
 * Example: "!Ref <id>".
 *
 * @param expr a string expression.
 * @returns true if the string starts with `"!Ref "`.
 */
export function isRefString(expr: string): boolean {
  return expr.startsWith("!Ref ");
}

/**
 * Parses the {@link expr} short-hand {@link Ref} string into a {@link Ref} data structure.
 *
 * @param expr a string expression.
 * @returns the expanded {@link Ref} data structure representation of the {@link expr}
 * @throws an Error if {@link expr} is not in the short-hand form.
 */
export function parseRefString(expr: string): Ref {
  if (!isRefString(expr)) {
    throw new Error(
      `the string "${expr}" is not in the form of a short-hand Ref, e.g. "!Ref <id>"`
    );
  }
  return {
    Ref: expr.substring("!Ref ".length),
  };
}

export const isRef = guard<Ref>("Ref");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-ref.html
 */
export interface Ref {
  Ref: string;
}

export const isFnGetAtt = guard<FnGetAtt>("Fn::GetAtt");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-getatt.html
 */
export interface FnGetAtt {
  "Fn::GetAtt": [logicalNameOfResource: string, attributeName: string];
}

export const isFnGetAZs = guard<FnGetAZs>("Fn::GetAZs");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-getavailabilityzones.html
 */
export interface FnGetAZs {
  "Fn::GetAZs": string;
}

export const isFnImportValue = guard<FnImportValue>("Fn::ImportValue");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-importvalue.html
 */
export interface FnImportValue {
  "Fn::ImportValue": Expression;
}

export const isFnJoin = guard<FnJoin>("Fn::Join");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-join.html
 */
export interface FnJoin {
  "Fn::Join": [delimiter: string, values: Expression[]];
}

export const isFnSelect = guard<FnSelect>("Fn::Select");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-select.html
 */
export interface FnSelect {
  "Fn::Select": [index: number, listOfObjects: Expression[]];
}

export const isFnSplit = guard<FnSplit>("Fn::Split");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-split.html
 */
export interface FnSplit {
  "Fn::Split": [delimiter: string, sourceString: Expression];
}

export const isFnSub = guard<FnSub>("Fn::Sub");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-sub.html
 */
export interface FnSub {
  "Fn::Sub": [string: string, variables: { [varName: string]: Expression }];
}

export const isFnTransform = guard<FnTransform>("Fn::Transform");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-transform.html
 */
export interface FnTransform {
  "Fn::Transform": {
    /**
     * The name of the macro you want to perform the processing.
     */
    Name: string;
    /**
     * The list parameters, specified as key-value pairs, to pass to the macro.
     */
    Parameters: Parameters;
  };
}

export const isFnBase64 = guard<FnBase64>("Fn::Base64");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-base64.html
 */
export interface FnBase64 {
  "Fn::Base64": Expression;
}

export const isFnCidr = guard<FnCidr>("Fn::Cidr");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-cidr.html
 */
export interface FnCidr {
  "Fn::Cidr": [
    // The user-specified CIDR address block to be split into smaller CIDR blocks.
    ipBlock: string,
    // The number of CIDRs to generate. Valid range is between 1 and 256.
    count: number,
    // The number of subnet bits for the CIDR. For example, specifying a value "8" for this parameter will create a CIDR with a mask of "/24".
    cidrBits: number
  ];
}

export const isFnFindInMap = guard<FnFindInMap>("Fn::FindInMap");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-findinmap.html
 */
export interface FnFindInMap {
  "Fn::FindInMap": [
    // The logical name of a mapping declared in the Mappings section that contains the keys and values.
    MapName: string,
    // The top-level key name. Its value is a list of key-value pairs.
    TopLevelKey: Expression,
    // The second-level key name, which is set to one of the keys from the list assigned to TopLevelKey.
    SecondLevelKey: Expression
  ];
}

export const isFnIf = guard<FnIf>("Fn::If");

/**
 * Returns one value if the specified condition evaluates to true and another value if the
 * specified condition evaluates to false. Currently, CloudFormation supports the {@link FnIf}
 * intrinsic function in the metadata attribute, update policy attribute, and property values
 * in the Resources section and Outputs sections of a template. You can use the {@link NoValue}
 * pseudo parameter as a return value to remove the corresponding property.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-conditions.html#intrinsic-function-reference-conditions-if
 */
export interface FnIf {
  "Fn::If": [
    /**
     * In AWS CloudFormation, this is required to be the string name of a Condition
     *
     * We support any {@link RuleFunction} which resolves to a boolean.
     *
     * If this is a raw `string`, we will treat it as a reference to a {@link ConditionExpression}
     */
    condition: string | RuleFunction,
    exprTrue: Expression,
    exprFalse: Expression
  ];
}

export const isFnContains = guard<FnContains>("Fn::Contains");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-rules.html#fn-contains
 */
export interface FnContains {
  "Fn::Contains": [
    // A list of strings, such as "A", "B", "C"
    list_of_strings: Expression[],
    // A string, such as "A", that you want to compare against a list of strings.
    string: Expression
  ];
}

export const isFnEachMemberEquals = guard<FnEachMemberEquals>(
  "Fn::EachMemberEquals"
);

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-rules.html#fn-eachmemberequals
 */
export interface FnEachMemberEquals {
  "Fn::EachMemberEquals": [
    // A list of strings, such as "A", "B", "C".
    list_of_strings: Expression[],
    // A string, such as "A", that you want to compare against a list of strings.
    string: Expression
  ];
}

export const isFnEachMemberIn = guard<FnEachMemberIn>("Fn::EachMemberIn");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-rules.html#fn-eachmemberin
 */
export interface FnEachMemberIn {
  "Fn::EachMemberIn": [
    // A list of strings, such as "A", "B", "C". CloudFormation checks whether each member in the strings_to_check parameter is in the strings_to_match parameter.
    strings_to_check: Expression[],
    // A list of strings, such as "A", "B", "C". Each member in the strings_to_match parameter is compared against the members of the strings_to_check parameter.
    strings_to_match: Expression[]
  ];
}

export const isFnRefAll = guard<FnRefAll>("Fn::RefAll");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-rules.html#fn-refall
 */
export interface FnRefAll {
  /**
   * An AWS-specific parameter type, such as AWS::EC2::SecurityGroup::Id or AWS::EC2::VPC::Id. For more information, see {@link AwsParameterType}.
   */
  "Fn::RefAll": AwsParameterType;
}

export const isFnValueOf = guard<FnValueOf>("Fn::ValueOf");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-rules.html#fn-valueof
 */
export interface FnValueOf {
  "Fn::ValueOf": [
    // The name of a parameter for which you want to retrieve attribute values. The parameter must be declared in the Parameters section of the template.
    parameter_logical_id: string,
    // The name of an attribute from which you want to retrieve a value. For more information about attributes, see Supported Attributes.
    attribute: Expression
  ];
}

export const isFnValueOfAll = guard<FnValueOfAll>("Fn::ValueOfAll");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-rules.html#fn-valueofall
 */
export interface FnValueOfAll {
  "Fn::ValueOfAll": [parameter_type: string, attribute: Expression];
}
