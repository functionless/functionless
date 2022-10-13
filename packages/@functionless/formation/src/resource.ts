import type {
  CreateResourceCommand,
  UpdateResourceCommand,
} from "@aws-sdk/client-cloudcontrol";
import { compare } from "fast-json-patch";

import { Expression } from "./expression";
import type { IntrinsicFunction } from "./function";
import {
  buildDependencyGraph,
  getDirectDependents,
  ResourceDependencyGraph,
} from "./graph";
import { TemplateResolver, TemplateResolverProps } from "./resolve-template";
import { ResourceProviders } from "./resource-provider";
import { ResourceDeploymentPlan, StackState } from "./stack";
import { CloudFormationTemplate } from "./template";
import { cyrb53, wait } from "./util";

import { Value } from "./value";

/**
 * The required {@link Resources} section declares the AWS resources that you want to include in the stack, such as an Amazon EC2 instance or an Amazon S3 bucket.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resources-section-structure.html
 */
export interface Resources {
  /**
   * The logical ID must be alphanumeric `(A-Za-z0-9)` and unique within the template. Use the logical name to reference the resource in other parts of the template. For example, if you want to map an Amazon Elastic Block Store volume to an Amazon EC2 instance, you reference the logical IDs to associate the block stores with the instance.
   *
   * In addition to the logical ID, certain resources also have a physical ID, which is the actual assigned name for that resource, such as an EC2 instance ID or an S3 bucket name. Use the physical IDs to identify resources outside of AWS CloudFormation templates, but only after the resources have been created. For example, suppose you give an EC2 instance resource a logical ID of MyEC2Instance. When AWS CloudFormation creates the instance, AWS CloudFormation automatically generates and assigns a physical ID (such as i-28f9ba55) to the instance. You can use this physical ID to identify the instance and view its properties (such as the DNS name) by using the Amazon EC2 console. For resources that support custom names, you can assign your own names (physical IDs) to help you quickly identify resources. For example, you can name an S3 bucket that stores logs as MyPerformanceLogs.
   */
  [logicalId: string]: LogicalResource;
}

/**
 * Resource Type Name.
 *
 * @see https://docs.aws.amazon.com/cloudcontrolapi/latest/userguide/supported-resources.html
 */
export type ResourceType = string;

/**
 * A {@link LogicalResource} is a description of a resource containing its {@link Type}
 * and set of {@link LogicalProperties}.
 *
 * By "Logical", we mean that its {@link Properties} may contain {@link Expression}s that
 * must be evaluated to values during Stack Update.
 */
export interface LogicalResource {
  Type: ResourceType;
  /**
   * The Resource's {@link LogicalProperties} configuration.
   */
  Properties?: LogicalProperties;
  /**
   * With the DeletionPolicy attribute you can preserve, and in some cases, backup a resource when its stack is deleted.
   */
  DeletionPolicy?: DeletionPolicy;
  /**
   * You can use {@link IntrinsicFunction}s to conditionally create stack resources.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-conditions.html
   */
  Condition?: string;
  /**
   * LogicalIDs which this resource depends on.
   */
  DependsOn?: string[];
}

/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-deletionpolicy.html
 */
export enum DeletionPolicy {
  Delete = "Delete",
  Retain = "Retain",
  Snapshot = "Snapshot",
}

/**
 * Map of `propertyName` to its {@link Expression}.
 *
 * These properties will be evaluated at deploy-time and resolved to raw JSON values.
 */
export interface LogicalProperties {
  [propertyName: string]: Expression;
}

/**
 * Map of a {@link LogicalResource}'s `logicalId` to its {@link PhysicalResource}.
 */
export interface PhysicalResources {
  [logicalId: string]: PhysicalResource;
}

/**
 * A {@link PhysicalResource} provisioned in an AWS account.
 */
export interface PhysicalResource<Properties extends any = PhysicalProperties> {
  /**
   * Name of the {@link ResourceType}.
   */
  Type: ResourceType;
  /**
   * Physical ID of the {@link PhysicalResource}.
   */
  PhysicalId?: string;
  /**
   * Input Properties passed to {@link CreateResourceCommand} and {@link UpdateResourceCommand}.
   */
  InputProperties: Properties;
  /**
   * Attributes exported by the {@link PhysicalResource}.
   */
  Attributes: PhysicalProperties;
  /**
   * An optional hash used to determine if the Logical Resource used to generate this resource was changed.
   *
   * If a Provider does not return a value here, the engine will generate one using {@link LogicalResource.Properties}.
   */
  PropertiesHash?: string;
}

