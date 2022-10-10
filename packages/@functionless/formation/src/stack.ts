import * as ssm from "@aws-sdk/client-ssm";

import { Expression } from "./expression";
import {
  IntrinsicFunction,
  isFnBase64,
  isFnContains,
  isFnEachMemberEquals,
  isFnEachMemberIn,
  isFnFindInMap,
  isFnGetAtt,
  isFnIf,
  isFnJoin,
  isFnRefAll,
  isFnSelect,
  isFnSplit,
  isFnSub,
  isFnValueOf,
  isFnValueOfAll,
  isIntrinsicFunction,
  isRef,
  isRefString,
  parseRefString,
} from "./function";
import {
  isFnEquals,
  isFnNot,
  isFnAnd,
  isFnOr,
  isConditionRef,
} from "./condition";
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
} from "./parameter";
import { isPseudoParameter, PseudoParameter } from "./pseudo-parameter";
import {
  PhysicalResource,
  PhysicalResources,
  LogicalResource,
  DeletionPolicy,
  PhysicalProperties,
} from "./resource";
import { Assertion, isRuleFunction, Rule, RuleFunction, Rules } from "./rule";

import { CloudFormationTemplate } from "./template";
import { isDeepEqual, wait } from "./util";
import { Value } from "./value";
import { AssetManifest, AssetPublishing, FileManifestEntry } from "cdk-assets";
import AwsClient from "./aws";
import {
  DefaultResourceProviders,
  ResourceProviders,
} from "./resource-provider";
import { displayTopoEntries, TopoDisplayEntry } from "./display";

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

