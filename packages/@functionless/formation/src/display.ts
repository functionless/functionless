import { buildDependencyGraph, topoSortWithLevels } from "./graph";
import { CloudFormationTemplate } from "./template";
import chalk, { Color } from "chalk";
import Table from "cli-table";

const COLORS: typeof Color[] = [
  "red",
  "yellow",
  "green",
  "cyan",
  "blue",
  "magenta",
];

export async function displayTopoOrder(
  template: CloudFormationTemplate,
  color?: boolean
) {
  const graph = await buildDependencyGraph(template);
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
  noColor?: boolean;
  additional?: string[];
}

export function displayTopoEntries(
  entries: TopoDisplayEntry[],
  color?: boolean,
  additionalHeaders?: string[]
) {
  return new Table({
    head: ["Resource", ...(additionalHeaders ?? [])],
    chars: { mid: "", "left-mid": "", "mid-mid": "", "right-mid": "" },
    rows: entries.map(({ name, level, additional, noColor }) => {
      const l = `${[...new Array(level)].join("  ")}${name}`;
      if (!noColor && color) {
        return [
          chalk[COLORS[(level - 1) % COLORS.length]!](l),
          ...(additional ?? []),
        ];
      } else {
        return [l, ...(additional ?? [])];
      }
    }),
  }).toString();
}
