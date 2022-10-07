import { Set as ImmutableSet } from "immutable";
import { Expression } from "./expression";
import {
  isIntrinsicFunction,
  isRef,
  isFnGetAtt,
  isFnJoin,
  isFnSelect,
  isFnSplit,
  isFnSub,
  isFnBase64,
} from "./function";
import { isPseudoParameter } from "./pseudo-parameter";
// @ts-ignore - for tsdoc
import type { Stack } from "./stack";
import { CloudFormationTemplate } from "./template";

/**
 * Maps a Logical ID to the Logical IDs it depends on.
 */
export interface DependencyGraph {
  [logicalId: string]: string[];
}

/**
 * Builds the {@link DependencyGraph} for the {@link template}.
 *
 * @param template a {@link CloudFormationTemplate}
 * @returns the {@link DependencyGraph} for the {@link CloudFormationTemplate}.
 * @throws an Error if the stack is invalid, for example when there are any circular references in the template
 */
export function buildDependencyGraph(
  template: CloudFormationTemplate
): DependencyGraph {
  const graph: DependencyGraph = {};
  for (const [logicalId, resource] of Object.entries(template.Resources)) {
    graph[logicalId] = [
      ...(resource.Properties
        ? Array.from(new Set(findReferences(resource.Properties)))
        : []),
      ...(resource.DependsOn ?? []),
    ]
      // do not maintain parameters as dependencies, for now.
      .filter((x) => !(x in (template.Parameters ?? {})));
  }

  const circularReferences = findCircularReferences(graph);
  if (circularReferences.length > 0) {
    throw new Error(
      `circular references detected: ${circularReferences.join(",")}`
    );
  }

  return graph;
}

/**
 * Maps logical ids to the logical ids that depend on it.
 */
export function createDependentGraph(graph: DependencyGraph): DependencyGraph {
  const iGraph: Record<string, Set<string>> = {};
  Object.entries(graph).forEach(([dependent, dependencies]) => {
    if (!(dependent in iGraph)) {
      iGraph[dependent] = new Set();
    }
    dependencies.forEach((dependency) => {
      if (!(dependency in iGraph)) {
        iGraph[dependency] = new Set();
      }
      iGraph[dependency]!.add(dependent);
    });
  });
  return Object.fromEntries(
    Object.entries(iGraph).map(([key, values]) => [key, [...values]])
  );
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
  graph: DependencyGraph,
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
      const depths = graph[node]!.map(visit);
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

const emptySet = ImmutableSet<string>([]);

function findCircularReferences(graph: DependencyGraph): string[] {
  const circularReferences: string[] = [];
  for (const [logicalId, references] of Object.entries(graph)) {
    for (const reference of references) {
      const isCircular = transitReference(reference);
      if (isCircular) {
        circularReferences.push(logicalId);
        break;
      }
    }

    function transitReference(
      reference: string,
      seen: ImmutableSet<string> = emptySet
    ): boolean | undefined {
      if (reference === logicalId) {
        return true;
      } else if (seen.has(reference)) {
        // we're walking in circles, there is a circular reference somewhere
        // but this logicalId is not the culprit - one of its transitive dependencies is
        return undefined;
      } else {
        const transitiveReferences = graph[reference];
        if (transitiveReferences === undefined) {
          throw new Error(`reference does not exist: '${reference}'`);
        }
        seen = seen.add(reference);
        for (const transitiveReference of transitiveReferences) {
          const isCircular = transitReference(transitiveReference, seen);
          if (isCircular) {
            return true;
          }
        }
        return false;
      }
    }
  }
  return circularReferences;
}

function findReferences(expr: Expression): string[] {
  if (isIntrinsicFunction(expr)) {
    if (isRef(expr)) {
      if (isPseudoParameter(expr.Ref)) {
        return [];
      }
      return [expr.Ref];
    } else if (isFnGetAtt(expr)) {
      return [expr["Fn::GetAtt"][0]];
    } else if (isFnJoin(expr)) {
      return findReferences(expr["Fn::Join"]);
    } else if (isFnSelect(expr)) {
      return findReferences(expr["Fn::Select"]);
    } else if (isFnSplit(expr)) {
      return findReferences(expr["Fn::Split"]);
    } else if (isFnSub(expr)) {
      return findReferences(expr["Fn::Sub"]);
    } else if (isFnBase64(expr)) {
      return findReferences(expr["Fn::Base64"]);
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
