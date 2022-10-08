import { Account, ClientOptions, IAws } from "cdk-assets";
import s3_v2 from "aws-sdk/clients/s3";
import secrets_manager_v2 from "aws-sdk/clients/secretsmanager";
import ecr_v2 from "aws-sdk/clients/ecr";
import sts from "@aws-sdk/client-sts";
import * as os from "os";
import { ChainableTemporaryCredentials, Credentials } from "aws-sdk";

export default class AwsClient implements IAws {
  constructor(
    private account: string,
    private region: string,
    private sdkConfig?: any
  ) {}

  async discoverPartition(): Promise<string> {
    return "aws";
  }
  async discoverDefaultRegion(): Promise<string> {
    return this.region;
  }
  async discoverCurrentAccount(): Promise<Account> {
    return {
      accountId: this.account,
      partition: await this.discoverPartition(),
    };
  }
  async discoverTargetAccount(options: ClientOptions): Promise<Account> {
    const stsClient = await this.stsClient(await this.awsOptions(options));
    const response = await stsClient.send(new sts.GetCallerIdentityCommand({}));
    if (!response.Account || !response.Arn) {
      throw new Error(
        `Unrecognized response from STS: '${JSON.stringify(response)}'`
      );
    }
    return {
      accountId: response.Account!,
      partition: response.Arn!.split(":")[1]!,
    };
  }
  async s3Client(options: ClientOptions): Promise<s3_v2> {
    return new s3_v2(options);
  }
  async stsClient(options: ClientOptions): Promise<sts.STSClient> {
    return new sts.STSClient(options);
  }
  async ecrClient(options: ClientOptions): Promise<ecr_v2> {
    return new ecr_v2(options);
  }
  async secretsManagerClient(
    options: ClientOptions
  ): Promise<secrets_manager_v2> {
    return new secrets_manager_v2(await this.awsOptions(options));
  }
  async awsOptions(options: ClientOptions) {
    let credentials;
    if (options.assumeRoleArn) {
      credentials = await this.assumeRole(
        options.region,
        options.assumeRoleArn,
        options.assumeRoleExternalId
      );
    }
    return {
      ...this.sdkConfig,
      region: options.region,
      customUserAgent: "formation",
      credentials,
    };
  }
  /**
   * Explicit manual AssumeRole call
   *
   * Necessary since I can't seem to get the built-in support for ChainableTemporaryCredentials to work.
   *
   * It needs an explicit configuration of `masterCredentials`, we need to put
   * a `DefaultCredentialProverChain()` in there but that is not possible.
   */
  async assumeRole(
    region: string | undefined,
    roleArn: string,
    externalId?: string
  ): Promise<Credentials> {
    return new ChainableTemporaryCredentials({
      params: {
        RoleArn: roleArn,
        ExternalId: externalId,
        RoleSessionName: `formation-${safeUsername()}`,
      },
      stsConfig: {
        region,
        customUserAgent: "formation",
      },
    });
  }
}

/**
 * Return the username with characters invalid for a RoleSessionName removed
 *
 * @see https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#API_AssumeRole_RequestParameters
 */
function safeUsername() {
  try {
    return os.userInfo().username.replace(/[^\w+=,.@-]/g, "@");
  } catch (e) {
    return "noname";
  }
}
