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
const websitePkgJsonPath = path.resolve(
  rootDir,
  "apps",
  "website",
  "package.json"
);

const [functionlessPkgJson, websitePkgJson, allPackages] = await Promise.all([
  readJsonFile(functionlessPkgJsonPath),
  readJsonFile(websitePkgJsonPath),
  (async () => {
    const pkgs = await ls(packagesPath);

    return Promise.all(
      pkgs.map((pkg) => readJsonFile(path.join(pkg, "package.json")))
    );
  })(),
]);

async function patch(pkgJsonPath, pkgJson) {
  pkgJson.dependencies = {
    ...(pkgJson.dependencies ?? {}),
    ...Object.fromEntries(
      allPackages
        .sort()
        .map((pkg) => [
          pkg.name,
          pkgJson.dependencies[pkg.name] ?? `^${pkg.version}` ?? "*",
        ])
    ),
  };

  await writeJsonFile(pkgJsonPath, pkgJson);
}

await Promise.all([
  patch(functionlessPkgJsonPath, functionlessPkgJson),
  patch(websitePkgJsonPath, websitePkgJson),
]);
