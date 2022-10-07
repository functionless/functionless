import { deepStrictEqual } from "assert";
import { Value } from "./value";

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html
 */
export interface Parameters {
  [parameterName: string]: Parameter;
}

/**
 * Input values for {@link Parameters}.
 */
export interface ParameterValues {
  [parameterName: string]: Value;
}

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html#parameters-section-structure-properties-type
 */
export interface Parameter {
  /**
   * The data type for the parameter (DataType).
   */
  Type: ParameterType;
  /**
   * A regular expression that represents the patterns to allow for `String` types. The pattern must match the entire parameter value provided.
   */
  AllowedPattern?: string;
  /**
   * An array containing the list of values allowed for the parameter.
   */
  AllowedValues?: string[];
  /**
   * A string that explains a constraint when the constraint is violated. For example, without a constraint description, a parameter that has an allowed pattern of [A-Za-z0-9]+ displays the following error message when the user specifies an invalid value:
   *
   * Malformed input-Parameter MyParameter must match pattern `[A-Za-z0-9]+`
   *
   * By adding a constraint description, such as must only contain letters (uppercase and lowercase) and numbers, you can display the following customized error message:
   *
   * Malformed input-Parameter MyParameter must only contain uppercase and lowercase letters and numbers
   */
  ConstraintDescription?: string;
  /**
   * A value of the appropriate type for the template to use if no value is specified when a stack is created. If you define constraints for the parameter, you must specify a value that adheres to those constraints.
   */
  Default?: string;
  /**
   * A string of up to 4000 characters that describes the parameter.
   */
  Description?: string;
  /**
   * An integer value that determines the largest number of characters you want to allow for String types.
   */
  MaxLength?: number;
  /**
   * A numeric value that determines the largest numeric value you want to allow for Number types.
   */
  MaxValue?: number;
  /**
   * An integer value that determines the smallest number of characters you want to allow for String types.
   */
  MinLength?: number;
  /**
   * A numeric value that determines the smallest numeric value you want to allow for Number types.
   */
  MinValue?: number;
  /**
   * Whether to mask the parameter value to prevent it from being displayed in the console, command line tools, or API. If you set the NoEcho attribute to true, CloudFormation returns the parameter value masked as asterisks (*****) for any calls that describe the stack or stack events, except for information stored in the locations specified below.
   */
  NoEcho?: boolean;
}

/**
 * Validate the value of a {@link Parameter} against its type definition.
 *
 * @param paramName name of the {@link Parameter}
 * @param paramDef the {@link Parameter} definition (defined the template).
 * @param paramVal the input value of the {@link Parameter}.
 */
