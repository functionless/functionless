import {
  EnvVars,
  getFileArn,
  ModuleVisitor,
  ResourceLoader,
} from "../../loader";
import path from "path";
import * as swc from "@swc/core";
import {
  module,
  import_,
  exportDefault,
  call,
  environmentVariable,
} from "../../loader/ast";
import { Table } from "@functionless/aws-dynamodb-constructs";
import { TargetClientData } from "@functionless/aws-util";

const envKeys = ["tableArn", "tableName"] as const;

export const resourceLoader: ResourceLoader<typeof envKeys, Table> = {
  envKeys,
  targets: {
    local: async ({ resourceFile, roleArn }) => ({
      env: async () => {
        const tableArn = await getFileArn(resourceFile);
        return { tableArn, tableName: path.basename(tableArn) };
      },
      transform: (env) =>
        shimTable(
          {
            target: "local",
            roleArn,
          },
          env
        ),
    }),
    synth: async () => ({
      env: async (p) => {
        const { tableArn, tableName } = p.resource;
        return { tableArn, tableName };
      },
      transform: (env) => shimTable({ target: "synth" }, env),
    }),
  },
};

//Replace the module with shim loader, which injects clients and env vars
export function shimTable(
  targetClientData: TargetClientData,
  env: EnvVars<typeof envKeys>
): ModuleVisitor {
  return {
    visitModule: (n: swc.Module) =>
      module(
        import_(["_initTable"], {
          from: "@functionless/aws-dynamodb",
        }),
        ...n.body
      ),

    visitExportDefaultExpression: (n) =>
      exportDefault(
        call("_initTable", [
          n.expression,
          {
            targetClientData,
            tableArn: environmentVariable(env.tableArn),
            tableName: environmentVariable(env.tableName),
          },
        ])
      ),
  };
}
