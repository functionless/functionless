import fs from "fs/promises";
import { constants } from "fs";
import path from "path";
import { ls, readJsonFile, writeJsonFile } from "./util.mjs";

const pwd = process.cwd();

/**
 * This script patches the references in tsconfig.json
 *
 * 1. add all packages to the top-level tsconfig.json's references
 * 2. propagate any dep, devDep or peerDep on an internal package to the relevant tsconfig.json references
 */
const roots = await findAllPackageRoots();
await patchTopLevelTsConfig(roots);
await patchNestedTsConfig(roots);

async function patchTopLevelTsConfig(roots) {
  await patchTsConfig(path.join(pwd, "tsconfig.json"), roots);
}

async function patchTsConfig(tsConfigPath, references) {
  const tsConfig = await readJsonFile(tsConfigPath);
  // TODO: get this check to work properly
  // if (shouldPatchTsConfig(tsConfig, references)) {
  // }
  if (references.length > 0) {
    tsConfig.references = references.sort().map((ref) => ({
      path: ref,
    }));
  } else {
    delete tsConfig.references;
  }
  await writeJsonFile(tsConfigPath, tsConfig);
}

function shouldPatchTsConfig(tsConfig, newReferences) {
  if (newReferences.length === 0) {
    return "references" in tsConfig;
  } else {
    const oldReferences = tsConfig.references?.map((ref) => ref.path) ?? [];

    const newReferencesSet = new Set(newReferences);
    const oldReferencesSet = new Set(oldReferences);

    newReferences.forEach((ref) => oldReferencesSet.delete(ref));
    oldReferences.forEach((ref) => newReferencesSet.delete(ref));
    return newReferencesSet.length > 0 || oldReferencesSet.length > 0;
  }
}

async function findAllPackageRoots() {
  const paths = (
    await Promise.all([
      ls(path.join(pwd, "apps")),
      ls(path.join(pwd, "packages")),
      ls(path.join(pwd, "packages", "@functionless")),
      ls(path.join(pwd, "packages", "@tests")),
    ])
  ).flat();

  return (
    await Promise.all(
      paths.map(async (p) => {
        try {
          await fs.access(path.join(p, "tsconfig.json"), constants.F_OK);
          return path.relative(pwd, p);
        } catch (err) {}
      })
    )
  )
    .filter((p) => !!p)
    .sort();
}

async function patchNestedTsConfig(roots) {
  await Promise.all(
    roots.map(async (rootDir) => {
      const pkgJsonPath = path.join(rootDir, "package.json");
      const pkgJson = await readJsonFile(pkgJsonPath);

      const dependencies = new Set(
        [
          ...Object.keys(pkgJson.dependencies ?? {}),
          ...Object.keys(pkgJson.devDependencies ?? {}),
          ...Object.keys(pkgJson.peerDependencies ?? {}),
        ]
          .filter(
            (dep) =>
              (dep.startsWith("@functionless") ||
                dep.startsWith("functionless")) &&
              ![
                "@functionless/ast-reflection",
                "@functionless/language-service",
                "@functionless/nodejs-closure-serializer",
              ].includes(dep)
          )
          .map((pkgName) =>
            path.relative(rootDir, path.resolve(pwd, "packages", pkgName))
          )
      );

      await patchTsConfig(
        path.join(rootDir, "tsconfig.json"),
        Array.from(dependencies)
      );
    })
  );
}
