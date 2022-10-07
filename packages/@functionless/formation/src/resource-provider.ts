// need to define how to create/update/delete a resource of type X when encountered.
/**
 * registration and discovery - For now, manually register.
 *  Default deploy registers, collection of key to object with interfaces.
 *   Can use object with more definitions.
 * Separate promise for
 */

import { CloudControlProvider } from "./resource-providers/cloud-control";
import { EventBusProvider } from "./resource-providers/event-bus";
import { InlinePolicyProvider } from "./resource-providers/inline-policy";
import { ManagedPolicyProvider } from "./resource-providers/managed-policy";
import { QueuePolicyProvider } from "./resource-providers/queue-policy";
import type { PhysicalResource, ResourceType } from "./resource";
import { EventBusRuleProvider } from "./resource-providers/event-bridge-rule";
import { RoleProvider } from "./resource-providers/role";
import { QueueProvider } from "./resource-providers/queue";
import { SecretProvider } from "./resource-providers/secret";
import { NoOpProvider } from "./resource-providers/no-op";
import { EventSourceMappingProvider } from "./resource-providers/event-source-mapping";

export interface CreateRequest<Properties> {
  logicalId: string;
  resourceType: ResourceType;
  definition: Properties;
}

export interface UpdateRequest<Properties> extends CreateRequest<Properties> {
  previous: PhysicalResource<Properties>;
}

export interface DeleteRequest<Properties> {
  logicalId: string;
  resourceType: ResourceType;
  physicalId: string;
  previous: PhysicalResource<Properties>;
  /**
   * True when the resource was already snapshot before the delete.
   */
  snapshotDone: boolean;
}

export interface ResourceOperationResultMetadata {
  /**
   * Minimum milliseconds to wait after all deployment operations are complete.
   *
   * If it takes around 10s for a Policy update (paddingMillis: 10000) to be reflected (consistency), but
   * the rest of the deployment only takes 5s, we will wait at least 5s before completing the deployment.
   *
   * TODO: replace with a consistent vs referable API.
   */
  paddingMillis?: number;
}

export type ResourceOperationResult<Properties = any> = Promise<
  | PhysicalResource<Properties>
  | ({
      resource: PhysicalResource<Properties>;
    } & ResourceOperationResultMetadata)
>;

export interface ResourceProviderRetryConfig {
  canRetry: ("CREATE" | "DELETE" | "UPDATE")[] | true;
}

/**
 * TODO: support optional snapshot.
 */
export interface ResourceProvider<Properties = any> {
  retry?: ResourceProviderRetryConfig;
  create(
    request: CreateRequest<Properties>
  ): ResourceOperationResult<Properties>;
  update(
    request: UpdateRequest<Properties>
  ): ResourceOperationResult<Properties>;
  delete(
    request: DeleteRequest<Properties>
  ): Promise<void | ResourceOperationResultMetadata>;
}

export type ResourceProviderInitializer<Properties = any> = (
  props: ResourceProviderProps
) => ResourceProvider<Properties>;

export const DEFAULT_RESOURCE_PROVIDER_KEY = "FORMLESS_DEFAULT";

export const DefaultResourceProviders: Record<
  string,
  ResourceProvider | ResourceProviderInitializer
> = {
  "AWS::Events::EventBus": (props) => new EventBusProvider(props),
  "AWS::Events::Rule": (props) => new EventBusRuleProvider(props),
  "AWS::IAM::Policy": (props) => new InlinePolicyProvider(props),
  "AWS::IAM::ManagedPolicy": (props) => new ManagedPolicyProvider(props),
  "AWS::SQS::QueuePolicy": (props) => new QueuePolicyProvider(props),
  "AWS::SQS::Queue": (props) => new QueueProvider(props),
  "AWS::IAM::Role": (props) => new RoleProvider(props),
  "AWS::SecretsManager::Secret": (props) => new SecretProvider(props),
  "AWS::CDK::Metadata": new NoOpProvider(),
  "AWS::Lambda::EventSourceMapping": (props) =>
    new EventSourceMappingProvider(props),
  [DEFAULT_RESOURCE_PROVIDER_KEY]: (props) => new CloudControlProvider(props),
};

export interface ResourceProviderProps {
  sdkConfig: any;
  account: string;
  region: string;
}

export class ResourceProviders {
  private readonly __cache: Record<string, ResourceProvider>;
  constructor(
    private props: ResourceProviderProps,
    private resourceProviders: Record<
      string,
      ResourceProvider | ResourceProviderInitializer
    >
  ) {
    this.__cache = {};
  }

  getHandler(key: string): ResourceProvider<any> {
    if (this.__cache[key]) {
      return this.__cache[key]!;
    } else if (key in this.resourceProviders) {
      const provider = this.resourceProviders[key]!;
      this.__cache[key] =
        typeof provider === "function" ? provider(this.props) : provider;
      return this.__cache[key]!;
    } else if (DEFAULT_RESOURCE_PROVIDER_KEY in this.resourceProviders) {
      return this.getHandler(DEFAULT_RESOURCE_PROVIDER_KEY);
    } else {
      throw new Error(
        `No provider was found for ${key} and no default provider (${DEFAULT_RESOURCE_PROVIDER_KEY}) was provided.`
      );
    }
  }
}
