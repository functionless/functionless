import { Blob } from "buffer";
import { aws_secretsmanager } from "aws-cdk-lib";
import type AWS from "aws-sdk";
import { Construct } from "constructs";
import {
  NativeIntegration,
  NativeRuntimeEnvironment,
} from "@functionless/aws-lambda";
import { SecretsManagerClient } from "@functionless/aws-secretsmanager";

/**
 * @returns `true` of {@link a} is a {@link Secret}, otherwise `false`.
 */
export function isSecret(a: any): a is Secret {
  return a?.FunctionlessType === Secret.FunctionlessType;
}

export interface SecretProps extends aws_secretsmanager.SecretProps {}

/**
 * Securely stores secret data such as credentials and API keys in an AWS Secret.
 *
 * @see https://aws.amazon.com/secrets-manager/
 * @see {@link aws_secretsmanager.Secret}
 */
export abstract class Secret<SecretValue = any> {
  public static readonly FunctionlessType = "Secret";
  public readonly FunctionlessType = Secret.FunctionlessType;

  readonly resource: aws_secretsmanager.ISecret;

  /**
   * Stores a new {@link SecretValue} in this {@link Secret}'s store.
   *
   * ```ts
   * const secret = new Secret<UserPass>(scope, id, {});
   *
   * await secret.putSecretValue({
   *   SecretValue: {
   *     username: "sam"
   *     password: "my little pony"
   *   }
   * });
   * ```
   */
  public readonly putSecretValue: (
    input: PutSecretValueRequest<SecretValue>
  ) => Promise<AWS.SecretsManager.PutSecretValueResponse>;

  /**
   * Get the value of the Secret from the Secret Store.
   *
   * ```ts
   * const { SecretValue } = await secret.getSecretValue();
   * ```
   *
   * You can also specify the VersionId or VersionStage.
   * ```ts
   * const { SecretValue } = await secret.getSecretValue({
   *   VersionId: "<id>",
   *   VersionStage: "<stage>"
   * });
   * ```
   */
  public readonly getSecretValue: (
    input?: Omit<AWS.SecretsManager.GetSecretValueRequest, "SecretId">
  ) => Promise<GetSecretValueResponse<SecretValue>>;

  constructor(resource: aws_secretsmanager.ISecret, props?: SecretProps);
  constructor(scope: Construct, id: string, props?: SecretProps);
  constructor(
    ...args:
      | [secret: aws_secretsmanager.ISecret, props?: SecretProps]
      | [scope: Construct, id: string, props?: SecretProps]
  ) {
    let props: SecretProps | undefined;
    if (typeof args[1] !== "string") {
      this.resource = args[0] as aws_secretsmanager.ISecret;
      props = args[1];
    } else {
      props = args[2] as SecretProps;
      this.resource = new aws_secretsmanager.Secret(args[0], args[1], props);
    }
    // we must store references to these values or else the Debugger-based serializer
    // complains about capturing `this`. We should be able to avoid this once we migrate
    // to the new serializer - https://github.com/functionless/functionless/pull/402
    const serialize = this.serialize;
    const deserialize = this.deserialize;
    const secretArn = this.resource.secretArn;

    this.putSecretValue = {
      kind: "AWS.SecretsManager.PutSecretValue",
      native: <
        NativeIntegration<
          (
            input: PutSecretValueRequest<SecretValue>
          ) => Promise<AWS.SecretsManager.PutSecretValueResponse>
        >
      >{
        bind: (context) => {
          this.resource.grantWrite(context);
        },
        preWarm: initClient,
        call: async ([input], context) =>
          context
            .getOrInit<AWS.SecretsManager>(SecretsManagerClient)
            .putSecretValue({
              ClientRequestToken: input.ClientRequestToken,
              VersionStages: input.VersionStages,
              SecretId: secretArn,
              ...serialize(input.SecretValue),
            })
            .promise(),
      },
    } as any;

    this.getSecretValue = {
      kind: "AWS.SecretsManager.GetSecretValue",
      native: <
        NativeIntegration<
          (
            input?: Omit<AWS.SecretsManager.GetSecretValueRequest, "SecretId">
          ) => Promise<GetSecretValueResponse<SecretValue>>
        >
      >{
        bind: (context) => {
          this.resource.grantRead(context);
        },
        preWarm: initClient,
        async call([input], context) {
          const client =
            context.getOrInit<AWS.SecretsManager>(SecretsManagerClient);
          const response = await client
            .getSecretValue({
              ...input,
              SecretId: secretArn,
            })
            .promise();

          assertIsSerializedSecretValue(response);

          return {
            ...response,
            SecretValue: await deserialize(response),
          };
        },
      },
    } as any;

    function initClient(context: NativeRuntimeEnvironment) {
      return context.getOrInit(SecretsManagerClient);
    }
  }

