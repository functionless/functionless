import path from "path";
import { ls, readJsonFile, writeJsonFile } from "./util.mjs";

/**
 * Adds all `@functionless/*` dependencies to the `website` and `functionless` aggregate packages.
 *
 * Adds all `@tests/aws-*-constructs` to the `@tests/cleanup` package's dev dependencies
 */

const rootDir = process.cwd();

const packagesPath = path.resolve(rootDir, "packages", "@functionless");
const testsPath = path.resolve(rootDir, "packages", "@tests");
const flsPkgJsonPath = path.resolve(
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

const cleanupPkgJsonPath = path.resolve(
  rootDir,
  "packages",
  "@tests",
  "cleanup",
  "package.json"
);

const [
  flsPkgJson,
  websitePkgJson,
  cleanupPkgJson,
  publicPackages,
  testPackages,
] = await Promise.all([
  readJsonFile(flsPkgJsonPath),
  readJsonFile(websitePkgJsonPath),
  readJsonFile(cleanupPkgJsonPath),
  getPackages(packagesPath),
  getPackages(testsPath, (p) => path.basename(p) !== "cleanup"),
]);

await Promise.all([
  patch(flsPkgJsonPath, flsPkgJson, publicPackages, "dependencies"),
  patch(websitePkgJsonPath, websitePkgJson, publicPackages, "dependencies"),
  patch(cleanupPkgJsonPath, cleanupPkgJson, testPackages, "devDependencies"),
]);

async function getPackages(folder, filter) {
  let pkgs = await ls(folder);
  if (filter) {
    pkgs = pkgs.filter(filter);
  }

  return Promise.all(
    pkgs.map((pkg) => readJsonFile(path.join(pkg, "package.json")))
  );
}

async function patch(pkgJsonPath, pkgJson, packages, dependenciesKey) {
  pkgJson[dependenciesKey] = {
    ...(pkgJson[dependenciesKey] ?? {}),
    ...Object.fromEntries(
      packages
        .filter((pkg) => pkg.private !== true)
        .sort((pkgA, pkgB) => pkgA.name < pkgB.name)
        .map((pkg) => {
          return [pkg.name, pkgJson[dependenciesKey][pkg.name] ?? "*"];
        })
    ),
  };

  await writeJsonFile(pkgJsonPath, pkgJson);
}
