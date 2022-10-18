import { SynthesizedResource } from "../../synthesize";
import { AtLeastOne } from "../../util";
import { File } from "../../tree/file";
import { ModuleVisitor } from "./visitor";

export type MaterializeEnv<
  T extends Target,
  K extends KeyTuple,
  R extends SynthesizedResource
> = (params: TargetParams<R>[T]["env"]) => Promise<EnvVars<K>>;

//Alias for the type of ['a', 'b'] as const
export type KeyTuple = Record<number, string>;
// ['a', 'b'] => 'a' | 'b'
export type KeysIn<K extends KeyTuple> = K[number];
// ['a', 'b'] => Record<'a' | 'b', string>
export type EnvVars<K extends KeyTuple> = Record<KeysIn<K>, string>;

export interface TargetParams<R extends SynthesizedResource> {
  local: { context: { roleArn: string }; env: {} };
  synth: { context: {}; env: { resource: R } };
}

export type Target = keyof TargetParams<any>;

/**
 * A resource loader specification
 * Defined when the lambda loader should run, and what env keys it will export
 */
export interface ResourceLoader<
  K extends KeyTuple,
  R extends SynthesizedResource
> {
  filter?: LoaderFilter;
  envKeys: K;
  targets: { [T in Target]: ResourceLambdaLoader<T, K, R> };
}

/**
 * Prepares a resource loaded by a lambda
 * Can transform its module ast, and add environment variables to the created function
 */
export type ResourceLambdaLoader<
  T extends Target,
  K extends KeyTuple,
  R extends SynthesizedResource
> = (
  context: LoaderContext<T, R>
) => Promise<ResourceLambdaLoaderBody<T, K, R>>;

export interface ResourceLambdaLoaderBody<
  T extends Target,
  K extends KeyTuple,
  R extends SynthesizedResource
> {
  env?: MaterializeEnv<T, K, R>;
  transform?: (env: EnvVars<K>) => ModuleVisitor;
}

export type ResourceLevel = "root" | "import";
export interface LoaderFilter {
  level?: AtLeastOne<ResourceLevel>;
}

export type LoaderContext<T extends Target, R extends SynthesizedResource> = {
  entryFile: File;
  resourceFile: File;
} & TargetParams<R>[T]["context"];

export type TaggedEnvironmentVariable = { name: string; value: string };
export type TaggedEnvironment<K extends string> = {
  [k in K]: TaggedEnvironmentVariable;
};