  /**
   * Provides the logic for deserializing the raw {@link AWS.SecretsManager.GetSecretValueResponse}
   * into its {@link SecretValue} form.
   * @param response the response of GetSecretValue API request.
   */
  protected abstract deserialize(
    response: SerializedSecretValue
  ): Promise<SecretValue>;

  /**
   * Serialize a {@link SecretValue} into a SecretString or SecretBinary.
   * @param secretValue the secret value to serialize
   */
  protected abstract serialize(secretValue: SecretValue): SerializedSecretValue;
}

export type SerializedSecretValue =
  | {
      SecretString: AWS.SecretsManager.SecretStringType;
      SecretBinary?: never;
    }
  | {
      SecretString?: never;
      SecretBinary: AWS.SecretsManager.SecretBinaryType;
    };

/**
 * The contract of GetSecretValue guarantees that either SecretString or SecretBinary
 * are defined, but the types do not reflect this. This assertion function checks that
 * constraint and narrows the type appropriately to a {@link SerializedSecretValue}.
 *
 * @param response the response of the GetSecretValue API.
 * @see https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html#API_GetSecretValue_ResponseSyntax
 */
function assertIsSerializedSecretValue(
  response: AWS.SecretsManager.GetSecretValueResponse
): asserts response is SerializedSecretValue {
  if (
    response.SecretBinary === undefined &&
    response.SecretString === undefined
  ) {
    throw new Error(
      `neither SecretString nor SecretBinary were present in the GetSecretValueResponse, this should not happen according to the specification - see https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html#API_GetSecretValue_ResponseSyntax`
    );
  }
}

export interface GetSecretValueResponse<SecretValue>
  extends AWS.SecretsManager.GetSecretValueResponse {
  /**
   * The {@link SecretValue} retrieved from the Store.
   */
  SecretValue: SecretValue;
}

export interface PutSecretValueRequest<SecretValue>
  extends Omit<
    AWS.SecretsManager.PutSecretValueRequest,
    "SecretId" | "SecretString" | "SecretValue"
  > {
  /**
   * The {@link SecretValue} to write to the Store.
   */
  SecretValue: SecretValue;
}

class BaseJsonSecret<SecretValue = any> extends Secret<SecretValue> {
  protected serialize(secretValue: SecretValue) {
    return {
      SecretString: JSON.stringify(secretValue),
    };
  }

  protected async deserialize(
    response: SerializedSecretValue
  ): Promise<SecretValue> {
    const data = await parse(response);
    return JSON.parse(typeof data === "string" ? data : data.toString("utf8"));
  }
}

/**
 * Interface for a {@link JsonSecret}.
 *
 * Produced by {@link JsonSecret.from}.
 */
export interface IJsonSecret<SecretValue = any>
  extends BaseJsonSecret<SecretValue> {}

/**
 * Securely stores a JSON-encoded {@link SecretValue}.
 *
 * ```ts
 * interface UserPass {
 *   username: string;
 *   password: string;
 * }
 * const secret = new JsonSecret<UserPass>(scope, "id");
 *
 * new Function(scope, "foo", async () => {
 *   const response = await secret.getSecretValue();
 *
 *   // secret is automatically deserialized from JSON
 *   const { username, password } = response.SecretValue!;
 *
 *   // secret is automatically serialized to JSON
 *   await secret.putSecretValue({
 *     SecretValue: {
 *       username: "sam",
 *       password: "password123"
 *     }
 *   });
 * });
 * ```
 */
export class JsonSecret<SecretValue = any> extends BaseJsonSecret<SecretValue> {
  /**
   * Import a {@link JsonSecret} from an existing {@link aws_secretsmanager.ISecret}.
   *
   * ```ts
   * import { aws_secretsmanager } from "aws-cdk-lib";
   *
   * const secret: aws_secretsmanager.ISecret;
   *
   * const jsonSecret = JsonSecret.from<UserPass>(secret);
   * ```
   *
   * @param secret
   * @returns
   */
  public static from<SecretValue = any>(
    secret: aws_secretsmanager.ISecret
  ): IJsonSecret<SecretValue> {
    return new BaseJsonSecret(secret);
  }

