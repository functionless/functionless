import fs from "fs/promises";
import path from "path";
import { CloudFormationTemplate } from "../src";
import { buildDependencyGraph, topoSortWithLevels } from "../src/graph";
import { displayTopoOrder } from "../src/display";

describe("topo", () => {
  test("function", async () => {
    const file = await fs.readFile(
      path.join(__dirname, "test-templates", "lambda-test.json")
    );

    const template = JSON.parse(file.toString()) as CloudFormationTemplate;

    const graph = buildDependencyGraph(template);
    console.log(graph);
    console.log(topoSortWithLevels(graph));
    displayTopoOrder(template);
  });

  test("queue", async () => {
    const file = await fs.readFile(
      path.join(__dirname, "test-templates", "queue-test.json")
    );

    const template = JSON.parse(file.toString()) as CloudFormationTemplate;

    const graph = buildDependencyGraph(template);
    console.log(topoSortWithLevels(graph));
  });
});