/**
 * Map of `propertyName` to its {@link EvaluatedExpression} value.
 */
export interface PhysicalProperties {
  [propertyName: string]: Value;
}

export interface ResourceProcessMetrics {
  processTime?: number;
  waitTime?: number;
  retries?: number;
}

export interface Resource {
  // the process which when complete, evaluates the resource
  resource: Promise<PhysicalResource | undefined>;
  operation: ResourceOperation;
  logicalId: string;
  metrics?: ResourceProcessMetrics;
  start?: Date;
  end?: Date;
}

export type CompleteResource = Omit<Resource, "resource"> & {
  // the process which when complete, evaluates the resource
  resource: PhysicalResource | undefined;
};

export type ResourceOperation =
  | "SKIP_UPDATE"
  | "UPDATE"
  | "CREATE"
  | "MAYBE_UPDATE"
  | "DELETE";

export async function computeResourceOperation(
  templateResolver: TemplateResolver,
  logicalResource: LogicalResource,
  previous?: PhysicalResource
): Promise<ResourceOperation> {
  // resource did not exist before, will need to be created
  if (!previous) {
    return "CREATE";
  } else {
    const result = logicalResource.Properties
      ? await templateResolver.evaluateExpr(logicalResource.Properties)
      : undefined;
    if (
      result?.unresolvedDependencies &&
      result.unresolvedDependencies.length > 0
    ) {
      return logicalResourcePropertyHash(logicalResource) ===
        previous.PropertiesHash
        ? // A dependency is unresolved, but the logical properties are unchanged
          "MAYBE_UPDATE"
        : // A dependency is unresolved and the inputs changes.
          "UPDATE";
    } else if (!result) {
      if (
        !previous.InputProperties ||
        Object.keys(previous.InputProperties).length === 0
      ) {
        return "SKIP_UPDATE";
      } else {
        // properties is undefined or empty for input and the previous properties were not undefined
        return "UPDATE";
      }
    } else {
      const diff = compare(
        (await result.value()) as object,
        previous.InputProperties
      );
      if (diff.length > 0) {
        // properties were resolved, but they changed.
        return "UPDATE";
      }
      // properties were resolved and there were no difference between the previous and desired state
      return "SKIP_UPDATE";
    }
  }
}

interface OperationResult {
  retryWaitTime: number;
  retries: number;
  processTime: number;
  resource: PhysicalResource | undefined;
}

export function logicalResourcePropertyHash(resource: LogicalResource) {
  return cyrb53(
    resource.Properties ? JSON.stringify(resource.Properties) : "{}"
  );
}

export class ResourceDeploymentPlanExecutor {
  private readonly resources: {
    [logicalId: string]: Resource;
  };
  private deploymentPadding: Promise<any>;
  private templateResolver: TemplateResolver;
  private previousDependencyGraph?: Promise<ResourceDependencyGraph>;

  constructor(
    private readonly deploymentPlan: ResourceDeploymentPlan,
    private readonly template: CloudFormationTemplate,
    private readonly resourceProviders: ResourceProviders,
    templateResolverProps: Omit<
      TemplateResolverProps,
      "resourceReferenceResolver"
    >,
    private readonly previousState?: StackState
  ) {
    this.resources = {};
    this.deploymentPadding = Promise.resolve();
    // used by delete
    this.previousDependencyGraph = this.previousState
      ? buildDependencyGraph(this.previousState.template)
      : undefined;
    this.templateResolver = new TemplateResolver(template, {
      ...templateResolverProps,
      resourceReferenceResolver: {
        resolve: async (logicalId) => {
          return {
            value: () => this.processAndGetResource(logicalId),
          };
        },
      },
    });
  }

