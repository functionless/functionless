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
  await patchTopLevelTsConfig();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function patchTopLevelTsConfig(roots) {
  const tsConfigPath = path.join(pwd, "tsconfig.json");
  const tsConfig = JSON.parse(
    (await fs.readFile(tsConfigPath)).toString("utf-8")
  );
  tsConfig.references = (roots ?? (await findAllPackageRoots())).map((ref) => ({
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

async function ls(dir) {
  return (await fs.readdir(dir)).map((d) => path.join(dir, d));
}