export function validateParameter(
  paramName: string,
  paramDef: Parameter,
  paramVal: Value
) {
  const type = paramDef.Type;

  if (paramVal === undefined) {
    if (paramDef.Default === undefined) {
      throw new Error(`Missing required input-Parameter ${paramName}`);
    }
    paramVal = paramDef.Default;
  }

  if (paramDef.AllowedPattern) {
    const regex = new RegExp(paramDef.AllowedPattern);
    if (typeof paramVal !== "string") {
      throw new Error(
        `Can only evaluted AllowedPattern against String values, but '${paramName}' was a '${typeof paramVal}'`
      );
    } else if (paramVal.match(regex) === null) {
      throw new Error(
        describeConstraint(`must match pattern ${paramDef.AllowedPattern}`)
      );
    }
  }

  if (paramDef.AllowedValues) {
    let found: boolean = false;
    if (paramDef.AllowedValues.length === 0) {
      throw new Error(
        `AllowedValues for parameter '${paramName}' must have at least one item.`
      );
    }
    for (const allowedValue of paramDef.AllowedValues) {
      try {
        deepStrictEqual(paramVal, allowedValue);
        found = true;
        break;
      } catch (err) {
        // swallow
      }
    }
    if (!found) {
      throw new Error(
        describeConstraint(
          `must contain one of the AllowedValues [${paramDef.AllowedValues.map(
            (v) => JSON.stringify(v)
          ).join(", ")}]`
        )
      );
    }
  }

  validateLength("MaxLength");
  validateLength("MinLength");

  if (
    (type === "String" ||
      type === "CommaDelimitedList" ||
      type === "List<Number>") &&
    typeof paramVal !== "string"
  ) {
    throw new Error(
      `Malformed input-Parameter ${paramName} must be a String but was ${typeof paramVal}`
    );
  } else if (type === "Number" && typeof paramVal !== "number") {
    throw new Error(
      `Malformed input-Parameter ${paramName} must be a Number but was ${typeof paramVal}`
    );
  } else if (type === "List<Number>") {
    const numbers = paramVal?.toString().split(",")!;
    for (const number of numbers) {
      try {
        parseInt(number, 10);
      } catch (err) {
        throw new Error(
          `Malformed input-Parameter ${paramName} must be a List<Number> but encountered value '${number}'`
        );
      }
    }
  } else if (type.startsWith("List<AWS::") && !Array.isArray(paramVal)) {
    throw new Error(
      `Malformed input-Parameter must be a ${type} but was ${typeof paramVal}`
    );
  } else if (type.startsWith("AWS::") && typeof paramVal !== "string") {
    throw new Error(
      `Malformed input-Parameter must be a String referring to a ${type} but was ${typeof paramVal}`
    );
  }

  if (
    type.startsWith("AWS::EC2") ||
    type.startsWith("AWS::Route53") ||
    type.startsWith("List<AWS::EC2") ||
    type.startsWith("List<AWS::Route53")
  ) {
    // TODO: validate these rules:
    // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html#aws-specific-parameter-types
  }
  function validateLength(kind: "MaxLength" | "MinLength") {
    const constraint = paramDef[kind];
    if (constraint === undefined) {
      return;
    }
    if (constraint) {
      if (type !== "String") {
        throw new Error(
          `${kind} is only supported for String types, but was configured for ${paramName}: ${type}`
        );
      } else if (typeof paramVal !== "string") {
        throw new Error(
          `${kind} is only supported for String values, but ${paramName} evaluated to ${typeof paramVal}`
        );
      } else if (
        (kind === "MaxLength" && paramVal.length > constraint) ||
        (kind === "MinLength" && paramVal.length < constraint)
      ) {
        throw new Error(
          describeConstraint(
            `must have a ${kind} length of ${constraint}, but was ${paramVal.length}`
          )
        );
      }
    }
  }

  function describeConstraint(description = paramDef?.ConstraintDescription) {
    return `Malformed input-Parameter ${paramName} ${description}`;
  }
}

export type ParameterType =
  | PrimitiveParameterType
  | AwsParameterType
  | SSMParameterType;

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html#parameters-section-structure-properties-type
 */
export type PrimitiveParameterType =
  /**
   * A literal string.
   *
   * For example, users could specify "MyUserName".
   */
  | "String"
  /**
   * An integer or float. AWS CloudFormation validates the parameter value as a number; however, when you use the parameter elsewhere in your template (for example, by using the Ref intrinsic function), the parameter value becomes a string.
   *
   * For example, users could specify `"8888"`
   */
  | "Number"
  /**
   * An array of integers or floats that are separated by commas. AWS CloudFormation validates the parameter value as numbers; however, when you use the parameter elsewhere in your template (for example, by using the Ref intrinsic function), the parameter value becomes a list of strings.
   *
   * For example, users could specify `"80,20"`, and a Ref would result in `["80","20"]`.
   */
  | "List<Number>"
  /**
   * An array of literal strings that are separated by commas. The total number of strings should be one more than the total number of commas. Also, each member string is space trimmed.
   *
   * For example, users could specify `"test,dev,prod"`, and a Ref would result in `["test","dev","prod"]`.
   */
  | "CommaDelimitedList";

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html#aws-specific-parameter-types
 */
