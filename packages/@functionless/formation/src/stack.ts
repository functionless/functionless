import * as ssm from "@aws-sdk/client-ssm";

import { DefaultConditionResolver } from "./condition";
import {
  buildDependencyGraph,
  ResourceDependencyGraph,
  discoverOrphanedDependencies,
  isResourceReference,
  buildConditionDependencyGraph,
  topoSortWithLevels,
} from "./graph";

import {
  // @ts-ignore - imported for typedoc
  SSMParameterType,
  Parameter,
  ParameterValues,
  validateParameter,
  DefaultParameterResolver,
} from "./parameter";
import { DefaultPseudoParameterResolver } from "./pseudo-parameter";
import {
  PhysicalResource,
  PhysicalResources,
  LogicalResource,
  DeletionPolicy,
  PhysicalProperties,
  computeResourceOperation,
} from "./resource";
import { Assertion, Rule, Rules } from "./rule";

import { CloudFormationTemplate } from "./template";
import { wait } from "./util";
import { AssetManifest, AssetPublishing, FileManifestEntry } from "cdk-assets";
import AwsClient from "./aws";
import {
  DefaultResourceProviders,
  ResourceProviders,
} from "./resource-provider";
import { displayTopoEntries, TopoDisplayEntry } from "./display";
import { TemplateResolver } from "./resolve-template";

/**
 * A map of each {@link LogicalResource}'s Logical ID to its {@link PhysicalProperties}.
 */
export interface StackState {
  /**
   * The {@link CloudFormationTemplate} used to create this {@link StackState}.
   */
  template: CloudFormationTemplate;
  /**
   * Map of the provisioned {@link PhysicalResources} addressable by their Logical ID.
   */
  resources: PhysicalResources;
  /**
   * Outputs of the stack
   */
  outputs: Record<string, string>;
}

export interface ResourceProcessMetrics {
  processTime?: number;
  waitTime?: number;
  retries?: number;
}

export interface Resource {
  // the process which when complete, evaluates the resource
  resource: Promise<PhysicalResource | undefined>;
  operation?: "UPDATE" | "CREATE" | "DELETE";
  dependencies: string[];
  type?: string;
  name: string;
  metrics?: ResourceProcessMetrics;
  start?: Date;
  end?: Date;
}

export interface BaseState {
  /**
   * The previous {@link CloudFormationTemplate} which triggered the `Update`.
   *
   * This is `undefined` when a {@link Stack} is first deployed.
   */
  previousState: CloudFormationTemplate | undefined;
  /**
   * The {@link previousState}'s {@link ResourceDependencyGraph}.
   */
  previousDependencyGraph: ResourceDependencyGraph | undefined;
  /**
   * Map of `logicalId` to a task ({@link Promise}) resolving the new state of the {@link PhysicalResource}.
   */
  modules: {
    [logicalId: string]: Resource;
  };
}

export interface UpdateState extends BaseState {
  /**
   * The new {@link CloudFormationTemplate} which triggered the `Update`.
   *
   * This is `undefined` when a {@link Stack} is being deleted..
   */
  desiredState: CloudFormationTemplate;
  /**
   * The {@link desiredState}'s {@link ResourceDependencyGraph}.
   */
  desiredDependencyGraph: ResourceDependencyGraph;
  /**
   * Input {@link ParameterValues} for the {@link desiredState}'s {@link Parameters}.
   */
  parameterValues: ParameterValues;
}

export interface StackProps {
  /**
   * AWS Account.
   */
  readonly account: string;
  /**
   * AWS Region.
   */
  readonly region: string;
  /**
   * Name of the Stack. Must be unique within an {@link account} and {@link region.}
   */
  readonly stackName: string;
  /**
   * Previous Create/Update {@link StackState}. This determines the behavior of the provisioning engine.
   */
  readonly previousState?: StackState;
  /**
   * The {@link ssm.SSMClient} to use when resolving {@link SSMParameterType}
   *
   * @default - one is created with default configuration
   */
  readonly ssmClient?: ssm.SSMClient;
  /**
   * SDK config used to create new clients.
   *
   * TODO: fix this...
   */
  readonly sdkConfig?: any;
}

