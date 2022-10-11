const fs = require("fs-extra");
const path = require("path");

exports.copyTypeDoc = async function () {
  const workspaceDir = path.resolve(__dirname, "..", "..", "..");
  const docsDir = path.join(workspaceDir, "website", "docs");
  const apiRefDir = path.join(docsDir, "api");
  const flDir = path.join(workspaceDir, "packages", "@functionless");
  const pkgs = await Promise.all(
    (
      await fs.readdir(flDir)
    ).map(async (file) => {
      const pkgRoot = path.join(flDir, file);
      const pkgJson = JSON.parse(
        (await fs.readFile(path.join(pkgRoot, "package.json"))).toString("utf8")
      );
      return {
        name: pkgJson.name,
        shortName: path.basename(pkgRoot),
        pkgRoot,
        pkgJson,
        docRoot: path.join(pkgRoot, "docs"),
      };
    })
  );

  await Promise.all(
    pkgs.map(async (pkg) => {
      if (await fs.pathExists(pkg.docRoot)) {
        const copyTo = path.join(apiRefDir, pkg.shortName);
        await fs.copy(pkg.docRoot, copyTo);
      } else {
        console.log("File not found: ", pkg.docRoot);
      }
    })
  );
};