  constructor(scope: Construct, id: string, props?: SecretProps) {
    super(scope, id, props);
  }
}

class BaseTextSecret extends Secret<AWS.SecretsManager.SecretStringType> {
  protected serialize(secretValue: string) {
    return {
      SecretString: secretValue,
    };
  }

  protected async deserialize(
    secretValue: SerializedSecretValue
  ): Promise<string> {
    const data = await parse(secretValue);
    return typeof data === "string" ? data : data.toString("utf8");
  }
}

/**
 * Interface for a {@link TextSecret}.
 *
 * Produced by {@link TextSecret.from}.
 */
export interface ITextSecret extends BaseTextSecret {}

/**
 * Securely stores a string-encoded secret.
 *
 * ```ts
 * const secret = new TextSecret(scope, "id");
 *
 * new Function(scope, "foo", async () => {
 *   const text = await secret.getSecretValue();
 *
 *   await secret.putSecretValue({
 *     SecretValue: "secret key 123"
 *   });
 * });
 * ```
 */
export class TextSecret extends BaseTextSecret implements ITextSecret {
  /**
   * Import a {@link TextSecret} from an existing {@link aws_secretsmanager.ISecret}.
   *
   * ```ts
   * import { aws_secretsmanager } from "aws-cdk-lib";
   *
   * const secret: aws_secretsmanager.ISecret;
   *
   * const textSecret = TextSecret.from(secret);
   * ```
   *
   * @param secret
   * @returns
   */
  public static from(secret: aws_secretsmanager.ISecret): ITextSecret {
    return new BaseTextSecret(secret);
  }

  constructor(scope: Construct, id: string, props?: SecretProps) {
    super(scope, id, props);
  }
}

class BaseBinarySecret extends Secret<Buffer> {
  protected serialize(secretValue: Buffer): SerializedSecretValue {
    return {
      SecretBinary: secretValue,
    };
  }

  protected async deserialize(
    secretValue: SerializedSecretValue
  ): Promise<Buffer> {
    const data = await parse(secretValue);
    return typeof data === "string" ? Buffer.from(data, "utf8") : data;
  }
}

/**
 * Interface for a {@link BinarySecret}.
 *
 * Produced by {@link BinarySecret.from}.
 */
export interface IBinarySecret extends BaseBinarySecret {}

/**
 * Securely stores a binary-encoded secret.
 *
 * ```ts
 * const secret = new TextSecret(scope, "id");
 *
 * new Function(scope, "foo", async () => {
 *   const bytes = await secret.getSecretValue();
 *
 *   await secret.putSecretValue({
 *     SecretValue: Buffer.from("secret key 123", "utf8")
 *   });
 * });
 * ```
 */
export class BinarySecret extends BaseBinarySecret {
  /**
   * Import a {@link BinarySecret} from an existing {@link aws_secretsmanager.ISecret}.
   *
   * ```ts
   * import { aws_secretsmanager } from "aws-cdk-lib";
   *
   * const secret: aws_secretsmanager.ISecret;
   *
   * const binarySecret = BinarySecret.from(secret);
   * ```
   *
   * @param secret
   * @returns
   */
  public static from(secret: aws_secretsmanager.ISecret): IBinarySecret {
    return new BaseBinarySecret(secret);
  }

  constructor(scope: Construct, id: string, props?: SecretProps) {
    super(scope, id, props);
  }
}

async function parse(
  secretValue: SerializedSecretValue
): Promise<string | Buffer> {
  if (secretValue.SecretString) {
    return secretValue.SecretString;
  } else if (typeof secretValue.SecretBinary === "string") {
    return secretValue.SecretBinary;
  } else if (Buffer.isBuffer(secretValue.SecretBinary)) {
    return secretValue.SecretBinary.toString("utf8");
  } else if (secretValue.SecretBinary instanceof Uint8Array) {
    return Buffer.from(secretValue.SecretBinary).toString("utf8");
  } else if (secretValue.SecretBinary instanceof Blob) {
    return Buffer.from(await secretValue.SecretBinary.arrayBuffer()).toString(
      "utf8"
    );
  } else {
    throw new Error(
      `unable to parse SecretValue, expected a string or Buffer, but received `
    );
  }
}
