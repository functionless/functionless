import path from "path";
import fs from "fs/promises";

const pluginDocusaurus = require("docusaurus-plugin-typedoc").default;

const rootDir = process.cwd();

async function main() {
  const pkgJson = JSON.parse(
    (await fs.readFile(path.join(rootDir, "package.json"))).toString("utf-8")
  );

  const plugin = pluginDocusaurus(
    {
      siteDir: rootDir,
    },
    {
      id: "load-content",
      entryPointStrategy: "packages",
      entryPoints: [rootDir],
      sidebar: {
        fullNames: true,
        categoryLabel: pkgJson.name,
      },
      logLevel: "Error",
      readme: "./README.md",
    }
  );

  await plugin.loadContent();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
