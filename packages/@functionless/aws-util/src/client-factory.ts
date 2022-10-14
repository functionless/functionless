import STS from "aws-sdk/clients/sts";
import type { Credentials, CredentialsOptions } from "aws-sdk/lib/credentials";
import { memoize } from "@functionless/util";
import { getClientProps } from "./credentials";

export function createClientFactory<
  ClientClass extends new (props: {
    credentials?: Credentials | CredentialsOptions | null;
  }) => any
>(clss: ClientClass): (roleArn?: string) => Promise<InstanceType<ClientClass>> {
  return memoize(async (roleArn?: string) => {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    if (process.env.FL_LOCAL && roleArn) {
      return createLocalClient(roleArn, clss);
    } else {
      return new clss({});
    }
  });
}

export async function createLocalClient<
  ClientClass extends new (props: {
    credentials: Credentials | CredentialsOptions | null;
  }) => any
>(roleArn: string, clss: ClientClass): Promise<InstanceType<ClientClass>> {
  const sts = new STS(getClientProps());
  const role = await sts
    .assumeRole({
      RoleArn: roleArn,
      RoleSessionName: "FL_LOCAL",
    })
    .promise();
  return new clss({
    credentials: {
      accessKeyId: role.Credentials?.AccessKeyId!,
      secretAccessKey: role.Credentials?.SecretAccessKey!,
      expireTime: role.Credentials?.Expiration!,
      sessionToken: role.Credentials?.SessionToken!,
      expired: false,
    },
  });
}

// @ts-ignore
const deploymentOnlyModule = true;
