import { PseudoParameter } from "./pseudo-parameter";
import type { Stack } from "./stack";
import { CloudFormationTemplate } from "./template";
import { guard } from "./util";
import { TemplateResolver } from "./resolve-template";

export interface ConditionReference {
  condition: string;
}

export const isConditionReference = guard<ConditionReference>("condition");

export interface ParameterReference {
  parameter: string;
}

export interface MappingReference {
  mapping: string;
}

export interface ResourceReference {
  logicalId: string;
}

export interface PseudoParameterReference {
  pseudoParameter: PseudoParameter;
}

export const isResourceReference = guard<ResourceReference>("logicalId");

export type Dependency =
  | ConditionReference
  | ParameterReference
  | ResourceReference
  | MappingReference
  | PseudoParameterReference;

/**
 * A resource can point to a resource, condition, parameter, or a mapping.
 */
export type ResourceDependency =
  | ParameterReference
  | ResourceReference
  | MappingReference
  | ConditionReference
  | PseudoParameterReference;

/**
 * A condition can point to a condition, parameter, or a mapping.
 */
export type ConditionDependency =
  | ParameterReference
  | ConditionReference
  | MappingReference
  | PseudoParameterReference;

/**
 * Maps a Logical ID to the Logical IDs it depends on.
 */
export interface ResourceDependencyGraph {
  [logicalId: string]: ResourceDependency[];
}

export interface ConditionDependencyGraph {
  [logicalId: string]: ConditionDependency[];
}

/**
 * Builds the {@link ResourceDependencyGraph} for the {@link template}.
 *
 * @param template a {@link CloudFormationTemplate}
 * @returns the {@link ResourceDependencyGraph} for the {@link CloudFormationTemplate}.
 * @throws an Error if the stack is invalid, for example when there are any circular references in the template
 */
export async function buildDependencyGraph(
  template: CloudFormationTemplate,
  templateResolver?: TemplateResolver,
  includeResolved?: boolean
): Promise<ResourceDependencyGraph> {
  const _templateResolver =
    templateResolver ?? new TemplateResolver(template, {});
  const graph: ResourceDependencyGraph = Object.fromEntries(
    await Promise.all(
      Object.entries(template.Resources).map(async ([logicalId, resource]) => {
        const result = resource.Properties
          ? await _templateResolver.evaluateExpr(resource.Properties)
          : undefined;

        return [
          logicalId,
          [
            ...((includeResolved && result?.resolvedDependencies) || []),
            ...(result?.unresolvedDependencies ?? []),
            resource.DependsOn?.map((x) => ({ logicalId: x })),
          ],
        ];
      })
    )
  );

  const circularReferences = findCircularResourceReferences(graph);
  if (circularReferences.length > 0) {
    throw new Error(
      `circular references detected: ${circularReferences.join(",")}`
    );
  }

  return graph;
}

export async function buildConditionDependencyGraph(
  template: CloudFormationTemplate
): Promise<ConditionDependencyGraph> {
  const templateResolver = new TemplateResolver(template, {});
  const graph: ConditionDependencyGraph = Object.fromEntries(
    await Promise.all(
      Object.entries(template.Conditions ?? {}).map(
        async ([logicalId, condition]) => {
          const results = await templateResolver.evaluateRuleFunction(
            condition
          );
          return [
            logicalId,
            [
              ...(results.resolvedDependencies ?? []),
              ...(results.unresolvedDependencies ?? []),
            ],
          ];
        }
      )
    )
  );

  const circularReferences = findCircularConditionReferences(graph);
  if (circularReferences.length > 0) {
    throw new Error(
      `circular references detected: ${circularReferences.join(",")}`
    );
  }

  return graph;
}

export interface TopoEntry {
  /**
   * Id of the node
   */
  resourceId: string;
  /**
   * Depth of the resource, Max depth of all dependencies + 1 or 1
   */
  level: number;
  /**
   * Unique ordinal where the resource has all dependencies resolved
   */
  post: number;
  /**
   * Unique ordinal where the resource was first discovered.
   *
   * Generally this doesn't provide much value, however the distance between post and pre can help
   * determine the complexity of the dependencies of the resource.
   */
  pre: number;
}

