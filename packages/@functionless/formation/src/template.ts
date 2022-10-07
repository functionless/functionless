import { Conditions } from "./condition";
import { Mappings } from "./mapping";
import { Metadata } from "./metadata";
import { Outputs } from "./output";
import { Parameters } from "./parameter";
import { Resources } from "./resource";
import { Rules } from "./rule";
// @ts-ignore - imported for ts-doc
import type { Stack } from "./stack";
import { Transform } from "./transform";

export interface CloudFormationTemplate {
  readonly AWSTemplateFormatVersion: "2010-09-09";
  readonly Description?: string;
  /**
   * You can use the optional Metadata section to include arbitrary JSON or YAML objects that provide details about the template.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/metadata-section-structure.html
   */
  readonly Metadata?: Metadata;
  /**
   * Use the optional Parameters section to customize your templates. Parameters enable you to input custom values to your template each time you create or update a stack.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html
   */
  readonly Parameters?: Parameters;
  /**
   * The optional Rules section validates a parameter or a combination of parameters passed to a template during a stack creation or stack update. To use template rules, explicitly declare Rules in your template followed by an assertion. Use the rules section to validate parameter values before creating or updating resources.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/rules-section-structure.html
   */
  readonly Rules?: Rules;
  /**
   * The optional Mappings section matches a key to a corresponding set of named values. For example, if you want to set values based on a region, you can create a mapping that uses the region name as a key and contains the values you want to specify for each specific region. You use the Fn::FindInMap intrinsic function to retrieve values in a map.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/mappings-section-structure.html
   */
  readonly Mappings?: Mappings;
  /**
   * The optional Conditions section contains statements that define the circumstances under which entities are created or configured. For example, you can create a condition and then associate it with a resource or output so that AWS CloudFormation only creates the resource or output if the condition is true. Similarly, you can associate the condition with a property so that AWS CloudFormation only sets the property to a specific value if the condition is true. If the condition is false, AWS CloudFormation sets the property to a different value that you specify.
   *
   * You might use conditions when you want to reuse a template that can create resources in different contexts, such as a test environment versus a production environment. In your template, you can add an EnvironmentType input parameter, which accepts either prod or test as inputs. For the production environment, you might include Amazon EC2 instances with certain capabilities; however, for the test environment, you want to use reduced capabilities to save money. With conditions, you can define which resources are created and how they're configured for each environment type.
   *
   * Conditions are evaluated based on predefined pseudo parameters or input parameter values that you specify when you create or update a stack. Within each condition, you can reference another condition, a parameter value, or a mapping. After you define all your conditions, you can associate them with resources and resource properties in the Resources and Outputs sections of a template.
   *
   * At stack creation or stack update, AWS CloudFormation evaluates all the conditions in your template before creating any resources. Resources that are associated with a true condition are created. Resources that are associated with a false condition are ignored. AWS CloudFormation also re-evaluates these conditions at each stack update before updating any resources. Resources that are still associated with a true condition are updated. Resources that are now associated with a false condition are deleted.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/conditions-section-structure.html
   */
  readonly Conditions?: Conditions;
  /**
   * The optional Transform section specifies one or more macros that AWS CloudFormation uses to process your template. The Transform section builds on the simple, declarative language of AWS CloudFormation with a powerful macro system.
   *
   * You can declare one or more macros within a template. AWS CloudFormation executes macros in the order that they're specified. When you create a change set, AWS CloudFormation generates a change set that includes the processed template content. You can then review the changes and execute the change set. For more information, see Using AWS CloudFormation macros to perform custom processing on templates.
   *
   * AWS CloudFormation also supports transforms, which are macros hosted by AWS CloudFormation. AWS CloudFormation treats these transforms the same as any macros you create in terms of execution order and scope. For detailed information regarding specific transforms, see Transform reference.
   *
   * To declare multiple macros, use a list format and specify one or more macros.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/transform-section-structure.html
   */
  readonly Transform?: Transform;
  /**
   * The required Resources section declares the AWS resources that you want to include in the stack, such as an Amazon EC2 instance or an Amazon S3 bucket.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resources-section-structure.html
   */
  readonly Resources: Resources;
  /**
   * Output values from a {@link Stack}.
   *
   * The optional {@link Outputs} section declares output values that you can import into other {@link Stack}s (to create cross-stack references),
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html
   */
  readonly Outputs?: Outputs;
}
