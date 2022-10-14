const fs = require("fs-extra");
const path = require("path");

exports.copyTypeDoc = async function () {
  const workspaceDir = path.resolve(__dirname, "..", "..", "..");
  const docsDir = path.join(workspaceDir, "apps", "website", "docs");
  const apiRefDir = path.join(docsDir, "api");
  const flDir = path.join(workspaceDir, "packages", "@functionless");

  // load packages/@functionless/*/package.json
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
        docRoot: path.join(pkgRoot, "docs", "api"),
      };
    })
  );

  await Promise.all(
    pkgs.map(async (pkg) => {
      // if the package contains a docs/ folder
      if (await fs.pathExists(pkg.docRoot)) {
        const copyTo = path.join(apiRefDir, pkg.shortName);
        // then copy it to the website's doc folder
        await fs.copy(pkg.docRoot, copyTo, {
          recursive: true,
        });
      } else {
        // log a warning for packages that do not have a docs/ folder
        console.log("File not found: ", pkg.docRoot);
      }
    })
  );

  // give the API Reference folder a nice label in docusaurus
  await fs.writeFile(
    path.join(apiRefDir, "_category_.yml"),
    `label: "API Reference"`
  );
};

exports.copyTypeDoc().catch((err) => {
  console.error(err);
  process.exit(1);
});
