import { Expression } from "./expression";
import {
  isIntrinsicFunction,
  isRef,
  isFnGetAtt,
  isFnIf,
  isFnFindInMap,
} from "./function";
import { isConditionRef } from "./condition";
import { isPseudoParameter } from "./pseudo-parameter";
import type { Stack } from "./stack";
import { CloudFormationTemplate } from "./template";
import { guard } from "./util";
import { isRuleFunction, RuleFunction } from "./rule";

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

export const isResourceReference = guard<ResourceReference>("logicalId");

export type Dependency =
  | ConditionReference
  | ParameterReference
  | ResourceReference
  | MappingReference;

/**
 * A resource can point to a resource, condition, parameter, or a mapping.
 */
export type ResourceDependency =
  | ParameterReference
  | ResourceReference
  | MappingReference
  | ConditionReference;

/**
 * A condition can point to a condition, parameter, or a mapping.
 */
export type ConditionDependency =
  | ParameterReference
  | ConditionReference
  | MappingReference;

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
export function buildDependencyGraph(
  template: CloudFormationTemplate
): ResourceDependencyGraph {
  const graph: ResourceDependencyGraph = Object.fromEntries(
    Object.entries(template.Resources).map(([logicalId, resource]) => {
      const deps = [
        ...(resource.Properties
          ? Array.from(new Set(findReferences(resource.Properties)))
          : []),
        ...(resource.DependsOn ?? []),
      ].map((x) => referenceStringToDependency(template, x));
      return [logicalId, deps];
    })
  );

  const circularReferences = findCircularResourceReferences(graph);
  if (circularReferences.length > 0) {
    throw new Error(
      `circular references detected: ${circularReferences.join(",")}`
    );
  }

  return graph;
}

export function buildConditionDependencyGraph(
  template: CloudFormationTemplate
): ConditionDependencyGraph {
  const graph: ConditionDependencyGraph = Object.fromEntries(
    Object.entries(template.Conditions ?? {}).map(([logicalId, condition]) => {
      const deps = findReferences(condition).map((x) => {
        const d = referenceStringToDependency(template, x);
        if (isResourceReference(d)) {
          throw new Error("Conditions cannot reference resources: " + x);
        }
        return d;
      });
      return [logicalId, deps];
    })
  );

  const circularReferences = findCircularConditionReferences(graph);
  if (circularReferences.length > 0) {
    throw new Error(
      `circular references detected: ${circularReferences.join(",")}`
    );
  }

  return graph;
}

function referenceStringToDependency(
  template: CloudFormationTemplate,
  reference: string
): Dependency {
  if (reference in template.Resources) {
    return { logicalId: reference };
  } else if (reference in (template.Conditions ?? {})) {
    return { condition: reference };
  } else if (reference in (template.Mappings ?? {})) {
    return { mapping: reference };
  } else if (reference in (template.Parameters ?? {})) {
    return { parameter: reference };
  }

  throw new Error("Reference is not found in the template: " + reference);
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
  improvedOrder?: boolean
): TopoEntry[] {
  const randomOrderKeys = Object.keys(graph);

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

    console.log(keys);

    keys.forEach(visit);

    return Object.keys(graph)
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
      const depths = graph[node]!.filter(isResourceReference).map((r) =>
        visit(r.logicalId)
      );
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
 * Find references in intrinsic expressions until we run out of values or
 * a rule function is found.
 */
function findReferences(expr: Expression | RuleFunction): string[] {
  // is a rile function, except for Condition:
  // Condition can be ambiguous with a object in a Resource
  // with the key Condition.
  if (isRuleFunction(expr) && !isConditionRef(expr)) {
    return findConditionReferences(expr);
  } else if (isIntrinsicFunction(expr)) {
    if (isRef(expr)) {
      if (isPseudoParameter(expr.Ref)) {
        return [];
      }
      return [expr.Ref];
    } else if (isFnGetAtt(expr)) {
      return [expr["Fn::GetAtt"][0]];
    } else if (isFnFindInMap(expr)) {
      const [mapName, ...tail] = expr["Fn::FindInMap"];
      return [mapName, ...findReferences(tail)];
    } else if (isFnIf(expr)) {
      const [condition, ...tail] = expr["Fn::If"];
      return [
        ...(typeof condition === "string"
          ? // is a condition reference
            condition
          : // is another intrinsic - this is a divergence from the cfn spec that functionless/formation supports.
            findConditionReferences(condition)),
        ...findReferences(tail),
      ];
    } else {
      return Object.values(expr).flatMap((e) => findReferences(e));
    }
    // TODO: RuleFunctions
  } else if (!!expr) {
    if (Array.isArray(expr)) {
      return expr.flatMap((e) => findReferences(e));
    } else if (typeof expr === "object") {
      return Object.values(expr).flatMap((e) => findReferences(e));
    }
  }
  return [];
}

/**
 * Find references in conditions until we run out of values or a non-condition
 * intrinsic function is found.
 */
function findConditionReferences(expr: Expression | RuleFunction): string[] {
  if (isIntrinsicFunction(expr)) {
    return findReferences(expr);
  } else if (isRuleFunction(expr)) {
    if (isConditionRef(expr)) {
      return [expr.Condition];
    } else {
      return Object.values(expr).flatMap((e) => findConditionReferences(e));
    }
  } else if (!!expr) {
    if (Array.isArray(expr)) {
      return expr.flatMap((e) => findConditionReferences(e));
    } else if (typeof expr === "object") {
      return Object.values(expr).flatMap((e) => findConditionReferences(e));
    }
  }
  return [];
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
