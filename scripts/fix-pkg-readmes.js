const path = require("path");
const fs = require("fs/promises");
const { constants } = require("fs");

const pkgsPath = path.resolve(__dirname, "..", "packages", "@functionless");

/**
 * Generates a clean README for every package that contains documentation.
 *
 * If the README already exists, this script leaves the file unchanged.
 *
 * __JUSTIFICATION__: If a package doesn't have a README, typedoc uses the README at the root of the
 * workspace which includes images that don't compile and also pollutes documentation with
 * redundant content.
 *
 * Each package will eventually have high level documentation included in its README.
 * 1. this README will be available in VS code for consumers to readily access
 * 2. it will be rendered into the website
 */
(async function main() {
  await Promise.all(
    (
      await fs.readdir(pkgsPath)
    ).map(async (pkgName) => {
      const pkgPath = path.join(pkgsPath, pkgName);
      const README = path.join(pkgPath, "README.md");
      try {
        await fs.access(README, constants.F_OK);
      } catch {
        // doesn't exist, so create it
        await fs.writeFile(README, `# @functionless/${pkgName}\n`);
      }
    })
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