  public async execute(): Promise<{
    completedResources: CompleteResource[];
    outputs: Record<string, string>;
    errors: string[];
  }> {
    await Promise.allSettled(
      this.deploymentPlan.topoSortedCreateUpdates.map((k) =>
        this.processAndGetResource(k.resourceId)
      )
    );

    if (this.deploymentPlan.topoSortedDeletes) {
      await Promise.allSettled(
        this.deploymentPlan.topoSortedDeletes.map((k) =>
          this.processAndGetResource(k.resourceId)
        )
      );
    }

    const completed = await Promise.allSettled(
      Object.values(this.resources).map(async (v) => ({
        ...v,
        resource: await v.resource,
      }))
    );

    // resource providers can inject padding into the end of the deployment process
    // TODO: add option to disable this
    await this.deploymentPadding;

    return {
      errors: completed
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => r.reason),
      completedResources: completed
        .filter(
          (r): r is Exclude<typeof completed[number], PromiseRejectedResult> =>
            r.status === "fulfilled"
        )
        .map((x) => x.value),
      outputs: Object.fromEntries(
        await Promise.all(
          this.deploymentPlan.outputs.map(async (output) => [
            output,
            await (
              await this.templateResolver.evaluateExpr(
                this.template.Outputs?.[output]!
              )
            ).value(),
          ])
        )
      ),
    };
  }

  private async processAndGetResource(
    logicalId: string
  ): Promise<PhysicalResource | undefined> {
    if (!(logicalId in this.deploymentPlan.resourceOperationMap)) {
      throw new Error("Logical id missing from plan");
    } else {
      const resourceOperation =
        this.deploymentPlan.resourceOperationMap[logicalId]!;
      if (logicalId in this.resources) {
        return this.resources[logicalId]!.resource;
      } else if (resourceOperation === "SKIP_UPDATE") {
        if (
          !this.previousState ||
          !(logicalId in this.previousState?.resources)
        ) {
          throw new Error(
            `Logical id ${logicalId} is skipped, but is missing from previous state.`
          );
        }
        // maybe pre-fill the resources object instead of on demand?
        this.resources[logicalId] = {
          resource: Promise.resolve(this.previousState.resources[logicalId]),
          logicalId,
          operation: resourceOperation,
        };
        return this.previousState.resources[logicalId];
      } else if (resourceOperation === "DELETE") {
        return this.deleteResource(logicalId);
      } else {
        return this.updateResource(logicalId, resourceOperation);
      }
    }
  }

  private startProcessResource(
    logicalId: string,
    operation: ResourceOperation,
    operationTask: (start: Date) => Promise<OperationResult>
  ): Resource {
    if (this.resources[logicalId]) {
      throw new Error("LogicalId started with two operations.");
    } else {
      const start = new Date();
      return (this.resources[logicalId] = {
        start,
        resource: operationTask(start).then((x) => {
          this.resources[logicalId] = {
            ...this.resources[logicalId]!,
            end: new Date(),
            metrics: {
              ...this.resources[logicalId]!.metrics,
              processTime: x.processTime,
              retries: x.retries,
              waitTime: x.retryWaitTime,
            },
          };
          return x.resource;
        }),
        operation,
        logicalId,
      });
    }
  }

  /**
   * Padding module is used to delay the completion of the deployment until after X time
   * after a resource which may not be complete.
   *
   * Each call to this function will force the deployment to end at LEAST {@link paddingMillis}
   * from this point in time.
   *
   * If the current padding is longer than the added padding, nothing will change, if the current padding is shorter, the process will
   * end at least {@link paddingMillis} from this point in time.
   */
  private addDeploymentPadding(paddingMillis: number) {
    this.deploymentPadding = this.deploymentPadding.then(() =>
      wait(paddingMillis)
    );
  }

  /**
   * Deploy a {@link LogicalResource} to AWS.
   *
   * This Function will recursively deploy any dependent resoruces.
   *
   * TODO: intelligently support rollbacks.
   *
   * @param state the {@link UpdateState} being evaluated.
   * @param logicalId Logical ID of the {@link LogicalResource} to deploy.
   * @returns data describing the {@link PhysicalResource}.
   */
  private async updateResource(
    logicalId: string,
    operation: Extract<ResourceOperation, "UPDATE" | "MAYBE_UPDATE" | "CREATE">
  ): Promise<PhysicalResource | undefined> {
    console.log("Add UPDATE: " + logicalId);
    const logicalResource = this.template?.Resources[logicalId];
    const physicalResource = this.previousState?.resources[logicalId];
    const update = physicalResource !== undefined;

    if (!logicalResource) {
      throw new Error("Missing logical resource to deploy: " + logicalId);
    }

    return this.startProcessResource(logicalId, operation, async () => {
      const properties = logicalResource.Properties
        ? Object.fromEntries(
            await Promise.all(
              Object.entries(logicalResource.Properties).map(
                async ([propName, propExpr]) => [
                  propName,
                  await (
                    await this.templateResolver.evaluateExpr(propExpr)
                  ).value(),
                ]
              )
            )
          )
        : {};

      if (logicalResource.DependsOn) {
        const results = await Promise.allSettled(
          logicalResource.DependsOn.map((logicalDep) =>
            this.processAndGetResource(logicalDep)
          )
        );
        const failed = results.filter((s) => s.status === "rejected");
        if (failed.length > 0) {
          throw new Error(`Dependency of ${logicalId} failed, aborting.`);
        }
      }

      const startTime = new Date();

      const provider = this.resourceProviders.getHandler(logicalResource.Type);

      // TODO support for delete.
      // TODO let the providers override the attempts, delay, and backoff.
      const retry = provider.retry;
      const attemptsBase =
        retry &&
        retry.canRetry &&
        (retry.canRetry === true ||
          (Array.isArray(retry.canRetry) &&
            retry.canRetry.includes(update ? "UPDATE" : "CREATE")))
          ? 5
          : 1;
      let totalDelay = 0;
      const backoff = 2;
      const self = this;

      return startWithRetry(attemptsBase, 1000);

      async function startWithRetry(
        attempts: number,
        delay: number
      ): Promise<OperationResult> {
        try {
          const result = await (update
            ? provider.update({
                definition: properties,
                logicalId,
                previous: physicalResource,
                resourceType: logicalResource!.Type,
              })
            : provider.create({
                definition: properties,
                logicalId,
                resourceType: logicalResource!.Type,
              }));

          const processTime = new Date().getTime() - startTime.getTime();

          const resource = "resource" in result ? result.resource : result;
          if ("resource" in result) {
            if (result.paddingMillis) {
              self.addDeploymentPadding(result.paddingMillis);
            }
          }
          return {
            processTime,
            resource: {
              ...resource,
              // store a hash of the properties used to create the physical resource for later.
              PropertiesHash: logicalResourcePropertyHash(logicalResource!),
            },
            retries: attemptsBase - attempts,
            retryWaitTime: totalDelay,
          };
        } catch (err) {
          if (attempts > 1) {
            totalDelay += delay;
            console.log(`Waiting for consistency (${delay}): ${logicalId}`);
            await wait(delay);
            return await startWithRetry(attempts - 1, delay * backoff);
          } else {
            console.error(err);
            throw new Error(
              `Error while ${update ? "updating" : "creating"} ${logicalId}: ${
                (<any>err).message
              }`
            );
          }
        }
      }
    }).resource;
  }

  private async deleteResource(
    logicalId: string
  ): Promise<PhysicalResource | undefined> {
    const process = async () => {
      const logicalResource = this.previousState?.template.Resources[logicalId];
      const physicalResource = this.previousState?.resources[logicalId];

      if (physicalResource === undefined || logicalResource === undefined) {
        // TODO: should we error here or continue optimistically?
        throw new Error(`Resource does not exist: '${logicalId}'`);
      }

      const deletionPolicy = logicalResource.DeletionPolicy;
      if (deletionPolicy === DeletionPolicy.Snapshot) {
        throw new Error(`DeletionPolicy.Snapshot is not yet supported`);
      }

      if (
        deletionPolicy === undefined ||
        deletionPolicy === DeletionPolicy.Delete
      ) {
        const dependents = getDirectDependents(
          { logicalId },
          await this.previousDependencyGraph!
        );

        // ensure the dependents are being deleted...
        if (
          dependents.some(
            (d) =>
              d in this.deploymentPlan.resourceOperationMap &&
              this.deploymentPlan.resourceOperationMap[d] !== "DELETE"
          )
        ) {
          throw new Error(
            "All dependents of a resource being deleted must also be deleted: " +
              dependents.map(
                (d) => `${d} - ${this.deploymentPlan.resourceOperationMap[d]}\n`
              )
          );
        }

        // wait for dependents to delete before deleting this resource
        await Promise.all(dependents.map((d) => this.processAndGetResource(d)));

        const provider = this.resourceProviders.getHandler(
          logicalResource.Type
        );

        if (!physicalResource.PhysicalId) {
          throw new Error("Resource much have a physical id to be deleted");
        }

        const result = await provider.delete({
          logicalId,
          physicalId: physicalResource.PhysicalId,
          previous: physicalResource,
          resourceType: logicalResource.Type,
          snapshotDone: false,
        });

        if (result && result.paddingMillis) {
          this.addDeploymentPadding(result.paddingMillis);
        }
        return;
      } else if (deletionPolicy === DeletionPolicy.Retain) {
        return physicalResource;
      }

      const __exhaustive: never = deletionPolicy;
      return __exhaustive;
    };

    return this.startProcessResource(logicalId, "DELETE", async (start) => {
      console.log("Add DELETE: " + logicalId);
      return {
        resource: await process(),
        processTime: new Date().getTime() - start.getTime(),
        retries: 0,
        retryWaitTime: 0,
      };
    }).resource;
  }
}
