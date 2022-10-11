import fs from "fs/promises";
import path from "path";
import { CloudFormationTemplate } from "../src";
import {
  buildConditionDependencyGraph,
  buildDependencyGraph,
  topoSortWithLevels,
} from "../src/graph";
import { displayTopoOrder } from "../src/display";

describe("topo", () => {
  test("function", async () => {
    const file = await fs.readFile(
      path.join(__dirname, "test-templates", "lambda-test.json")
    );

    const template = JSON.parse(file.toString()) as CloudFormationTemplate;

    const graph = await buildDependencyGraph(template);
    console.log(graph);
    console.log(topoSortWithLevels(graph));
    displayTopoOrder(template);
  });

  test("queue", async () => {
    const file = await fs.readFile(
      path.join(__dirname, "test-templates", "queue-test.json")
    );

    const template = JSON.parse(file.toString()) as CloudFormationTemplate;

    const graph = await buildDependencyGraph(template);
    console.log(topoSortWithLevels(graph));
  });
});

describe("condition graph", () => {
  test("basic", async () => {
    const g = await buildConditionDependencyGraph({
      Resources: {},
      AWSTemplateFormatVersion: "2010-09-09",
      Parameters: { Env: { Type: "String" } },
      Conditions: {
        a: { "Fn::Or": [{ "Fn::Equals": [{ Ref: "Env" }, "prod"] }] },
      },
    });

    expect(g).toEqual({
      a: [{ parameter: "Env" }],
    });
  });

  test("depends on condition", async () => {
    const g = await buildConditionDependencyGraph({
      Resources: {},
      AWSTemplateFormatVersion: "2010-09-09",
      Parameters: { Env: { Type: "String" } },
      Conditions: {
        a: { "Fn::Or": [{ "Fn::Equals": [{ Ref: "Env" }, "prod"] }] },
        b: { "Fn::Or": [{ Condition: "a" }] },
      },
    });

    expect(g).toEqual({
      a: [{ parameter: "Env" }],
      b: [{ condition: "a" }],
    });
  });

  test("and mapping", async () => {
    const g = await buildConditionDependencyGraph({
      Resources: {},
      AWSTemplateFormatVersion: "2010-09-09",
      Parameters: { Env: { Type: "String" } },
      Mappings: {
        z: {
          a: { b: "c" },
        },
      },
      Conditions: {
        a: { "Fn::And": [{ "Fn::Equals": [{ Ref: "Env" }, "prod"] }] },
        b: {
          "Fn::And": [{ Condition: "a" }, { "Fn::FindInMap": ["z", "a", "c"] }],
        },
      },
    });

    expect(g).toEqual({
      a: [{ parameter: "Env" }],
      b: [{ condition: "a" }, { mapping: "z" }],
    });
  });
});
