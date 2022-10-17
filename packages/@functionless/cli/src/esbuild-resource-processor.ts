import esbuild from "esbuild";
import { File } from "./tree/file";
import * as swc from "@swc/core";
import { resourcePlugins } from "./resource-plugins/plugins";
import { readFile } from "fs/promises";
import path from "path";
import {
  EnvVars,
  LoaderContext,
  MaterializeEnv,
  Target,
} from "./resource-plugins/loader/loader";
import {
  envNames,
  loaderContextMatches,
  namifyEnvMap,
} from "./resource-plugins/loader/lib";
import {
  getContextParams,
  transformModuleWithVisitor,
} from "./resource-plugins/loader";
import deepmerge from "deepmerge";
import { matchAtLeastOne } from "./util";
import { ResourcePlugin } from "./resource-plugins/plugin";

/**
 * An esbuild plugin to process bundled resources, and invoke
 * plugins which may rewrite the resources inline
 * @param entryFile The entrypoint of the bundle
 * @param resourceMeta Map of file addresses to a map of resources to metadata
 * @param env will be populated with environment variables from the build will be empty before then
 */

export function esbuildResourceProcessor(
  entryFile: File,
  target: Target
): { plugin: esbuild.Plugin; env: EntryEnvMap } {
  let outputEnv: EntryEnvMap = {};
  return {
    plugin: {
      name: "Functionless Resource Transformer",
      setup(build) {
        build.onLoad({ filter: /\.ts/g }, async (args) => {
          let resourceFile: File;
          try {
            resourceFile = entryFile.project.lookupResource(args.path);
          } catch (e) {
            //File is not a leaf resource, we just spit it back to esbuild
            return {
              contents: await readFile(args.path, { encoding: "utf-8" }),
              loader: "ts",
            };
          }
          const sourceModule = await swc.parseFile(args.path, {
            syntax: "typescript",
          });
          const loaderContext = {
            entryFile,
            resourceFile,
            ...(await getContextParams({ target, entryFile })),
          };

          //Reduce over loader plugins to achieve transformed module and accumulated environment variables
          const { module, envMap } = await applyLoaderPlugins(
            target,
            loaderContext,
            sourceModule
          );

          const { code } = await printModule(module, args.path);

          //Merge up our output env with env from this file
          Object.assign(outputEnv, deepmerge(outputEnv, envMap));

          return {
            contents: code,
            loader: "ts",
          };
        });
      },
    },
    env: outputEnv,
  };
}

async function applyLoaderPlugins(
  target: Target,
  loaderContext: LoaderContext<any, any>,
  sourceModule: swc.Module
) {
  return resourcePlugins.reduce<
    Promise<{ module: swc.Module; envMap: EntryEnvMap }>
  >(
    async (l, plugin: ResourcePlugin) => {
      if (!loaderFilterAccepted(plugin, loaderContext)) {
        return l;
      }
      const { module, envMap } = await l;
      const { env, transform } = await plugin.resourceLoader.targets[target](
        loaderContext
      );
      const envNameMap: EnvVars<any> = envNames(
        loaderContext.resourceFile,
        plugin.resourceLoader.envKeys
      );
      const transformedModule = transform
        ? transformModuleWithVisitor(module, transform(envNameMap))
        : module;
      const transformedEnvMap = env
        ? addToEnvMap(envMap, env, loaderContext)
        : envMap;

      return { module: transformedModule, envMap: transformedEnvMap };
    },
    Promise.resolve({
      module: sourceModule,
      envMap: {} as EntryEnvMap,
    })
  );
}

/**
 * Run swc on our module to get code
 * @param module
 * @param filePath
 * @returns
 */
async function printModule(module: swc.Module, filePath: string) {
  return await swc.print(module, {
    //sourceFileName doesnt set up the sourcemap path the same way as transform does...
    sourceFileName: path.basename(filePath),
    //Instead these two are needed
    filename: path.basename(filePath),
    outputPath: path.dirname(filePath),
    //esbuild will extract these out later
    sourceMaps: "inline",
    jsc: {
      target: "es2022",
    },
  });
}

function loaderFilterAccepted(
  plugin: ResourcePlugin,
  loaderContext: LoaderContext<any, any>
) {
  return (
    matchAtLeastOne(plugin.kind, loaderContext.resourceFile.resource.kind) ||
    (plugin.resourceLoader.filter &&
      !loaderContextMatches(loaderContext, plugin.resourceLoader.filter))
  );
}

/**
 * Use swc to parse a typescript file based on a set of paths, using path.resolve
 * @param paths
 * @returns
 */
export function parseFile(...paths: string[]): Promise<swc.Module> {
  return swc.parseFile(path.resolve(...paths), { syntax: "typescript" });
}

//Map from entry file ->resource file ->  -> env materializer
export type EntryEnvMap = Record<string, ResourceEnvMap>;
export type ResourceEnvMap = Record<string, MaterializeEnv<any, any, any>>;

export const resourceEnvKey = (entryFile: File, resourceFile: File) =>
  `${entryFile.address}:${resourceFile.address}`;

/**
 * Merge an env materializer into envmap
 * @param envMap
 * @param env
 * @param param2
 * @returns
 */
function addToEnvMap(
  envMap: EntryEnvMap,
  env: MaterializeEnv<any, any, any>,
  { entryFile, resourceFile }: LoaderContext<any, any>
): EntryEnvMap {
  const namifiedEnv = async (params: any) =>
    namifyEnvMap(resourceFile, await env(params));
  return deepmerge(envMap, {
    [entryFile.address]: { [resourceFile.address]: namifiedEnv },
  });
}
