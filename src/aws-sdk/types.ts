import type { Service as AWSService } from "aws-sdk";
// eslint-disable-next-line import/no-extraneous-dependencies
import type * as AWS from "aws-sdk";
import type { AnyFunction } from "../util";

type Mixin<T> = T;

/**
 * The public SDK interface.
 */
export interface SDK
  extends Mixin<{
    [K in keyof typeof AWS as typeof AWS[K] extends new () => infer Client
      ? Client extends AWSService
        ? K extends "Service"
          ? never
          : K
        : never
      : never]: typeof AWS[K] extends new () => infer Client
      ? Client extends AWSService
        ? SDKClient<Client>
        : never
      : never;
  }> {}

/**
 * First we have to extract the names of all Services in the v2 AWS namespace
 *
 * @returns "AccessAnalyzer" | "Account" | ... | "XRay"
 */
export type ServiceKeys = keyof SDK;

/**
 * A client with only valid methods to their SDK Methods.
 */
export type SDKClient<Client extends AWSService> = Mixin<{
  [methodName in keyof Client]: SdkMethod<Client[methodName]>;
}>;

export interface SdkCallOptions {
  /**
   * Information needed to construct/customize the iam policy generated for the SDK call
   */
  iam: {
    /**
     * The resources for the IAM statement that will be added to the state machine
     * role's policy to allow the state machine to make the API call.
     *
     * Use `["*"]` to grant access to all resources (discouraged).
     *
     * @example ["arn:aws:s3:::my_bucket"]
     * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_resource.html
     */
    resources: [string, ...string[]];

    /**
     * The action for the IAM statement that will be added to the state machine role's
     * policy to allow the state machine to make the API call.
     *
     * By default the action is inferred from the API call (e.g. `$AWS.SDK.CloudWatch.describeAlarms({})` results in `cloudwatch:DescribeAlarms`)
     *
     * Use in the case where the IAM action name does not match with the API service/action name
     * e.g. `s3:ListBuckets` requires `s3:ListAllMyBuckets`.
     *
     * To see which action to use with which service/method see the {@link https://docs.aws.amazon.com/service-authorization/latest/reference/reference_policies_actions-resources-contextkeys.html | IAM Service Authorization Reference}
     *
     * @default service:method
     * @example s3:ListAllMyBuckets
     */
    actions?: string[];

    /**
     * The iam conditions to apply to the IAM Statement that will be added to the state machine role's
     * policy to allow the state machine to make the API call.
     *
     * By default no conditions are applied.
     *
     * For more information check out the {@link https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html | IAM User Guide}
     *
     * @example
     * ```
     * {
     *   "StringEquals" : { "aws:username" : "johndoe" }
     * }
     * ```
     */
    conditions?: Record<string, any>;
  };

  /**
   * The service name to use in the ASL (Amazon States Language) definition of the SDK integration.
   * ```json
   * {
   *   "Type": "Task",
   *   "Resource": "arn:aws:states:::aws-sdk:${sdkIntegrationServiceName}:${methodName}"
   * }
   * ```
   *
   * By default the service name is lowercased (e.g. `$AWS.SDK.CloudWatch.describeAlarms` => `"arn:aws:states:::aws-sdk:cloudwatch:describeAlarms"`).
   * Some known special cases are also handled in {@link SDK_INTEGRATION_SERVICE_NAME}.
   *
   * To see which service name to use see the {@link https://docs.aws.amazon.com/step-functions/latest/dg/supported-services-awssdk.html#supported-services-awssdk-list | StepFunctions Developer Guide}
   */
  aslServiceName?: string;
}

/**
 * Influenced by: https://stackoverflow.com/questions/67760998/typescript-mapped-types-with-overload-functions
 */
export type SdkMethod<API> = API extends {
  (params: infer Input, cb: AnyFunction): AWS.Request<infer Output, any>;
  (cb: AnyFunction): any;
}
  ? (input: Input, options: SdkCallOptions) => Promise<Output>
  : never;