interface OperationResult {
  retryWaitTime: number;
  retries: number;
  processTime: number;
  resource: PhysicalResource | undefined;
}

/**
 * Manages a {@link CloudFormationStack} deployed to AWS.
 */
export class Stack {
  /**
   * AWS Account.
   */
  readonly account: string;
  /**
   * AWS Region.
   */
  readonly region: string;
  /**
   * Account-wide unique name
   */
  readonly stackName: string;
  /**
   * The {@link ssm.SSMClient} to use when resolving {@link SSMParameterType}
   */
  readonly ssmClient: ssm.SSMClient;
  private readonly resourceProviders: ResourceProviders;

  /**
   * Current {@link StackState} of the {@link Stack}.
   */
  private state: StackState | undefined;

  /**
   * AWS client used by the CDK asset deployer.
   */
  private awsClient: AwsClient;

  constructor(private props: StackProps) {
    this.awsClient = new AwsClient(
      props.account,
      props.region,
      props.sdkConfig
    );
    this.account = props.account;
    this.region = props.region;
    this.stackName = props.stackName;
    this.state = props.previousState;
    this.ssmClient =
      props.ssmClient ??
      new ssm.SSMClient({
        region: this.region,
      });
    this.resourceProviders = new ResourceProviders(
      {
        account: props.account,
        region: props.region,
        sdkConfig: props.sdkConfig,
      },
      // TODO allow extending these from outside
      DefaultResourceProviders
    );
  }

  /**
   * @returns the current {@link StackState}.
   */
  public getState() {
    return this.state;
  }

  /**
   * Get the {@link PhysicalResource} by its {@link logicalId}.
   *
   * @returns the {@link PhysicalResource} if it exists, otherwise `undefined`.
   */
  private getPhysicalResource(logicalId: string): PhysicalResource | undefined {
    return this.state?.resources[logicalId];
  }

  /**
   * Get the {@link LogicalResource} by its {@link logicalId}.
   */
  private getLogicalResource(
    logicalId: string,
    state: UpdateState | BaseState
  ): LogicalResource {
    const resource =
      ("desiredState" in state && state.desiredState?.Resources[logicalId]) ||
      state.previousState?.Resources[logicalId];
    if (resource === undefined) {
      throw new Error(`resource does not exist: '${logicalId}'`);
    }
    return resource;
  }

  /**
   * Delete all resources in this Stack.
   */
  public async deleteStack(): Promise<void> {
    if (this.state === undefined) {
      throw new Error(
        `Cannot delete stack '${this.stackName}' since it does not exist.`
      );
    }
    const state: BaseState = {
      previousState: this.state.template,
      previousDependencyGraph: await buildDependencyGraph(this.state.template),
      modules: {}, // initialize with empty state
    };

    // delete all resources in the stack
    await this.deleteResources(Object.keys(this.state.resources), state);

    // set the state to `undefined` - this stack is goneskies
    this.state = undefined;
  }

  /**
   * Delete the Resources identified by {@link logicalIds} in order of their dependencies.
   *
   * @param logicalIds list of logicalIds to delete
   * @param state {@link UpdateState} for this Stack Update operation.
   */
  private async deleteResources(logicalIds: string[], state: BaseState) {
    const allowedLogicalIds = new Set(logicalIds);
    return logicalIds.map((logicalId) =>
      this.deleteResource(logicalId, state, allowedLogicalIds)
    );
  }