export interface UpdateState {
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
   * The new {@link CloudFormationTemplate} which triggered the `Update`.
   *
   * This is `undefined` when a {@link Stack} is being deleted..
   */
  desiredState: CloudFormationTemplate | undefined;
  /**
   * The {@link desiredState}'s {@link ResourceDependencyGraph}.
   */
  desiredDependencyGraph: ResourceDependencyGraph | undefined;
  /**
   * Input {@link ParameterValues} for the {@link desiredState}'s {@link Parameters}.
   */
  parameterValues?: ParameterValues;
  /**
   * Map of `logicalId` to a task ({@link Promise}) resolving the new state of the {@link PhysicalResource}.
   */
  modules: {
    [logicalId: string]: Resource;
  };
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
    state: UpdateState
  ): LogicalResource {
    const resource =
      state.desiredState?.Resources[logicalId] ??
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
    const state: UpdateState = {
      previousState: this.state.template,
      previousDependencyGraph: buildDependencyGraph(this.state.template),
      desiredState: undefined,
      desiredDependencyGraph: undefined,
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
  private async deleteResources(logicalIds: string[], state: UpdateState) {
    const allowedLogicalIds = new Set(logicalIds);
    return logicalIds.map((logicalId) =>
      this.deleteResource(logicalId, state, allowedLogicalIds)
    );
  }

  private startProcessResource(
    logicalId: string,
    operation: "UPDATE" | "CREATE" | "DELETE" | undefined,
    state: UpdateState,
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
    state: UpdateState,
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
    state: UpdateState,
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
        state.desiredState?.Resources[logicalId]?.Type,
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
        ? buildDependencyGraph(this.state.template)
        : undefined,
      desiredState: desiredState,
      desiredDependencyGraph: buildDependencyGraph(desiredState),
      parameterValues,
      modules: {},
    };
    try {
      await this.validateParameters(desiredState, parameterValues);
      if (desiredState.Rules) {
        await this.validateRules(desiredState.Rules, state);
      }

      const resourceResults = await Promise.allSettled(
        Object.keys(desiredState.Resources).map(async (logicalId) => {
          const resource = await this.updateResource(state, logicalId);
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
        ? buildDependencyGraph(this.state.template)
        : undefined,
      desiredState: desiredState,
      desiredDependencyGraph: buildDependencyGraph(desiredState),
      parameterValues,
      modules: {},
    };

    const assetState: Record<string, boolean> = Object.fromEntries(
      await Promise.all(
        fileAssets?.map(async (x) => {
          const key = (await this.evaluateExpr(
            { "Fn::Sub": x.destination.objectKey },
            state
          )) as unknown as string;
          const bucket = (await this.evaluateExpr(
            { "Fn::Sub": x.destination.bucketName },
            state
          )) as unknown as string;

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
            await this.evaluateRuleFunction(cond, state),
          ]
        )
      )
    );

    console.log(conditionValues);

    // check for deletions

    // TODO: separate create (new), update (changed, dependency changed), and keep
    const logicalIdsToCreateOrUpdate = Object.entries(
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
    ].filter((k) => !logicalIdsToCreateOrUpdate.includes(k));

    const topoPrevious = state.previousDependencyGraph
      ? topoSortWithLevels(state.previousDependencyGraph)
      : undefined;
    const deleteTopo = topoPrevious
      ?.filter((x) => logicalIdsToDelete.includes(x.resourceId))
      .reverse();

    // check for add/update/delete

    const createUpdateMap = Object.fromEntries(
      logicalIdsToCreateOrUpdate.map((logicalId) => [
        logicalId,
        state.previousState && logicalId in state.previousState?.Resources
          ? "UPDATE"
          : "CREATE",
      ])
    );

    const topoDesired = state.desiredDependencyGraph
      ? topoSortWithLevels(state.desiredDependencyGraph)
      : undefined;
    const topoCreateUpdate = topoDesired?.filter((x) =>
      logicalIdsToCreateOrUpdate.includes(x.resourceId)
    );

    const displayEntry: TopoDisplayEntry[] = [
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
    logicalId: string
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
            const shouldCreate = await this.evaluateRuleExpressionToBoolean(
              conditionRule,
              state
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
                      await this.evaluateExpr(propExpr, state),
                    ]
                  )
                )
              )
            : {};

          if (logicalResource.DependsOn) {
            const results = await Promise.allSettled(
              logicalResource.DependsOn.map((logicalDep) =>
                this.updateResource(state, logicalDep)
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
   * Evaluates an {@link Expression} to a {@link PhysicalProperty}.
   *
   * This property may come from evaluating an intrinsic function or by fetching
   * an attribute from a physically deployed resource.
   *
   * @param expr expression to evaluate
   * @param state the {@link UpdateState} being evaluated
   * @returns the physical property as a primitive JSON object
   */
  private async evaluateExpr(
    expr: Expression,
    state: UpdateState
  ): Promise<Value> {
    if (expr === undefined || expr === null) {
      return expr;
    } else if (isIntrinsicFunction(expr)) {
      return this.evaluateIntrinsicFunction(state, expr);
    } else if (typeof expr === "string") {
      if (isRefString(expr)) {
        return this.evaluateIntrinsicFunction(state, parseRefString(expr));
      } else if (isPseudoParameter(expr)) {
        return this.evaluatePseudoParameter(expr);
      } else {
        return expr;
      }
    } else if (Array.isArray(expr)) {
      return Promise.all(
        expr
          // hack to remove NoValue from an array
          .filter(
            (v) =>
              !(
                v &&
                typeof v === "object" &&
                "Ref" in v &&
                v.Ref === "AWS::NoValue"
              )
          )
          .map((e) => this.evaluateExpr(e, state))
      );
    } else if (typeof expr === "object") {
      return (
        await Promise.all(
          Object.entries(expr).map(async ([k, v]) => ({
            [k]: await this.evaluateExpr(v, state),
          }))
        )
      ).reduce((a, b) => ({ ...a, ...b }), {});
    } else {
      return expr;
    }
  }

  /**
   * Evaluate a CloudFormation {@link IntrinsicFunction} to a {@link PhysicalProperty}.
   *
   * @param expr intrinsic function expression
   * @returns the physical value of the function
   */
  private async evaluateIntrinsicFunction(
    state: UpdateState,
    expr: IntrinsicFunction
  ): Promise<Value> {
    const parameters = state.desiredState?.Parameters ?? {};
    const parameterValues = state.parameterValues ?? {};

    if (isRef(expr)) {
      if (isPseudoParameter(expr.Ref)) {
        return this.evaluatePseudoParameter(expr.Ref);
      }
      const paramDef = parameters[expr.Ref];
      if (paramDef !== undefined) {
        return this.evaluateParameter(state, expr.Ref, paramDef);
      } else {
        const resource = await this.updateResource(state, expr.Ref);
        // TODO: find a way to abstract this
        if (resource?.Type === "AWS::SQS::Queue") {
          return resource.Attributes.QueueUrl;
        }
        return resource?.PhysicalId;
      }
    } else if (isFnGetAtt(expr)) {
      const [logicalId, attributeName] = expr["Fn::GetAtt"];
      const resource = await this.updateResource(state, logicalId);
      if (resource === undefined) {
        throw new Error(
          `Resource '${logicalId}' does not exist, perhaps a Condition is preventing it from being created?`
        );
      }
      const attributeValue = resource.Attributes[attributeName];
      if (attributeValue === undefined) {
        throw new Error(
          `attribute '${attributeName}' does not exist on resource '${logicalId}' of type '${resource.Type}'`
        );
      }
      return attributeValue;
    } else if (isFnJoin(expr)) {
      const [delimiter, values] = expr["Fn::Join"];
      return (
        await Promise.all(
          values.map((value) => this.evaluateExpr(value, state))
        )
      ).join(delimiter);
    } else if (isFnSelect(expr)) {
      const [index, listOfObjects] = expr["Fn::Select"];
      if (isIntrinsicFunction(listOfObjects)) {
        const evaled = await this.evaluateIntrinsicFunction(
          state,
          listOfObjects
        );
        if (!Array.isArray(evaled)) {
          throw new Error(`Expected an array, found: ${evaled}`);
        } else if (index in evaled) {
          return evaled[index];
        } else {
          throw new Error(`index ${index} out of bounds in list: ${evaled}`);
        }
      }
      if (index in listOfObjects) {
        return this.evaluateExpr(listOfObjects[index]!, state);
      } else {
        throw new Error(
          `index ${index} out of bounds in list: ${listOfObjects}`
        );
      }
    } else if (isFnSplit(expr)) {
      const [delimiter, sourceStringExpr] = expr["Fn::Split"];
      const sourceString = await this.evaluateExpr(sourceStringExpr, state);
      if (typeof sourceString !== "string") {
        throw new Error(
          `Fn::Split must operate on a String, but received: ${typeof sourceString}`
        );
      }
      return sourceString.split(delimiter);
    } else if (isFnSub(expr)) {
      const [string, variables] =
        typeof expr["Fn::Sub"] === "string"
          ? [expr["Fn::Sub"], {}]
          : expr["Fn::Sub"];
      const resolvedValues = Object.fromEntries(
        await Promise.all(
          Object.entries(variables).map(async ([varName, varVal]) => [
            varName,
            await this.evaluateExpr(varVal, state),
          ])
        )
      );

      // match "something ${this} something"
      return string.replace(/\$\{([^\}]*)\}/g, (_, varName) => {
        const varVal =
          varName in resolvedValues
            ? resolvedValues[varName]
            : isPseudoParameter(varName)
            ? this.evaluatePseudoParameter(varName)
            : undefined;
        if (
          typeof varVal === "string" ||
          typeof varVal === "number" ||
          typeof varVal === "boolean"
        ) {
          return `${varVal}`;
        } else {
          throw new Error(
            `Variable '${varName}' in Fn::Sub did not resolve to a String, Number or Boolean: ${varVal}`
          );
        }
      });
    } else if (isFnBase64(expr)) {
      const exprVal = await this.evaluateExpr(expr["Fn::Base64"], state);
      if (typeof exprVal === "string") {
        return Buffer.from(exprVal, "utf8").toString("base64");
      } else {
        throw new Error(
          `Fn::Base64 can only convert String values to Base64, but got '${typeof exprVal}'`
        );
      }
    } else if (isFnFindInMap(expr)) {
      const [mapName, topLevelKeyExpr, secondLevelKeyExpr] =
        expr["Fn::FindInMap"];

      const [topLevelKey, secondLevelKey] = await Promise.all([
        this.evaluateExpr(topLevelKeyExpr, state),
        this.evaluateExpr(secondLevelKeyExpr, state),
      ]);
      if (typeof topLevelKey !== "string") {
        throw new Error(
          `The topLevelKey in Fn::FindInMap must be a string, but got ${typeof topLevelKeyExpr}`
        );
      }
      if (typeof secondLevelKey !== "string") {
        throw new Error(
          `The secondLevelKey in Fn::FindInMap must be a string, but got ${typeof secondLevelKeyExpr}`
        );
      }
      const value =
        state.desiredState?.Mappings?.[mapName]?.[topLevelKey]?.[
          secondLevelKey
        ];
      if (value === undefined) {
        throw new Error(
          `Could not find map value: ${mapName}.${topLevelKey}.${secondLevelKey}`
        );
      }
      return value;
    } else if (isFnRefAll(expr)) {
      return Object.entries(parameters)
        .map(([paramName, paramDef]) =>
          paramDef.Type === expr["Fn::RefAll"]
            ? parameterValues[paramName]
            : undefined
        )
        .filter((paramVal) => paramVal !== undefined);
    } else if (isFnIf(expr)) {
      const [_when, thenExpr, elseExpr] = expr["Fn::If"];

      const whenExpr =
        typeof _when === "string"
          ? state.desiredState?.Conditions?.[_when]
          : _when;

      if (!whenExpr) {
        throw new Error(
          "When clause of Fn::If must be defined and if it is a reference, it must exist."
        );
      }

      const when = await this.evaluateRuleFunction(whenExpr, state);
      if (when === true) {
        return this.evaluateExpr(thenExpr, state);
      } else if (when === false) {
        return this.evaluateExpr(elseExpr, state);
      } else {
        throw new Error(`invalid value for 'condition' in Fn:If: ${whenExpr}`);
      }
    }

    throw new Error(
      `expression not implemented: ${Object.keys(expr).join(",")}`
    );
  }

  /**
   * Evaluate a {@link RuleFunction} or {@link ConditionFunction} to a boolean.
   */
  private async evaluateRuleFunction(
    expr: RuleFunction,
    state: UpdateState
  ): Promise<boolean> {
    if (isFnEquals(expr)) {
      const [left, right] = await Promise.all(
        expr["Fn::Equals"].map((expr) =>
          isRuleFunction(expr)
            ? this.evaluateRuleFunction(expr, state)
            : this.evaluateExpr(expr, state)
        )
      );
      return isDeepEqual(left, right);
    } else if (isFnNot(expr)) {
      const [condition] = await Promise.all(
        expr["Fn::Not"].map((expr) =>
          isRuleFunction(expr)
            ? this.evaluateRuleFunction(expr, state)
            : this.evaluateExpr(expr, state)
        )
      );
      if (typeof condition === "boolean") {
        return !condition;
      } else {
        throw new Error(
          `Malformed input to Fn::Not - expected a boolean but received ${typeof condition}`
        );
      }
    } else if (isFnAnd(expr)) {
      if (expr["Fn::And"].length === 0) {
        throw new Error(
          `Malformed input to Fn::And - your must provide at least one [{condition}].`
        );
      }
      return (
        await Promise.all(
          expr["Fn::And"].map((expr) =>
            isRuleFunction(expr)
              ? this.evaluateRuleFunction(expr, state)
              : this.evaluateExpr(expr, state)
          )
        )
      ).reduce((a: boolean, b) => {
        if (typeof b !== "boolean") {
          throw new Error(
            `Malformed input to Fn::And - expected a boolean but received ${typeof b}`
          );
        }
        return a && b;
      }, true);
    } else if (isFnOr(expr)) {
      if (expr["Fn::Or"].length === 0) {
        throw new Error(
          `Malformed input to Fn::Or - your must provide at least one [{condition}].`
        );
      }
      return (
        await Promise.all(
          expr["Fn::Or"].map((expr) =>
            isRuleFunction(expr)
              ? this.evaluateRuleFunction(expr, state)
              : this.evaluateExpr(expr, state)
          )
        )
      ).reduce((a: boolean, b) => {
        if (typeof b !== "boolean") {
          throw new Error(
            `Malformed input to Fn::Or - expected a boolean but received ${typeof b}`
          );
        }
        return a || b;
      }, false);
    } else if (isFnContains(expr)) {
      const [listOfStrings, string] = await Promise.all(
        expr["Fn::Contains"].map((expr) => this.evaluateExpr(expr, state))
      );

      assertIsListOfStrings(listOfStrings, "listOfStrings");
      assertIsString(string, "string");

      return listOfStrings.includes(string);
    } else if (isFnEachMemberEquals(expr)) {
      const [listOfStrings, string] = await Promise.all(
        expr["Fn::EachMemberEquals"].map((expr) =>
          this.evaluateExpr(expr, state)
        )
      );

      assertIsListOfStrings(listOfStrings, "listOfStrings");
      assertIsString(string, "string");

      return listOfStrings.find((s) => s !== string) === undefined;
    } else if (isFnEachMemberIn(expr)) {
      const [stringsToCheck, stringsToMatch] = await Promise.all(
        expr["Fn::EachMemberIn"].map((expr) => this.evaluateExpr(expr, state))
      );

      assertIsListOfStrings(stringsToCheck, "stringsToCheck");
      assertIsListOfStrings(stringsToMatch, "stringsToMatch");

      return stringsToCheck.every((check) => stringsToMatch.includes(check));
    } else if (isFnValueOf(expr)) {
      throw new Error("Fn::ValueOf is not yet supported");
    } else if (isFnValueOfAll(expr)) {
      throw new Error("Fn::ValueOfAll is not yet supported");
    } else if (isFnRefAll(expr)) {
      throw new Error("Fn::refAll is not yet supported");
    } else if (isConditionRef(expr)) {
      const condition = state.desiredState?.Conditions?.[expr.Condition];
      if (!condition) {
        throw new Error("Condition does not exist: " + expr.Condition);
      }
      return this.evaluateRuleFunction(condition, state);
    }
    const __exhaustive: never = expr;
    return __exhaustive;
  }

  /**
   * Evaluate a {@link PseudoParameter} and return its value.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html
   */
  private evaluatePseudoParameter(expr: PseudoParameter) {
    if (expr === "AWS::AccountId") {
      return this.account;
    } else if (expr === "AWS::NoValue") {
      return null;
    } else if (expr === "AWS::Region") {
      return this.region;
    } else if (expr === "AWS::Partition") {
      // gov regions are not supported
      return "aws";
    } else if (expr === "AWS::NotificationARNs") {
      // don't yet support sending notifications to SNS
      // on top of supporting this, we could also provide native JS hooks into the engine
      return [];
    } else if (expr === "AWS::StackId") {
      return this.stackName;
    } else if (expr === "AWS::StackName") {
      return this.stackName;
    } else {
      throw new Error(`unsupported Pseudo Parameter '${expr}'`);
    }
  }

  /**
   * Determine the value of a {@link paramName}.
   *
   * If the {@link Parameter} is a {@link SSMParameterType} then the value is fetched
   * from AWS Systems Manager Parameter Store.
   *
   * The {@link CloudFormationTemplate}'s {@link Parameter}s and the input {@link ParameterValues}
   * are assumed to be valid because the {@link validateParameters} function is called by
   * {@link updateStack}.
   *
   * @param state {@link UpdateState} being evaluated.
   * @param paramName name of the {@link Parameter}.
   * @param paramDef the {@link Parameter} definition in the source {@link CloudFormationTemplate}.
   */
  private async evaluateParameter(
    state: UpdateState,
    paramName: string,
    paramDef: Parameter
  ): Promise<Value> {
    let paramVal = state.parameterValues?.[paramName];
    if (paramVal === undefined) {
      if (paramDef.Default !== undefined) {
        paramVal = paramDef.Default;
      } else {
        throw new Error(`Missing required input-Parameter ${paramName}`);
      }
    }

    const type = paramDef.Type;

    if (type === "String" || type === "Number") {
      return paramVal;
    } else if (type === "CommaDelimitedList") {
      return (paramVal as string).split(",");
    } else if (type === "List<Number>") {
      return (paramVal as string).split(",").map((s) => parseInt(s, 10));
    } else if (
      type.startsWith("AWS::EC2") ||
      type.startsWith("AWS::Route53") ||
      type.startsWith("List<AWS::EC2") ||
      type.startsWith("List<AWS::Route53")
    ) {
      return paramVal;
    } else if (type.startsWith("AWS::SSM")) {
      try {
        const ssmParamVal = await this.ssmClient.send(
          new ssm.GetParameterCommand({
            Name: paramVal as string,
            WithDecryption: true,
          })
        );

        if (
          ssmParamVal.Parameter?.Name === undefined ||
          ssmParamVal.Parameter.Value === undefined
        ) {
          throw new Error(`GetParameter '${paramVal}' returned undefined`);
        }

        if (type === "AWS::SSM::Parameter::Name") {
          return ssmParamVal.Parameter.Name;
        } else if (type === "AWS::SSM::Parameter::Value<String>") {
          if (ssmParamVal.Parameter.Type !== "String") {
            throw new Error(
              `Expected SSM Parameter ${paramVal} to be ${type} but was ${ssmParamVal.Parameter.Type}`
            );
          }
          return ssmParamVal.Parameter.Value;
        } else if (
          type === "AWS::SSM::Parameter::Value<List<String>>" ||
          type.startsWith("AWS::SSM::Parameter::Value<List<")
        ) {
          if (ssmParamVal.Parameter.Type !== "StringList") {
            throw new Error(
              `Expected SSM Parameter ${paramVal} to be ${type} but was ${ssmParamVal.Parameter.Type}`
            );
          }
          return ssmParamVal.Parameter.Value.split(",");
        } else {
        }
      } catch (err) {
        throw err;
      }
    }

    return paramVal;
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
  private async validateRules(rules: Rules, state: UpdateState) {
    const errors = (
      await Promise.all(
        Object.entries(rules).map(async ([ruleId, rule]) =>
          (
            await this.evaluateRule(rule, state)
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
    state: UpdateState
  ): Promise<string[]> {
    if (
      rule.RuleCondition === undefined ||
      (await this.evaluateRuleExpressionToBoolean(rule.RuleCondition, state))
    ) {
      return (
        await Promise.all(
          rule.Assertions.map(async (assertion) => {
            const error = await this.evaluateAssertion(assertion, state);
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
    state: UpdateState
  ): Promise<string | undefined> {
    if (
      !(await this.evaluateRuleExpressionToBoolean(assertion.Assert, state))
    ) {
      return assertion.AssertDescription ?? JSON.stringify(assertion.Assert);
    } else {
      return undefined;
    }
  }

  /**
   * Evaluate a {@link RuleFunction} to a `boolean`.
   *
   * @param rule the {@link RuleFunction} to evaluate.
   * @param state the {@link UpdateState} of the current evaluation.
   * @returns the evaluated `boolean` value of the {@link rule}.
   * @throws an Error if the {@link rule} does not evaluate to a `boolean`.
   */
  private async evaluateRuleExpressionToBoolean(
    rule: RuleFunction,
    state: UpdateState
  ): Promise<boolean> {
    const result = await this.evaluateRuleFunction(rule, state);
    if (typeof result === "boolean") {
      return result;
    } else {
      throw new Error(
        `rule must evaluate to a Boolean, but evalauted to ${typeof result}`
      );
    }
  }
}

function assertIsString(
  string: any,
  argumentName: string
): asserts string is string {
  if (typeof string !== "string") {
    throw new Error(
      `The ${argumentName} must be a string, but was ${typeof string}`
    );
  }
}

function assertIsListOfStrings(
  strings: any,
  argumentName: string
): asserts strings is string[] {
  if (
    !Array.isArray(strings) ||
    strings.find((s) => typeof s !== "string") !== undefined
  ) {
    throw new Error(
      `The ${argumentName} argument must be a list of strings, but was ${typeof strings}`
    );
  } else if (strings.length === 0) {
    throw new Error(`The ${argumentName} cannot be empty.`);
  }
}
