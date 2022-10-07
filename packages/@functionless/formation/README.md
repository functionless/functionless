# node-cfn

This is a toy-implementation of the AWS CloudFormation deployment engine in TypeScript and Node-JS. It was built as an experiment to better understand why CloudFormation is so slow and to also experiment locally with new features.

It is built on top of the [AWS Cloud Control API](https://aws.amazon.com/cloudcontrolapi/) and thus only supports the [resources that are supported by the Cloud Control API](https://docs.aws.amazon.com/cloudcontrolapi/latest/userguide/supported-resources.html).

The most important missing feature right now is Rollbacks, so this tool should not be considered useful for any type of production service. The hope is that it can become a playground for CloudFormation enhancements and to stand as a performance benchmark for the official AWS CloudFormation service. I dream of the day when CloudFormation is as fast as Terraform and Pulumi's provisioning engines.

## Supported Features

- [x] Stack Create, Update and Delete
- [x] Stack Parameters
- [x] Resource Conditions
- [x] Intrinsic Functions (`Ref`, `!Ref`, `Fn::GetAtt`, `Fn::Join`, `Fn::Split`, `Fn::Select`, `Fn::FindInMap`, `Fn::Sub`, etc.)
- [ ] Rollbacks on failure
- [ ] Outputs and cross-stack references
- [ ] Assets

## Usage

```ts
import { CloudFormationTemplate, Stack } from "node-cfn";

const deployer = new Stack({
  account: "<aws-account>",
  region: "<aws-region>",
  stackName: "my-stack",
});

const template: CloudFormationTemplate = {
  AWSTemplateFormatVersion: "2010-09-09",
  Parameters: {
    ShardCount: {
      Type: "Number",
      MinValue: 1,
    },
  },
  Resources: {
    MyStream: {
      Type: "AWS::Kinesis::Stream",
      Properties: {
        Name: "MyKinesisStream",
        RetentionPeriodHours: 168,
        ShardCount: {
          Ref: "ShardCount",
        },
        Tags: [
          {
            Key: "Environment",
            Value: "Production",
          },
        ],
      },
    },
  },
};

let state = await deployer.updateStack(template, {
  ShardCount: 1,
});

state = await deployer.updateStack(newState);
```
