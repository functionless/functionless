import { LoaderContext, LoaderFilter, Target, TargetParams } from "./loader";
import { File } from "../../tree/file";
import { matchAtLeastOne } from "../../util";
import type { SynthesizedResource } from "../../synthesize";
import { getFunctionRoleArn } from "./arn";

export const envNameForKey = (resourceFile: File, k: string) =>
  `${resourceFile.address}_${k}`.replaceAll(/[^A-Za-z_0-9]/g, "_");

/**
 * Given a map of keys to env var values,
 * rename the keys based on file hosting the resource
 * based on the file that is hosting the resource
 * @param resourceFile
 * @param env
 * @returns
 */
export function namifyEnvMap(
  resourceFile: File,
  env: Record<string, string>
): Record<string, string> {
  const entries = Object.entries<string>(env).map(([k, v]) => [
    envNameForKey(resourceFile, k),
    v,
  ]);
  return Object.fromEntries(entries);
}

/**
 * Generate a map of keys to environment variable names,
 * based on the file that is hosting the resource
 * @param resourceFile
 * @param keys
 * @returns
 */
export function envNames<K extends string>(
  resourceFile: File,
  keys: readonly K[]
): Record<K, string> {
  const entries = keys.map(
    (k) => [k as K, envNameForKey(resourceFile, k)] as const
  );
  return Object.fromEntries(entries) as Record<K, string>;
}

/**
 * Match a filter condition (single or array or values) to a value.
 * If condition is undefined, returns true
 * If filter is a single, checks that it === value
 * If filter is array,
 * @param t
 * @param val
 * @returns
 */

/**
 * Determine if a context matches the given filter
 * @param param0 Context to match
 * @param param1 Filter to compare with context
 * @returns
 */
export function loaderContextMatches(
  { entryFile, resourceFile }: LoaderContext<any, any>,
  { level }: LoaderFilter
): boolean {
  return matchAtLeastOne(
    level,
    entryFile.address === resourceFile.address ? "root" : "import"
  );
}

export async function getContextParams<
  T extends Target,
  R extends SynthesizedResource
>({
  target,
  entryFile,
}: {
  target: Target;
  entryFile: File;
}): Promise<TargetParams<R>[T]["context"]> {
  return target === "local"
    ? {
        roleArn: await getFunctionRoleArn(entryFile),
      }
    : {};
}
