import path from "path";
import { ls, readJsonFile, writeJsonFile } from "./util.mjs";

const rootDir = process.cwd();

const packagesPath = path.resolve(rootDir, "packages", "@functionless");
const functionlessPkgJsonPath = path.resolve(
  rootDir,
  "packages",
  "functionless",
  "package.json"
);

const [functionlessPkgJson, allPackages] = await Promise.all([
  readJsonFile(functionlessPkgJsonPath),
  (async () => {
    const pkgs = await ls(packagesPath);

    return Promise.all(
      pkgs.map((pkg) => readJsonFile(path.join(pkg, "package.json")))
    );
  })(),
]);

functionlessPkgJson.dependencies = {
  ...(functionlessPkgJson.dependencies ?? {}),
  ...Object.fromEntries(
    allPackages
      .sort()
      .map((pkg) => [
        pkg.name,
        functionlessPkgJson.dependencies[pkg.name] ?? `^${pkg.version}` ?? "*",
      ])
  ),
};

await writeJsonFile(functionlessPkgJsonPath, functionlessPkgJson);