  private startProcessResource(
    logicalId: string,
    operation: "UPDATE" | "CREATE" | "DELETE" | undefined,
    state: BaseState,
    type: string | undefined,
    operationTask: (start: Date) => Promise<OperationResult>
  ): Resource {
    if (state.modules[logicalId]) {
      throw new Error("LogcalId started with two operations.");
    } else {
      const start = new Date();
      return (state.modules[logicalId] = {
        start,
        resource: operationTask(start).then((x) => {
          state.modules[logicalId] = {
            ...state.modules[logicalId]!,
            end: new Date(),
            metrics: {
              ...state.modules[logicalId]!.metrics,
              processTime: x.processTime,
              retries: x.retries,
              waitTime: x.retryWaitTime,
            },
          };
          return x.resource;
        }),
        dependencies: [],
        operation,
        type,
        name: logicalId,
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
  private addDeploymentPadding(
    paddingMillis: number,
    state: BaseState,
    name: string = "PADDING"
  ) {
    if (state.modules[name]) {
      state.modules[name] = {
        ...state.modules[name]!,
        resource: Promise.all([
          state.modules[name]!.resource,
          wait(paddingMillis),
        ]) as any,
      };
    } else {
      state.modules[name] = {
        dependencies: [],
        resource: wait(paddingMillis) as any,
        name,
      };
    }
  }

  /**
   * Delete a Resource from AWS. Recursively delete its dependencies if there are any.
   *
   * @param logicalId Logical ID of the {@link PhysicalResource} to delete.
   * @param state {@link UpdateState} for this Stack Update operation.
   * @param allowedLogicalIds a set of logicalIds that are allowed to be deleted. This is so that we
   *                          can delete a sub-set of the logicalIds when transiting dependencies,
   *                          for example when deleting orphaned resources during a Stack Update.
   * @returns the {@link PhysicalResource} that was deleted, or `undefined` if there was no Resource.
   */
  private async deleteResource(
    logicalId: string,
    state: BaseState,
    allowedLogicalIds: Set<String>
  ): Promise<PhysicalResource | undefined> {
    if (logicalId in state.modules) {
      return state.modules[logicalId]!.resource;
    } else {
      const process = async () => {
        const physicalResource = this.getPhysicalResource(logicalId);
        const logicalResource = this.getLogicalResource(logicalId, state);

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
          const dependencies = state.previousDependencyGraph?.[logicalId];

          if (dependencies === undefined) {
            throw new Error(`undefined dependencies`);
          }

          // wait for dependencies to delete before deleting this resource
          // FIXME: this is wrong? we want all dependents to be deleted before their dependencies
          //        CREATE: add ROLE -> add POLICY -> attach to role
          //        DELETE: remove policy from rule => del policy => del role (note: could we optimize this if we know the role will be deleted?)
          await Promise.all(
            dependencies
              .filter(isResourceReference)
              .map(({ logicalId }) =>
                this.deleteResource(logicalId, state, allowedLogicalIds)
              )
          );

          if (allowedLogicalIds?.has(logicalId) ?? true) {
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
              this.addDeploymentPadding(result.paddingMillis, state);
            }
            return;
          } else {
            // we're not allowed to delete it, so skip
            return physicalResource;
          }
        } else if (deletionPolicy === DeletionPolicy.Retain) {
          return physicalResource;
        }

        const __exhaustive: never = deletionPolicy;
        return __exhaustive;
      };

      return this.startProcessResource(
        logicalId,
        "DELETE",
        state,
        state.previousState?.Resources[logicalId]?.Type,
        async (start) => {
          console.log("Add DELETE: " + logicalId);
          return {
            resource: await process(),
            processTime: new Date().getTime() - start.getTime(),
            retries: 0,
            retryWaitTime: 0,
          };
        }
      ).resource;
    }
  }

  /**
   * Deploy all {@link LogicalResource}s in this {@link CloudFormationStack}
   *
   * @param desiredState a {@link CloudFormationTemplate} describing the Desired State of this {@link Stack}.
   * @param parameterValues input values of the {@link Parameters}.
   * @returns the new {@link StackState}.
   */
  public async updateStack(
    desiredState: CloudFormationTemplate,
    parameterValues?: ParameterValues,
    assetManifestFile?: string
  ): Promise<StackState> {
    const previousState = this.state?.template;

    const assetManifest = assetManifestFile
      ? AssetManifest.fromFile(assetManifestFile)
      : undefined;

    const publisher = assetManifest
      ? new AssetPublishing(assetManifest, {
          aws: this.awsClient,
          buildAssets: false,
        })
      : undefined;

    await Promise.all(
      assetManifest?.entries.map(async (a) => {
        console.log("publishing " + a.id);
        // @ts-ignore
        await publisher?.publishAsset(a);
      }) ?? []
    );

    if (publisher?.hasFailures) {
      throw new Error(
        publisher.failures
          .map((f) => `Asset Error ${f.asset.id} ${f.error}`)
          .join("\n")
      );
    }

    const state: UpdateState = {
      previousState: this.state?.template,
      previousDependencyGraph: this.state?.template
        ? await buildDependencyGraph(this.state.template)
        : undefined,
      desiredState: desiredState,
      desiredDependencyGraph: await buildDependencyGraph(desiredState),
      parameterValues: parameterValues ?? {},
      modules: {},
    };

    const templateResolver = new TemplateResolver(desiredState, {
      pseudoParameterResolver: new DefaultPseudoParameterResolver({
        account: this.account,
        region: this.region,
        stackName: this.stackName,
      }),
      parameterReferenceResolver: new DefaultParameterResolver(
        parameterValues ?? {},
        { ssmClient: this.ssmClient }
      ),
      conditionReferenceResolver: new DefaultConditionResolver(),
      resourceReferenceResolver: {
        resolve: async (logicalId, templateResolver) => {
          return {
            value: () =>
              this.updateResource(state, logicalId, templateResolver),
          };
        },
      },
    });

    try {
      await this.validateParameters(desiredState, parameterValues);
      if (desiredState.Rules) {
        await this.validateRules(desiredState.Rules, templateResolver);
      }

      const resourceResults = await Promise.allSettled(
        Object.keys(desiredState.Resources).map(async (logicalId) => {
          const resource = await this.updateResource(
            state,
            logicalId,
            templateResolver
          );
          return resource
            ? {
                [logicalId]: resource,
              }
            : undefined;
        })
      );
      const resourceFailed = resourceResults.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected"
      );
      if (resourceFailed.length > 0) {
        throw new Error(
          "One or more resources failed:\n" +
            resourceFailed.map((r) => r.reason).join("\n")
        );
      }
      const resultValues = resourceResults
        .map(
          (r) =>
            (<Exclude<typeof resourceResults[number], PromiseRejectedResult>>r)
              .value
        )
        .filter(<T>(a: T): a is Exclude<T, undefined> => a !== undefined)
        .reduce((a, b) => ({ ...a, ...b }), {});

      // create new resources
      this.state = {
        template: desiredState,
        resources: {
          ...(this.state?.resources ?? {}),
          ...resultValues,
        },
        outputs: Object.fromEntries(
          await Promise.all(
            Object.entries(desiredState.Outputs ?? {}).map(
              async ([name, value]) => [
                name,
                // @ts-ignore
                await this.evaluateExpr(value, state).then((x) => x.Value),
              ]
            )
          )
        ),
      };

      // delete orphaned resources
      const orphanedLogicalIds =
        previousState === undefined
          ? []
          : discoverOrphanedDependencies(previousState, desiredState);

      await this.deleteResources(orphanedLogicalIds, state);

      for (const orphanedLogicalId of orphanedLogicalIds) {
        delete this.state?.resources[orphanedLogicalId];
      }

      return this.state;
    } finally {
      console.log("Cleaning Up");

      // await any leaf tasks not awaited already
      const completedModules = await Promise.allSettled(
        Object.values(state.modules).map(async (x) => ({
          resource: await x.resource,
          module: x,
        }))
      );

      const failedMessage = completedModules
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => "Resource failed: " + r.reason)
        .join("\n");
      const succeededModules = completedModules.filter(
        (
          r
        ): r is Exclude<
          typeof completedModules[number],
          PromiseRejectedResult
        > => r.status === "fulfilled"
      );
      const succeededMessage = succeededModules
        .map((r) => {
          // TODO: output in a consumable form
          return `Resource complete: ${r.value.module.name} - (${
            r.value.module.type
          }) - T: ${
            r.value.module.end && r.value.module.start
              ? r.value.module.end.getTime() - r.value.module.start.getTime()
              : "NA"
          } P: ${r.value.module.metrics?.processTime ?? "NA"} R: ${
            r.value.module.metrics?.retries ?? "NA"
          } RT: ${r.value.module.metrics?.waitTime ?? "NA"}`;
        })
        .join("\n");
      const typeMetrics = succeededModules.reduce(
        (metrics: Record<string, { avgProcessTime: number; n: number }>, m) => {
          const processTime = m.value.module.metrics?.processTime;
          const type = m.value.module.type;
          if (!type || !processTime) {
            return metrics;
          }
          const record = metrics[type] ?? { avgProcessTime: 0, n: 0 };
          return {
            ...metrics,
            [type]: {
              avgProcessTime:
                (record.avgProcessTime * record.n + processTime) /
                (record.n + 1),
              n: record.n + 1,
            },
          };
        },
        {}
      );
      const metricsMessage = Object.entries(typeMetrics)
        .map(
          (metric) =>
            `${metric[0]} - P: ${metric[1].avgProcessTime} N: ${metric[1].n}`
        )
        .join("\n");

      console.log(`SUCCEEDED:
${succeededMessage}

FAILURES:
${failedMessage}

AGGREGATED METRICS:
${metricsMessage}`);

      // clear tasks
      state.modules = {};
    }
  }

