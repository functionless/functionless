import { buildDependencyGraph, TopoEntry, topoSortWithLevels } from "./graph";
import { CloudFormationTemplate } from "./template";
import chalk, { Color } from "chalk";

const COLORS: typeof Color[] = [
  "red",
  "yellow",
  "green",
  "cyan",
  "blue",
  "magenta",
];

export function displayTopoOrder(
  template: CloudFormationTemplate,
  color?: boolean
) {
  const graph = buildDependencyGraph(template);
  const topoResult = topoSortWithLevels(graph, true);

  console.log(displayTopoEntries(topoResult, color));
}

export function displayTopoEntries(entries: TopoEntry[], color?: boolean) {
  return entries
    .map(({ resourceId, level }) => {
      const l = `${[...new Array(level)].join("  ")}${resourceId}`;
      if (color) {
        return chalk[COLORS[(level - 1) % COLORS.length]!](l);
      } else {
        return l;
      }
    })
    .join("\n");
}
