import type { PseudoParameterResolver } from "./resolve-template";
import type { Value } from "./value";

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html
 */
export type PseudoParameter =
  | "AWS::AccountId"
  | "AWS::NotificationARNs"
  | "AWS::NoValue"
  | "AWS::Partition"
  | "AWS::Region"
  | "AWS::StackId"
  | "AWS::StackName"
  | "AWS::URLSuffix";

/**
 * Generates a type assertion function for one or more {@link PseudoParameter}s.
 */
function assertIsPseudo<P extends PseudoParameter[]>(
  ...parameters: P
): (a: any) => a is P[number] {
  return (a: any): a is P[number] =>
    parameters.find((parameter) => parameter === a) !== undefined;
}

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html
 */
export const isPseudoParameter = assertIsPseudo(
  "AWS::AccountId",
  "AWS::NoValue",
  "AWS::NotificationARNs",
  "AWS::Partition",
  "AWS::Region",
  "AWS::StackId",
  "AWS::StackName",
  "AWS::URLSuffix"
);

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html#cfn-pseudo-param-accountid
 */
export const isAccountId = assertIsPseudo("AWS::AccountId");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html#cfn-pseudo-param-notificationarns
 */
export const isNotificationARNs = assertIsPseudo("AWS::NotificationARNs");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html#cfn-pseudo-param-novalue
 */
export const isNoValue = assertIsPseudo("AWS::NoValue");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html#cfn-pseudo-param-partition
 */
export const isPartition = assertIsPseudo("AWS::Partition");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html#cfn-pseudo-param-region
 */
export const isRegion = assertIsPseudo("AWS::Region");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html#cfn-pseudo-param-stackid
 */
export const isStackId = assertIsPseudo("AWS::StackId");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html#cfn-pseudo-param-stackname
 */
export const isStackName = assertIsPseudo("AWS::StackName");

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html#cfn-pseudo-param-urlsuffix
 */
export const isURLSuffix = assertIsPseudo("AWS::URLSuffix");

export interface DefaultPseudoParameterResolverProps {
  account: string;
  region: string;
  stackName: string;
}

export class DefaultPseudoParameterResolver implements PseudoParameterResolver {
  constructor(private props: DefaultPseudoParameterResolverProps) {}
  resolve(expr: PseudoParameter): Value {
    if (expr === "AWS::AccountId") {
      return this.props.account;
    } else if (expr === "AWS::NoValue") {
      return null;
    } else if (expr === "AWS::Region") {
      return this.props.region;
    } else if (expr === "AWS::Partition") {
      // gov regions are not supported
      return "aws";
    } else if (expr === "AWS::NotificationARNs") {
      // don't yet support sending notifications to SNS
      // on top of supporting this, we could also provide native JS hooks into the engine
      return [];
    } else if (expr === "AWS::StackId") {
      return this.props.stackName;
    } else if (expr === "AWS::StackName") {
      return this.props.stackName;
    } else {
      throw new Error(`unsupported Pseudo Parameter '${expr}'`);
    }
  }
}