export type AwsParameterType =
  /**
   * An Availability Zone, such as us-west-2a.
   */
  | "AWS::EC2::AvailabilityZone::Name"
  /**
   * An Amazon EC2 image ID, such as ami-0ff8a91507f77f867. Note that the AWS CloudFormation console doesn't show a drop-down list of values for this parameter type.
   */
  | "AWS::EC2::Image::Id"
  /**
   * An Amazon EC2 instance ID, such as i-1e731a32.
   */
  | "AWS::EC2::Instance::Id"
  /**
   * An Amazon EC2 key pair name.
   */
  | "AWS::EC2::KeyPair::KeyName"
  /**
   * An EC2-Classic or default VPC security group name, such as my-sg-abc.
   */
  | "AWS::EC2::SecurityGroup::GroupName"
  /**
   * A security group ID, such as sg-a123fd85.
   */
  | "AWS::EC2::SecurityGroup::Id"
  /**
   * A subnet ID, such as subnet-123a351e.
   */
  | "AWS::EC2::Subnet::Id"
  /**
   * An Amazon EBS volume ID, such as vol-3cdd3f56.
   */
  | "AWS::EC2::Volume::Id"
  /**
   * A VPC ID, such as vpc-a123baa3.
   */
  | "AWS::EC2::VPC::Id"
  /**
   * An Amazon Route 53 hosted zone ID, such as Z23YXV4OVPL04A.
   */
  | "AWS::Route53::HostedZone::Id"
  /**
   * An array of Availability Zones for a region, such as us-west-2a, us-west-2b.
   */
  | "List<AWS::EC2::AvailabilityZone::Name>"
  /**
   * An array of Amazon EC2 image IDs, such as ami-0ff8a91507f77f867, ami-0a584ac55a7631c0c. Note that the AWS CloudFormation console doesn't show a drop-down list of values for this parameter type.
   */
  | "List<AWS::EC2::Image::Id>"
  /**
   * An array of Amazon EC2 instance IDs, such as i-1e731a32, i-1e731a34.
   */
  | "List<AWS::EC2::Instance::Id>"
  /**
   * An array of EC2-Classic or default VPC security group names, such as my-sg-abc, my-sg-def.
   */
  | "List<AWS::EC2::SecurityGroup::GroupName>"
  /**
   * An array of security group IDs, such as sg-a123fd85, sg-b456fd85.
   */
  | "List<AWS::EC2::SecurityGroup::Id>"
  /**
   * An array of subnet IDs, such as subnet-123a351e, subnet-456b351e.
   */
  | "List<AWS::EC2::Subnet::Id>"
  /**
   * An array of Amazon EBS volume IDs, such as vol-3cdd3f56, vol-4cdd3f56.
   */
  | "List<AWS::EC2::Volume::Id>"
  /**
   * An array of VPC IDs, such as vpc-a123baa3, vpc-b456baa3.
   */
  | "List<AWS::EC2::VPC::Id>"
  /**
   * An array of Amazon Route 53 hosted zone IDs, such as Z23YXV4OVPL04A, Z23YXV4OVPL04B.
   */
  | "List<AWS::Route53::HostedZone::Id>";

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html#aws-ssm-parameter-types
 */
export type SSMParameterType =
  /**
   * The name of a Systems Manager parameter key.
   */
  | "AWS::SSM::Parameter::Name"
  /**
   * Use this parameter when you want to pass the parameter key. For example, you can use this type to validate that the parameter exists.
   */
  | "AWS::SSM::Parameter::Value<String>"
  /**
   * A Systems Manager parameter whose value is a string. This corresponds to the String parameter type in Parameter Store.
   */
  | "AWS::SSM::Parameter::Value<List<String>>"
  /**
   * A Systems Manager parameter whose value is a string. This corresponds to the String parameter type in Parameter Store.
   */
  | "AWS::SSM::Parameter::Value<CommaDelimitedList>"
  /**
   * A Systems Manager parameter whose value is a list of strings. This corresponds to the StringList parameter type in Parameter Store.
   */
  | `AWS::SSM::Parameter::Value<${AwsParameterType}>`
  /**
   * A Systems Manager parameter whose value is an AWS-specific parameter type. For example, the following specifies the AWS::EC2::KeyPair::KeyName type:
   */
  | "AWS::SSM::Parameter::Value<AWS::EC2::KeyPair::KeyName>"
  //
  | `AWS::SSM::Parameter::Value<List<${AwsParameterType}>>`
  // A Systems Manager parameter whose value is a list of AWS-specific parameter types. For example, the following specifies a list of AWS::EC2::KeyPair::KeyName types:
  | "AWS::SSM::Parameter::Value<List<AWS::EC2::KeyPair::KeyName>>";

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
  | "AWS::URLSuffix ";