  public async planUpdateStack(
    desiredState: CloudFormationTemplate,
    parameterValues?: ParameterValues,
    assetManifestFile?: string
  ): Promise<{
    assetState: Record<string, boolean>;
    conditionValues: Record<string, boolean>;
    logicalIdsToDelete?: string[];
    logicalIdsToCreateOrUpdate?: string[];
    logicalIdsToSkipUpdate?: string[];
  }> {
    // what assets need to be uploaded?
    const assetManifest = assetManifestFile
      ? AssetManifest.fromFile(assetManifestFile)
      : undefined;

    if (assetManifest?.entries.some((s) => s.type !== "file")) {
      throw new Error(
        "Only file assets are currently supported, found: " +
          assetManifest?.entries
            .filter((s) => s.type !== "file")
            .map((s) => s.type)
            .join(",")
      );
    }

    const fileAssets = assetManifest?.entries.filter(
      (x): x is FileManifestEntry => x.type === "file"
    );

    const s3Client = await this.awsClient.s3Client(this.props.sdkConfig);

    const state: UpdateState = {
      previousState: this.state?.template,
      previousDependencyGraph: this.state?.template
        ? await buildDependencyGraph(this.state.template)
        : undefined,
      desiredState: desiredState,
      desiredDependencyGraph: await buildDependencyGraph(desiredState),
      parameterValues: parameterValues ?? {},
      modules: {},
    };

    const resolvedResources: Record<string, PhysicalResource | undefined> = {};

    const templateResolver = new TemplateResolver(desiredState, {
      conditionReferenceResolver: new DefaultConditionResolver(),
      parameterReferenceResolver: new DefaultParameterResolver(
        parameterValues ?? {},
        { ssmClient: this.ssmClient }
      ),
      pseudoParameterResolver: new DefaultPseudoParameterResolver({
        account: this.account,
        region: this.region,
        stackName: this.stackName,
      }),
      // TODO: extract into a "NO_DEPLOY" resource resolver.
      // attempts to resolve resource references without making any deployments.
      resourceReferenceResolver: {
        resolve: async (logicalId, templateResolver) => {
          if (logicalId in resolvedResources) {
            if (resolvedResources[logicalId]) {
              return {
                value: () => resolvedResources[logicalId]!,
              };
            } else {
              return undefined;
            }
          } else {
            const operation = await computeResourceOperation(
              templateResolver,
              this.getLogicalResource(logicalId, state),
              this.getPhysicalResource(logicalId)
            );
            if (
              operation === "CREATE" ||
              operation === "UPDATE" ||
              operation === "MAYBE_UPDATE"
            ) {
              /**
               * Why don't we return resolved resources when the resolved properties have not changed?
               *
               * We don't know when a resource will be replaced and have some properties deployment resolved change.
               */
              return (resolvedResources[logicalId] = undefined)!;
            } else {
              resolvedResources[logicalId] =
                this.getPhysicalResource(logicalId);
              return { value: () => this.getPhysicalResource(logicalId) };
            }
          }
        },
      },
    });

    const assetState: Record<string, boolean> = Object.fromEntries(
      await Promise.all(
        fileAssets?.map(async (x) => {
          const key = (await (
            await templateResolver.evaluateExpr({
              "Fn::Sub": x.destination.objectKey,
            })
          ).value()) as unknown as string;
          const bucket = (await (
            await templateResolver.evaluateExpr({
              "Fn::Sub": x.destination.bucketName,
            })
          ).value()) as unknown as string;

          return [
            x.id,
            (
              await s3Client
                .listObjectsV2({
                  Prefix: key,
                  Bucket: bucket,
                })
                .promise()
            ).Contents?.some((c) => c.Key === x.destination.objectKey),
          ];
        }) ?? []
      )
    );

    // evaluate rules and conditions
    // TODO rules
    // TODO unresolved conditions with parameters

    const conditionGraph = buildConditionDependencyGraph(desiredState);

    console.log(conditionGraph);

    // conditions should be constants
    const conditionValues = Object.fromEntries(
      await Promise.all(
        Object.entries(desiredState.Conditions ?? {}).map(
          async ([key, cond]) => [
            key,
            await (await templateResolver.evaluateRuleFunction(cond)).value(),
          ]
        )
      )
    );

    console.log(conditionValues);

    // check for deletions

    // TODO: separate create (new), update (changed, dependency changed), and keep
    // TODO: support UNKNOWN when condition is not resolvable
    const logicalIdsToKeepOrCreate = Object.entries(
      state.desiredState?.Resources ?? {}
    )
      // do not create when the condition is false.
      .filter(([, v]) => (v.Condition ? conditionValues[v.Condition] : true))
      .map(([key]) => key);

    // TOOD: decorate with WHY (condition vs missing)
    const logicalIdsToDelete = [
      ...new Set([
        ...Object.keys(state.desiredState?.Resources ?? {}),
        ...Object.keys(state.previousState?.Resources ?? {}),
      ]),
    ].filter((k) => !logicalIdsToKeepOrCreate.includes(k));

    const topoPrevious = state.previousDependencyGraph
      ? topoSortWithLevels(state.previousDependencyGraph)
      : undefined;
    const deleteTopo = topoPrevious
      ?.filter((x) => logicalIdsToDelete.includes(x.resourceId))
      .reverse();

    // check for add/update/delete

    const createUpdateMap = Object.fromEntries(
      await Promise.all(
        logicalIdsToKeepOrCreate.map(async (logicalId) => {
          return [
            logicalId,
            await computeResourceOperation(
              templateResolver,
              this.getLogicalResource(logicalId, state),
              this.getPhysicalResource(logicalId)
            ),
          ] as const;
        })
      )
    );

    const logicalIdsToSkipUpdate = Object.entries(createUpdateMap)
      .filter(([, op]) => op === "SKIP_UPDATE")
      .map(([k]) => k);

    const logicalIdsToCreateOrUpdate = logicalIdsToKeepOrCreate.filter(
      (l) => !logicalIdsToSkipUpdate.includes(l)
    );

    const desiredUpdatedGraph = await buildDependencyGraph(
      state.desiredState,
      templateResolver,
      false
    );
    const topoDesired = topoSortWithLevels(desiredUpdatedGraph);
    const topoCreateUpdate = topoDesired?.filter((x) =>
      logicalIdsToCreateOrUpdate.includes(x.resourceId)
    );

    // TODO display elsewhere.
    const displayEntry: TopoDisplayEntry[] = [
      ...logicalIdsToSkipUpdate?.map((x) => ({
        name: x,
        level: 1,
        additional: "SKIP_UPDATE",
      })),
      ...(topoCreateUpdate?.map((x) => ({
        name: x.resourceId,
        level: x.level,
        additional: createUpdateMap[x.resourceId],
      })) ?? []),
      // TODO invert levels
      ...(deleteTopo?.map((x) => ({
        name: x.resourceId,
        level: x.level,
        additional: "DELETE",
      })) ?? []),
    ];

    console.log("Plan:");
    console.log(displayTopoEntries(displayEntry, true));

    // return steps

    return {
      assetState,
      conditionValues,
      logicalIdsToDelete,
      logicalIdsToCreateOrUpdate,
      logicalIdsToSkipUpdate,
    };
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
    state: UpdateState,
    logicalId: string,
    templateResolver: TemplateResolver
  ): Promise<PhysicalResource | undefined> {
    if (logicalId in state.modules) {
      console.log("Task Cache Hit: " + logicalId);
      return state.modules[logicalId]!.resource;
    } else {
      console.log("Add UPDATE: " + logicalId);
      const logicalResource = this.getLogicalResource(logicalId, state);
      const physicalResource = this.getPhysicalResource(logicalId);
      const update = physicalResource !== undefined;

      return this.startProcessResource(
        logicalId,
        update ? "UPDATE" : "CREATE",
        state,
        state.desiredState?.Resources[logicalId]?.Type,
        async () => {
          // conditions are evaluated first
          if (logicalResource.Condition) {
            const conditionRule =
              state.desiredState?.Conditions?.[logicalResource.Condition];
            if (conditionRule === undefined) {
              throw new Error(
                `Condition '${logicalResource.Condition}' does not exist`
              );
            }
            const shouldCreate = await templateResolver.evaluateRuleFunction(
              conditionRule
            );
            if (!shouldCreate) {
              return {
                resource: undefined,
                processTime: 0,
                retries: 0,
                retryWaitTime: 0,
              };
            }
          }

          const properties = logicalResource.Properties
            ? Object.fromEntries(
                await Promise.all(
                  Object.entries(logicalResource.Properties).map(
                    async ([propName, propExpr]) => [
                      propName,
                      await (
                        await templateResolver.evaluateExpr(propExpr)
                      ).value(),
                    ]
                  )
                )
              )
            : {};

          if (logicalResource.DependsOn) {
            const results = await Promise.allSettled(
              logicalResource.DependsOn.map((logicalDep) =>
                this.updateResource(state, logicalDep, templateResolver)
              )
            );
            const failed = results.filter((s) => s.status === "rejected");
            if (failed.length > 0) {
              throw new Error(`Dependency of ${logicalId} failed, aborting.`);
            }
          }

          const startTime = new Date();

          const provider = this.resourceProviders.getHandler(
            logicalResource.Type
          );

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
                    resourceType: logicalResource.Type,
                  })
                : provider.create({
                    definition: properties,
                    logicalId,
                    resourceType: logicalResource.Type,
                  }));

              const processTime = new Date().getTime() - startTime.getTime();

              if ("resource" in result) {
                if (result.paddingMillis) {
                  self.addDeploymentPadding(result.paddingMillis, state);
                }
                return {
                  resource: result.resource,
                  processTime,
                  retries: attemptsBase - attempts,
                  retryWaitTime: totalDelay,
                };
              } else {
                return {
                  processTime,
                  resource: result,
                  retries: attemptsBase - attempts,
                  retryWaitTime: totalDelay,
                };
              }
            } catch (err) {
              if (attempts > 1) {
                totalDelay += delay;
                console.log(`Waiting for consistency (${delay}): ${logicalId}`);
                await wait(delay);
                return await startWithRetry(attempts - 1, delay * backoff);
              } else {
                console.error(err);
                throw new Error(
                  `Error while ${
                    update ? "updating" : "creating"
                  } ${logicalId}: ${(<any>err).message}`
                );
              }
            }
          }
        }
      ).resource;
    }
  }

  /**
   * Validate the {@link parameterValues} against the {@link Parameter} defintiions in the {@link template}.
   *
   * @param template the {@link CloudFormationTemplate}
   * @param parameterValues input {@link ParameterValues}.
   */
  private async validateParameters(
    template: CloudFormationTemplate,
    parameterValues: ParameterValues | undefined
  ) {
    if (template.Parameters === undefined) {
      if (
        parameterValues !== undefined &&
        Object.keys(parameterValues).length > 0
      ) {
        throw new Error(
          `the template accepts no Parameters, but Parameters were passed to the Template`
        );
      }
    } else {
      for (const [paramName, paramDef] of Object.entries(template.Parameters)) {
        const paramVal = parameterValues?.[paramName];

        validateParameter(paramName, paramDef, paramVal);
      }
    }
  }

  /**
   * Validate the {@link Rules} section of a {@link CloudFormationTemplate}.
   *
   * For each {@link Rule}, validate that the {@link parameterValues} comply with the {@link Assertions}.
   *
   * @param rules the {@link Rules} section of a {@link CloudFormationTemplate}.
   * @param state the {@link UpdateState} of the current evaluation.
   */
  private async validateRules(
    rules: Rules,
    templateResolver: TemplateResolver
  ) {
    const errors = (
      await Promise.all(
        Object.entries(rules).map(async ([ruleId, rule]) =>
          (
            await this.evaluateRule(rule, templateResolver)
          ).map(
            (errorMessage) =>
              `Rule '${ruleId}' failed vaidation: ${errorMessage}`
          )
        )
      )
    ).reduce((a, b) => a.concat(b), []);

    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }
  }

  /**
   * Evaluates a {@link Rule} and returns an array of {@link Assertion} errors.
   *
   * @param rule the {@link Rule} to evaluate.
   * @param state the {@link UpdateState} of the current evaluation.
   * @returns an array of {@link Assertion} errors.
   */
  private async evaluateRule(
    rule: Rule,
    templateResolver: TemplateResolver
  ): Promise<string[]> {
    if (
      rule.RuleCondition === undefined ||
      (await (
        await templateResolver.evaluateRuleFunction(rule.RuleCondition)
      ).value())
    ) {
      return (
        await Promise.all(
          rule.Assertions.map(async (assertion) => {
            const error = await this.evaluateAssertion(
              assertion,
              templateResolver
            );
            return error ? [error] : [];
          })
        )
      ).reduce((a, b) => a.concat(b), []);
    } else {
      return [];
    }
  }

  /**
   * Evalautes an {@link Assertion} against a {@link CloudFormationTemplate}'s {@link Parameters}.
   *
   * @param assertion the {@link Assertion} condition to evaluate.
   * @param state the {@link UpdateState} of the current evaluation.
   * @returns an array of {@link Assertion} errors.
   */
  private async evaluateAssertion(
    assertion: Assertion,
    templateResolver: TemplateResolver
  ): Promise<string | undefined> {
    if (
      !(await (
        await templateResolver.evaluateRuleFunction(assertion.Assert)
      ).value())
    ) {
      return assertion.AssertDescription ?? JSON.stringify(assertion.Assert);
    } else {
      return undefined;
    }
  }
}
