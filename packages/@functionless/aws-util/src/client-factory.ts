import STS from "aws-sdk/clients/sts";
import type { Credentials, CredentialsOptions } from "aws-sdk/lib/credentials";
import { getClientProps } from "./credentials";
import IAM from "aws-sdk/clients/iam";
import path from "path";

export type AWSClientConstructor = new (props?: {
  credentials: Credentials | CredentialsOptions | null;
}) => any;

export type TargetClientData =
  | { target: "local"; roleArn: string }
  | { target: "synth" };
/**
 * Create a client based on context. Local one will assume role first
 * @param context
 * @param clss
 * @returns
 */
export async function createTargetClient<
  ClientClass extends AWSClientConstructor
>(
  clss: ClientClass,
  targetClientData: TargetClientData
): Promise<InstanceType<ClientClass>> {
  return targetClientData.target === "local"
    ? createLocalClient(targetClientData.roleArn, clss)
    : new clss();
}

const iam = new IAM(getClientProps());
const sts = new STS(getClientProps());

export async function createLocalClient<
  ClientClass extends AWSClientConstructor
>(roleArn: string, clss: ClientClass): Promise<InstanceType<ClientClass>> {
  const role = await assumeRole(roleArn);
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

async function assumeRole(roleArn: string): Promise<STS.AssumeRoleResponse> {
  const roleName = path.basename(roleArn);
  const [role, whoami] = await Promise.all([
    iam.getRole({ RoleName: roleName }).promise(),
    sts.getCallerIdentity().promise(),
  ] as const);

  const assumeRolePolicyDocument: {
    Version: string;
    Statement: {
      Action: string;
      Effect: string;
      Principal: {
        Service?: string;
        AWS?: string;
      };
    }[];
  } = JSON.parse(decodeURIComponent(role.Role.AssumeRolePolicyDocument!));

  const existing = assumeRolePolicyDocument.Statement?.find(
    (stmt) => whoami.Arn && stmt.Principal.AWS === whoami.Arn
  );
  if (!existing) {
    assumeRolePolicyDocument.Statement.push({
      Action: "sts:AssumeRole",
      Effect: "Allow",
      Principal: {
        AWS: whoami.Arn,
      },
    });

    await iam
      .updateAssumeRolePolicy({
        RoleName: roleName,
        PolicyDocument: JSON.stringify(assumeRolePolicyDocument),
      })
      .promise();
  }

  return retryOnError(
    () =>
      sts
        .assumeRole({
          RoleArn: roleArn,
          RoleSessionName: "FL_LOCAL",
        })
        .promise(),
    (err) => err.code === "AccessDeniedException",
    100
  );
}

function setTimeoutPromise(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function retryOnError<T>(
  fn: () => Promise<T>,
  retry: (err: any) => boolean,
  waitTime: number
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retry(err)) {
      console.log(`waiting ${waitTime}ms to retry`);
      await setTimeoutPromise(waitTime);
      return retryOnError(fn, retry, Math.min(waitTime * 1.5, 10 * 1000));
    } else {
      throw err;
    }
  }
}
