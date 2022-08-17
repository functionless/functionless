import { aws_secretsmanager } from "aws-cdk-lib";
import type AWS from "aws-sdk";
import { Construct } from "constructs";
import { NativePreWarmContext, PrewarmClients } from "./function-prewarm";
import { makeIntegration } from "./integration";

export interface SecretProps<SecretData = any>
  extends aws_secretsmanager.SecretProps {
  /**
   * When true, the {@link SecretData} will be serialized to/from JSON.
   *
   * @default true
   */
  storeAsJson?: SecretData extends string ? false : boolean;
}

/**
 * @returns `true` of {@link a} is a {@link Secret}, otherwise `false`.
 */
export function isSecret(a: any): a is Secret {
  return a?.FunctionlessType === Secret.FunctionlessType;
}

/**
 * Securely stores secret data such as credentials and API keys in an AWS Secret.
 *
 * @see https://aws.amazon.com/secrets-manager/
 * @see {@link aws_secretsmanager.Secret}
 */
export class Secret<SecretData = any> {
  public static readonly FunctionlessType = "Secret";
  public readonly FunctionlessType = Secret.FunctionlessType;

  readonly resource: aws_secretsmanager.ISecret;
  readonly storeAsJson: boolean;

  /**
   * An Integration that stores a new value in the Secret.
   *
   * There are three ways to store secrets:
   * 1. Recommended - passing the strongly typed `SecretValue`
   *
   * For the best experience, we recommend strongly typing secret data and serializing to/from JSON.
   *
   * ```ts
   * interface UserPass {
   *   username: string;
   *   password: string;
   * }
   *
   * const secret = new Secret<UserPass>(scope, id);
   *
   * await secret.putSecretValue({
   *   SecretValue: {
   *     username: "sam"
   *     password: "my little pony"
   *   }
   * });
   * ```
   */
  public readonly putSecretValue;

  public readonly getJsonValue;

  /**
   * Get the
   */
  public readonly getValue;

  constructor(resource: aws_secretsmanager.ISecret);
  constructor(scope: Construct, id: string, props?: SecretProps);
  constructor(
    ...args:
      | [aws_secretsmanager.ISecret]
      | [scope: Construct, id: string, props?: SecretProps]
  ) {
    if (args.length === 1) {
      this.resource = args[0];
      this.storeAsJson = true;
    } else {
      const [scope, id, props] = args;
      this.resource = new aws_secretsmanager.Secret(scope, id, props);
      this.storeAsJson = props?.storeAsJson ?? true;
    }

    const storeAsJson = this.storeAsJson;
    const secretArn = this.resource.secretArn;

    this.putSecretValue = makeIntegration<
      "AWS.SecretsManager.PutSecretValue",
      (
        input: Omit<AWS.SecretsManager.PutSecretValueRequest, "SecretId"> & {
          /**
           * The secret in its JavaScript object form.
           *
           * It will be converted to JSON if {@link this.serializeJson}, otherwise it must be a string or Buffer.
           *
           * ```ts
           * secret.putSecretValue({
           *   // will serialize to a JSON object
           *   SecretValue: {
           *     shh: "don't tell anyone about this secret"
           *   }
           * });
           * ```
           */
          SecretValue?: SecretData;
        }
      ) => Promise<
        AWS.SecretsManager.PutSecretValueResponse & {
          SecretValue?: SecretData;
        }
      >
    >({
      kind: "AWS.SecretsManager.PutSecretValue",
      native: {
        bind: (context) => {
          this.resource.grantRead(context.resource);
        },
        // preWarm: (context) => context.getOrInit(PrewarmClients.SECRETS_MANAGER),
        call: async ([input], context) => {
          const client = context.getOrInit<AWS.SecretsManager>(
            PrewarmClients.SECRETS_MANAGER
          );
          const request: Partial<AWS.SecretsManager.PutSecretValueRequest> = {
            SecretString: input.SecretString,
            SecretBinary: input.SecretBinary,
          };
          if ("SecretValue" in input) {
            if (storeAsJson) {
              request.SecretString = JSON.stringify(input.SecretValue);
            } else if (typeof input.SecretValue === "string") {
              request.SecretString = input.SecretValue;
            } else if (Buffer.isBuffer(input.SecretValue)) {
              request.SecretBinary = input.SecretValue;
            }
          }

          const response = await client
            .getSecretValue({
              ...input,
              SecretId: secretArn,
            })
            .promise();

          return {
            ...response,
            SecretValue: response.SecretString
              ? JSON.parse(response.SecretString)
              : undefined,
          };
        },
      },
    });

    this.getJsonValue = makeIntegration<
      "AWS.SecretsManager.GetSecretValue",
      (
        input?: Omit<AWS.SecretsManager.GetSecretValueRequest, "SecretId">
      ) => Promise<
        AWS.SecretsManager.GetSecretValueResponse & {
          SecretValue?: SecretData;
        }
      >
    >({
      kind: "AWS.SecretsManager.GetSecretValue",
      native: {
        bind: (context) => {
          this.resource.grantRead(context.resource);
        },
        preWarm: initClient,
        call: async (args, context) => {
          const response = await getSecretValue(args, context);
          return {
            ...response,
            SecretValue: response.SecretString
              ? JSON.parse(response.SecretString)
              : undefined,
          };
        },
      },
    });

    this.getValue = makeIntegration<
      "AWS.SecretsManager.GetSecretValue",
      (
        input?: Omit<AWS.SecretsManager.GetSecretValueRequest, "SecretId">
      ) => Promise<AWS.SecretsManager.GetSecretValueResponse>
    >({
      kind: "AWS.SecretsManager.GetSecretValue",
      native: {
        bind: (context) => {
          this.resource.grantRead(context.resource);
        },
        call: getSecretValue,
      },
    });

    function initClient(context: NativePreWarmContext) {
      return context.getOrInit(PrewarmClients.SECRETS_MANAGER);
    }

    async function getSecretValue(
      [input]: [
        input?: Omit<AWS.SecretsManager.GetSecretValueRequest, "SecretId">
      ],
      context: NativePreWarmContext
    ) {
      const client = context.getOrInit<AWS.SecretsManager>(
        PrewarmClients.SECRETS_MANAGER
      );
      console.log(secretArn);
      return client
        .getSecretValue({
          ...input,
          SecretId: secretArn,
        })
        .promise();
    }
  }
}
