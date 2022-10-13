import * as ssm from "@aws-sdk/client-ssm";

import { DefaultConditionResolver } from "./condition";
import {
  buildDependencyGraph,
  ResourceDependencyGraph,
  topoSortWithLevels,
  TopoEntry,
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
  PhysicalProperties,
  computeResourceOperation,
  ResourceOperation,
  ResourceDeploymentPlanExecutor,
} from "./resource";
import { Assertion, Rule, Rules } from "./rule";

import { CloudFormationTemplate } from "./template";
import { AssetManifest, AssetPublishing, FileManifestEntry } from "cdk-assets";
import AwsClient from "./aws";
import {
  DefaultResourceProviders,
  ResourceProviders,
} from "./resource-provider";
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

export interface ResourceDeploymentPlanEntry {
  operation: ResourceOperation;
  // TODO: update the reason to be data driven and format the text later.
  reason?: string;
}

export interface ResourceDeploymentPlan {
  /**
   * A map of asset id to whether or not it already exists in the target account.
   */
  assetState: Record<string, boolean>;
  conditionValues: Record<string, boolean>;
  topoSortedCreateUpdates: TopoEntry[];
  topoSortedDeletes?: TopoEntry[];
  resourceOperationMap: Record<string, ResourceDeploymentPlanEntry>;
  outputs: string[];
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
   * Delete all resources in this Stack.
   */
  public async deleteStack(): Promise<void> {
    if (this.state === undefined) {
      throw new Error(
        `Cannot delete stack '${this.stackName}' since it does not exist.`
      );
    }

    const dependencyGraph = await buildDependencyGraph(this.state.template);

    const plan = this.generateDeletePlan(this.state, dependencyGraph);

    const executor = new ResourceDeploymentPlanExecutor(
      plan,
      this.state.template,
      this.resourceProviders,
      {},
      this.state
    );

    await executor.execute();

    // set the state to `undefined` - this stack is goneskies
    this.state = undefined;
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
    const assetManifest = assetManifestFile
      ? AssetManifest.fromFile(assetManifestFile)
      : undefined;

    const plan = await this.generateUpdatePlan(
      desiredState,
      parameterValues ?? {},
      assetManifest
    );

    const resourcePlanExecutor = new ResourceDeploymentPlanExecutor(
      plan,
      desiredState,
      this.resourceProviders,
      {
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
      },
      this.state
    );

    let executionResult;

    try {
      // TODO move into the plan executor?
      const publisher = assetManifest
        ? new AssetPublishing(assetManifest, {
            aws: this.awsClient,
            buildAssets: false,
          })
        : undefined;

      // publish any assets that need publishing
      // TODO: move these into the tree?
      await Promise.all(
        assetManifest?.entries
          .filter(
            (a) =>
              a.id.toString() in plan.assetState &&
              !plan.assetState[a.id.toString()]
          )
          .map(async (a) => {
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

      executionResult = await resourcePlanExecutor.execute();

      if (executionResult.errors.length > 0) {
        console.error(
          "Deployment Failed:\n" + executionResult.errors.join("\n")
        );
        throw new Error(
          "Deployment Failed:\n" + executionResult.errors.join("\n")
        );
      }

      // create new resources
      this.state = {
        template: desiredState,
        resources: Object.fromEntries(
          executionResult.completedResources
            .filter((r) => r.operation !== "DELETE" && !!r.resource)
            .map((r) => [r.logicalId, r.resource!])
        ),
        outputs: executionResult.outputs,
      };

      return this.state;
    } finally {
      console.log("Cleaning Up");

      // await any leaf tasks not awaited already
      const failedMessage = executionResult?.errors
        .map((r) => "Resource failed: " + r)
        .join("\n");

      const succeededMessage = executionResult?.completedResources
        .map((r) => {
          const logicalResource =
            desiredState.Resources[r.logicalId] ??
            this.state?.template?.Resources[r.logicalId];

          if (!logicalResource) {
            throw new Error(`Logical resource not found for ${r.logicalId}`);
          }

          // TODO: output in a consumable form
          return `Resource complete: ${r.logicalId} - (${
            logicalResource?.Type
          }) - T: ${
            r.end && r.start ? r.end.getTime() - r.start.getTime() : "NA"
          } P: ${r.metrics?.processTime ?? "NA"} R: ${
            r.metrics?.retries ?? "NA"
          } RT: ${r.metrics?.waitTime ?? "NA"}`;
        })
        .join("\n");
      const typeMetrics = executionResult?.completedResources.reduce(
        (metrics: Record<string, { avgProcessTime: number; n: number }>, m) => {
          const logicalResource =
            desiredState.Resources[m.logicalId] ??
            this.state?.template?.Resources[m.logicalId];

          if (!logicalResource) {
            throw new Error(`Logical resource not found for ${m.logicalId}`);
          }

          const processTime = m.metrics?.processTime;
          const type = logicalResource.Type;
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
      const metricsMessage = typeMetrics
        ? Object.entries(typeMetrics)
            .map(
              (metric) =>
                `${metric[0]} - P: ${metric[1].avgProcessTime} N: ${metric[1].n}`
            )
            .join("\n")
        : undefined;

      console.log(`SUCCEEDED:
${succeededMessage}

FAILURES:
${failedMessage}

AGGREGATED METRICS:
${metricsMessage}`);
    }
  }

  public async planUpdateStack(
    desiredState: CloudFormationTemplate,
    parameterValues?: ParameterValues,
    assetManifestFile?: string
  ) {
    // what assets need to be uploaded?
    const assetManifest = assetManifestFile
      ? AssetManifest.fromFile(assetManifestFile)
      : undefined;

    return this.generateUpdatePlan(
      desiredState,
      parameterValues ?? {},
      assetManifest
    );
  }

  private async generateUpdatePlan(
    desiredState: CloudFormationTemplate,
    parameterValues: ParameterValues,
    assetManifest?: AssetManifest
  ): Promise<ResourceDeploymentPlan> {
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
            const operation = (
              await computeResourceOperation(
                templateResolver,
                desiredState.Resources[logicalId]!,
                this.state?.resources[logicalId],
                this.state?.template.Resources[logicalId]
              )
            ).operation;
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

    await this.validateParameters(desiredState, parameterValues);

    if (desiredState.Rules) {
      await this.validateRules(desiredState.Rules, templateResolver);
    }

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

    // const conditionGraph = await buildConditionDependencyGraph(desiredState);

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

    // check for deletions

    // TODO: separate create (new), update (changed, dependency changed), and keep
    // TODO: support UNKNOWN when condition is not resolvable
    const logicalIdsWithConditionFalse = Object.entries(
      desiredState?.Resources ?? {}
    )
      // do not create when the condition is false.
      .filter(([, v]) => v.Condition && !conditionValues[v.Condition])
      .map(([key]) => key);

    const logicalIdsToKeepOrCreate = Object.keys(desiredState?.Resources ?? {})
      // do not create when the condition is false.
      .filter((k) => !logicalIdsWithConditionFalse.includes(k));

    // TOOD: decorate with WHY (condition vs missing)
    const logicalIdsToDelete = [
      ...new Set([
        ...Object.keys(desiredState?.Resources ?? {}),
        ...Object.keys(this.state?.template.Resources ?? {}),
      ]),
    ].filter((k) => !logicalIdsToKeepOrCreate.includes(k));

    const previousDependencyGraph = this.state?.template
      ? await buildDependencyGraph(this.state?.template)
      : undefined;

    // topologically sort using only the deleted keys
    const deleteTopo = previousDependencyGraph
      ? topoSortWithLevels(previousDependencyGraph, true, logicalIdsToDelete)
      : undefined;

    // check for add/update/delete

    const resourceOperationMap: ResourceDeploymentPlan["resourceOperationMap"] =
      Object.fromEntries(
        await Promise.all([
          ...logicalIdsToKeepOrCreate.map(async (logicalId) => {
            return [
              logicalId,
              await computeResourceOperation(
                templateResolver,
                desiredState.Resources[logicalId]!,
                this.state?.resources[logicalId],
                this.state?.template.Resources[logicalId]
              ),
            ] as const;
          }),
          ...logicalIdsToDelete.map((id) => [
            id,
            {
              operation: "DELETE",
              reason: logicalIdsWithConditionFalse.includes(id)
                ? "Resource condition was false"
                : "Resource does not exist in the new template",
            },
          ]),
        ])
      );

    const logicalIdsToSkipUpdate = Object.entries(resourceOperationMap)
      .filter(([, op]) => op.operation === "SKIP_UPDATE")
      .map(([k]) => k);

    const logicalIdsToCreateOrUpdate = logicalIdsToKeepOrCreate.filter(
      (l) => !logicalIdsToSkipUpdate.includes(l)
    );

    const desiredUpdatedGraph = await buildDependencyGraph(
      desiredState,
      templateResolver,
      false
    );

    // topologically sort with only the ids being created
    const topoCreateUpdate = topoSortWithLevels(
      desiredUpdatedGraph,
      true,
      logicalIdsToCreateOrUpdate
    );

    // return steps

    return {
      assetState,
      conditionValues,
      topoSortedCreateUpdates: topoCreateUpdate,
      topoSortedDeletes: deleteTopo,
      resourceOperationMap: resourceOperationMap,
      outputs: Object.keys(desiredState.Outputs ?? {}),
    };
  }

  private generateDeletePlan(
    state: StackState,
    previousDependencyGraph: ResourceDependencyGraph
  ): ResourceDeploymentPlan {
    const ids = Object.keys(state.resources);

    // topologically sort using only the deleted keys
    const deleteTopo = topoSortWithLevels(previousDependencyGraph, true, ids);

    return {
      assetState: {},
      conditionValues: {},
      resourceOperationMap: Object.fromEntries(
        ids.map((id) => [id, { operation: "DELETE" }])
      ),
      topoSortedCreateUpdates: [],
      topoSortedDeletes: deleteTopo,
      outputs: Object.keys(state.template.Outputs ?? {}),
    };
  }

  /**
   * Validate the {@link parameterValues} against the {@link Parameter} definitions in the {@link template}.
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
      Object.entries(template.Parameters).forEach(([paramName, paramDef]) => {
        const paramVal = parameterValues?.[paramName];

        validateParameter(paramName, paramDef, paramVal);
      });
    }
  }

  /**
   * Validate the {@link Rules} section of a {@link CloudFormationTemplate}.
   *
   * For each {@link Rule}, validate that the {@link parameterValues} comply with the {@link Assertions}.
   *
   * @param rules the {@link Rules} section of a {@link CloudFormationTemplate}.
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
              `Rule '${ruleId}' failed validation: ${errorMessage}`
          )
        )
      )
    ).flat();

    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }
  }

  /**
   * Evaluates a {@link Rule} and returns an array of {@link Assertion} errors.
   *
   * @param rule the {@link Rule} to evaluate.
   * @returns an array of {@link Assertion} errors.
   */
  private async evaluateRule(
    rule: Rule,
    templateResolver: TemplateResolver
  ): Promise<string[]> {
    return rule.RuleCondition === undefined ||
      (await (
        await templateResolver.evaluateRuleFunction(rule.RuleCondition)
      ).value())
      ? (
          await Promise.all(
            rule.Assertions.map(async (assertion) => {
              const error = await this.evaluateAssertion(
                assertion,
                templateResolver
              );
              return error ? [error] : [];
            })
          )
        ).flat()
      : [];
  }

  /**
   * Evaluates an {@link Assertion} against a {@link CloudFormationTemplate}'s {@link Parameters}.
   *
   * @param assertion the {@link Assertion} condition to evaluate.
   * @returns an array of {@link Assertion} errors.
   */
  private async evaluateAssertion(
    assertion: Assertion,
    templateResolver: TemplateResolver
  ): Promise<string | undefined> {
    return !(await (
      await templateResolver.evaluateRuleFunction(assertion.Assert)
    ).value())
      ? assertion.AssertDescription ?? JSON.stringify(assertion.Assert)
      : undefined;
  }
}
