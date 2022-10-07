import {
  CreateRequest,
  DeleteRequest,
  ResourceOperationResult,
  ResourceOperationResultMetadata,
  ResourceProvider,
  ResourceProviderProps,
  UpdateRequest,
} from "../resource-provider";
import * as secrets from "@aws-sdk/client-secrets-manager";
import { uniqueName } from "../util";

export interface SecretResource {
  Description?: string;
  GenerateSecretString?: GenerateSecretString;
  KmsKeyId?: string;
  Name?: string;
  ReplicaRegions?: ReplicaRegion[];
  SecretString?: string;
  Tags?: secrets.Tag[];
}

interface GenerateSecretString {
  ExcludeCharacters?: string;
  ExcludeLowercase?: boolean;
  ExcludeNumbers?: boolean;
  ExcludePunctuation?: boolean;
  ExcludeUppercase?: boolean;
  GenerateStringKey?: string;
  IncludeSpace?: boolean;
  PasswordLength?: number;
  RequireEachIncludedType?: boolean;
  SecretStringTemplate?: string;
}

interface ReplicaRegion {
  KmsKeyId?: string;
  Region: string;
}

export class SecretProvider implements ResourceProvider<SecretResource> {
  readonly Type = "AWS::SecretsManager::Secret";
  private secretsClient: secrets.SecretsManagerClient;

  constructor(props: ResourceProviderProps) {
    this.secretsClient = new secrets.SecretsManagerClient(props.sdkConfig);
  }
  async create(
    request: CreateRequest<SecretResource>
  ): ResourceOperationResult<SecretResource> {
    const { Name, GenerateSecretString, SecretString, ...definition } =
      request.definition;

    const string = GenerateSecretString
      ? (
          await this.secretsClient.send(
            new secrets.GetRandomPasswordCommand(GenerateSecretString)
          )
        ).RandomPassword
      : SecretString;

    if (!string) {
      throw new Error(
        "AWS::SecretsManager::Secret: SecretString or GenerateSecretString is required."
      );
    }

    const result = await this.secretsClient.send(
      new secrets.CreateSecretCommand({
        Name:
          request.definition.Name ??
          // "Do not end your secret name with a hyphen followed by six characters."
          uniqueName(request.logicalId, undefined, "_"),
        AddReplicaRegions: definition.ReplicaRegions,
        SecretString: string,
        ...definition,
      })
    );

    return {
      resource: {
        PhysicalId: result.ARN!,
        Attributes: {
          Arn: result.ARN,
        },
        InputProperties: request.definition,
        Type: this.Type,
      },
    };
  }
  update(
    _request: UpdateRequest<SecretResource>
  ): ResourceOperationResult<SecretResource> {
    throw new Error("Method not implemented.");
  }
  delete(
    _request: DeleteRequest<SecretResource>
  ): Promise<void | ResourceOperationResultMetadata> {
    throw new Error("Method not implemented.");
  }
}
