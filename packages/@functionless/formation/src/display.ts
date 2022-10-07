import { buildDependencyGraph, topoSortWithLevels } from "./graph";
import { CloudFormationTemplate } from "./template";
import chalk, { Color } from "chalk";

export function displayTopoOrder(
  template: CloudFormationTemplate,
  color?: boolean
) {
  const colors: typeof Color[] = [
    "red",
    "yellow",
    "green",
    "cyan",
    "blue",
    "magenta",
  ];

  const graph = buildDependencyGraph(template);
  const topoResult = topoSortWithLevels(graph, true);

  const output = topoResult
    .map(({ resourceId, level }) => {
      const l = `${[...new Array(level)].join("  ")}${resourceId}`;
      if (color) {
        return chalk[colors[(level - 1) % colors.length]!](l);
      } else {
        return l;
      }
    })
    .join("\n");

  console.log(output);
}
