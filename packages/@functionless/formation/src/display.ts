import { buildDependencyGraph, topoSortWithLevels } from "./graph";
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

  console.log(
    displayTopoEntries(
      topoResult.map(({ resourceId, level }) => ({ name: resourceId, level })),
      color
    )
  );
}

export interface TopoDisplayEntry {
  name: string;
  level: number;
  additional?: string;
}

export function displayTopoEntries(
  entries: TopoDisplayEntry[],
  color?: boolean
) {
  return entries
    .map(({ name, level, additional }) => {
      const l = `${[...new Array(level)].join("  ")}${name} - ${additional}`;
      if (color) {
        return chalk[COLORS[(level - 1) % COLORS.length]!](l);
      } else {
        return l;
      }
    })
    .join("\n");
}
