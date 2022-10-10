const fs = require("fs/promises");
const { constants } = require("fs");
const path = require("path");

const pwd = path.resolve(path.join(__dirname, ".."));

/**
 * This script patches the references in tsconfig.json
 *
 * 1. add all packages to the top-level tsconfig.json's references
 * 2. (TODO): propagate any dep, devDep or peerDep on an internal package to the relevant tsconfig.json
 */
(async function () {
  const roots = await findAllPackageRoots();
  await patchTopLevelTsConfig(roots);
  await patchNestedTsConfig(roots);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function patchTopLevelTsConfig(roots) {
  await patchTsConfig(path.join(pwd, "tsconfig.json"), roots);
}

async function patchTsConfig(tsConfigPath, references) {
  const tsConfig = await readJsonFile(tsConfigPath);
  tsConfig.references = references.map((ref) => ({
    path: ref,
  }));
  await fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2));
}

async function findAllPackageRoots() {
  const paths = (
    await Promise.all([
      ls(path.join(pwd, "apps")),
      ls(path.join(pwd, "packages")),
      ls(path.join(pwd, "packages", "@functionless")),
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
              dep.startsWith("@functionless") &&
              ![
                "@functionless/ast-reflection",
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

async function readJsonFile(file) {
  return JSON.parse((await fs.readFile(file)).toString("utf-8"));
}

async function ls(dir) {
  return (await fs.readdir(dir)).map((d) => path.join(dir, d));
}
