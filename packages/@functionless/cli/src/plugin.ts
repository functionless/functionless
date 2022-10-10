import esbuild from "esbuild";
import * as babel from "@babel/core";
import fs from "fs/promises";
import path from "path";
import { Project } from "./project";
import { isResource } from "@functionless/aws";

const babel_ts = require("@babel/plugin-transform-typescript");

export function resourceIdPlugin(
  project: Project,
  roleArn?: string
): esbuild.Plugin {
  return {
    name: "Functionless Resource IDs",
    setup(build) {
      build.onLoad({ filter: /\.ts/g }, async (args) => {
        const resourceModule = require(args.path);

        if (isResource(resourceModule.default)) {
          const resource = project.lookupResource(resourceModule.default);
          const resourceID = resource.address;

          let text = await fs.readFile(args.path, "utf8");
          const transformed = await babel.transformAsync(text, {
            sourceType: "module",
            sourceMaps: "inline",
            sourceFileName: path.basename(args.path),
            plugins: [
              babel_ts.default,
              () => ({
                visitor: createVisitor(resourceID),
              }),
            ],
          });

          return {
            contents: transformed?.code!,
            loader: "ts",
          };
        }
        return undefined;
      });
    },
  };

  function createVisitor(resourceID: string) {
    return <babel.Visitor>{
      CallExpression: (call) => {
        if (babel.types.isIdentifier(call.node.callee)) {
          if (
            call.node.callee.name === "LambdaFunction" ||
            call.node.callee.name === "StepFunction" ||
            call.node.callee.name === "ExpressStepFunction"
          ) {
            if (call.node.arguments.length === 1) {
              call.node.arguments.push(
                babel.types.identifier("undefined"),
                babel.types.stringLiteral(resourceID)
              );
            } else if (call.node.arguments.length === 2) {
              call.node.arguments.push(
                babel.types.stringLiteral(resourceID),
                babel.types.stringLiteral(roleArn ?? "NONE")
              );
            } else {
              call.node.arguments = [
                call.node.arguments[0]!,
                call.node.arguments[1]!,
                babel.types.stringLiteral(resourceID),
                babel.types.stringLiteral(roleArn ?? "NONE"),
              ];
            }
          } else if (call.node.callee.name === "Table") {
            if (call.node.arguments.length === 1) {
              call.node.arguments.push(
                babel.types.stringLiteral(resourceID),
                babel.types.stringLiteral(roleArn ?? "NONE")
              );
            } else if (call.node.arguments.length === 2) {
              call.node.arguments.push(
                babel.types.stringLiteral(resourceID),
                babel.types.stringLiteral(roleArn ?? "NONE")
              );
            } else {
              call.node.arguments = [
                call.node.arguments[0]!,
                babel.types.stringLiteral(resourceID),
                babel.types.stringLiteral(roleArn ?? "NONE"),
              ];
            }
          }
        }
      },
    };
  }
}
