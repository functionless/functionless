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
export interface Transform {}