/**
 * @param improvedOrder when true, runs the algorithm twice, once with random order keys and again running the lowest
 *                      most dependency first. This should put dependencies as near to their dependents as possible.
 */
export function topoSortWithLevels(
  graph: ResourceDependencyGraph,
  improvedOrder?: boolean,
  filterIds?: string[]
): TopoEntry[] {
  const randomOrderKeys = filterIds
    ? Object.keys(graph).filter((x) => filterIds.includes(x))
    : Object.keys(graph);

  // run once using the random ordered keys
  const topo1 = topoSort(randomOrderKeys);

  if (!improvedOrder) {
    return topo1;
  }

  // run again starting with the lowest depth nodes (highest numbers)
  // to improve the sorted output order
  return topoSort(
    // sort by level descending and run again.
    topo1
      .sort((a, b) => (a.post < b.post ? 1 : a.post > b.post ? -1 : 0))
      .map((a) => a.resourceId)
  );

  function topoSort(keys: string[]) {
    let pres: Record<string, number> = {};
    let posts: Record<string, number> = {};
    let depth: Record<string, number> = {};
    let post = 0; // post-order, when all resolvable children are resolved
    let pre = 0; // pre-order, when the node can be resolved

    keys.forEach(visit);

    return randomOrderKeys
      .map((node) => ({
        resourceId: node,
        level: depth[node]!,
        post: posts[node]!,
        pre: pres[node]!,
      }))
      .sort((a, b) => (a.post < b.post ? -1 : a.post > b.post ? 1 : 0));

    function visit(node: string): number {
      if (node in depth) {
        // ongoing, circular
        if (node in pres && !(node in posts)) {
          throw new Error("Circular reference...");
        }
        return depth[node]!;
      }
      pres[node] = pre++;
      const depths = graph[node]!.filter(isResourceReference)
        .filter((x) => !filterIds || filterIds.includes(x.logicalId))
        .map((r) => visit(r.logicalId));
      if (depths.length === 0) {
        depth[node] = 1;
      } else {
        depth[node] = Math.max(...depths) + 1;
      }
      posts[node] = post++;
      return depth[node]!;
    }
  }
}

function findCircularReferences<G extends Record<string, any>>(
  graph: G,
  dependencies: (values: G[string]) => string[]
): string[] {
  const circularReferences: Record<string, boolean> = {};
  for (const logicalId of Object.keys(graph)) {
    transitReference(logicalId, new Set());
    function transitReference(reference: string, seen: Set<string>): void {
      if (seen.has(reference)) {
        circularReferences[reference] = true;
        return;
      }
      if (reference in circularReferences) {
        return;
      } else {
        // if we see this again, we know it is circular
        const _seen = new Set(seen).add(reference);
        // assume false...
        circularReferences[reference] = false;
        const transitiveReferences = graph[reference];
        if (transitiveReferences === undefined) {
          throw new Error(`reference does not exist: '${reference}'`);
        }
        dependencies(transitiveReferences).forEach((r) =>
          transitReference(r, _seen)
        );
      }
    }
  }
  return Object.entries(circularReferences)
    .filter(([_, v]) => v)
    .map(([k]) => k);
}

export function findCircularResourceReferences(graph: ResourceDependencyGraph) {
  return findCircularReferences(graph, (deps) =>
    deps.filter(isResourceReference).map(({ logicalId }) => logicalId)
  );
}

export function findCircularConditionReferences(
  graph: ConditionDependencyGraph
) {
  return findCircularReferences(graph, (deps) =>
    deps.filter(isConditionReference).map(({ condition }) => condition)
  );
}

/**
 * Return the `logicalId`s from {@link prevState} that do not exist in the {@link desiredState}.
 *
 * @param prevState the previous {@link CloudFormationTemplate} of a {@link Stack}.
 * @param desiredState the new (desired) {@link CloudFormationTemplate} for a {@link Stack}.
 * @returns an array of all `logicalId`s from {@link prevState} that do not exist in the {@link desiredState}.
 */
export function discoverOrphanedDependencies(
  prevState: CloudFormationTemplate,
  desiredState: CloudFormationTemplate
): string[] {
  const oldIds = new Set(Object.keys(prevState.Resources));
  const newIds = new Set(Object.keys(desiredState.Resources));
  return Array.from(oldIds).filter((oldId) => !newIds.has(oldId));
}
