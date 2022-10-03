---
sidebar_position: 0
---

# Setup

Functionless requires a few pre-requisite setup steps to ensure your environment is ready to build and deploy the code you write as infrastructure to AWS.

:::tip

**Need Help?**

Setting up an AWS Account to use with Functionless can be daunting if you don't have familiarity with AWS.
If you get stuck, [please don't hesitate to reach out in discord.][getting-help]

:::

## Install AWS CLI

This step is not required, but strongly recommended for ensuring your environment is properly configured.

[Install the AWS CLI.][install-aws-cli]

## Configure AWS Access

Functionless requires programmatic access to an AWS account in order to deploy infrastructure.

If you have already configured AWS credentials in your environment and have installed the CLI you can run the following command to verify your configuration:

```
aws sts get-caller-identity
```

A properly configured environment should return a response that resembles the one below:

```
{
    "UserId": "AROARW263FM7VAUNXAAAZ:tyler",
    "Account": "<redacted>",
    "Arn": "arn:aws:sts::<redacted>:assumed-role/AWSReservedSSO_AdministratorAccess_2a2b5abe213c74ad/tyler"
}
```

If your environment is missing credentials you will see the following response:

```
Unable to locate credentials. You can configure credentials by running "aws configure".
```

The most straightforward way to setup credentials is to follow [Amazon's guide on configuring a user through the console.][configuring-a-user]

Save the values for your Access Key ID and AWS Access Secret as you will need them when running `aws configure`:

```
aws configure
```

```
AWS Access Key ID [None]: <Your AWS Access Key ID>
AWS Secret Access Key [None]: <Your AWS Secret Access Key>
Default region name [None]: us-east-1
Default output format [None]:
```

After configuring AWS, you can verify your configuration by running `aws sts get-caller-identity` again and checking the output matches the expected output from above.

## Bootstrap CDK

Functionless is built on top of [AWS CDK][aws-cdk] and requires CDK to be bootstrapped in the target AWS Account in order to deploy.
CDK ships with a CLI that is published to npm.

```
npm install -g aws-cdk
```

The following command is used to bootstrap an AWS Account with CDK.
The value for `AWS_ACCOUNT_ID` can be obtained from the output of `aws sts get-caller-identity`, as shown above.

```
cdk bootstrap aws://<AWS_ACCOUNT_ID>/us-east-1
```

If bootstrapping is successful, you should see the following output:

```
 ⏳  Bootstrapping environment aws://<redacted>/us-east-1...
Trusted accounts for deployment: (none)
Trusted accounts for lookup: (none)
Using default execution policy of 'arn:aws:iam::aws:policy/AdministratorAccess'. Pass '--cloudformation-execution-policies' to customize.
CDKToolkit: creating CloudFormation changeset...
 ✅  Environment aws://<redacted>/us-west-1 bootstrapped.
```

Bootstrapping is a deep topic and allows for more complicated multi-account topologies.
[You can read more about bootstrapping][bootstrapping] in CDK's documentation.

Now that your AWS Account is configured, [you're ready to create your first Functionless project](./create-new-project)!

[getting-help]: https://discord.com/invite/VRqHbjrbfC
[install-aws-cli]: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
[configuring-a-user]: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html#id_users_create_console
[aws-cdk]: https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html
[bootstrapping]: https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html
