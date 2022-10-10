const fs = require("fs/promises");
const { constants } = require("fs");
const path = require("path");

const pwd = path.resolve(path.join(__dirname, ".."));

console.log("PWD: ", pwd);

(async function () {
  const paths = (
    await Promise.all([
      ls(path.join(pwd, "apps")),
      ls(path.join(pwd, "packages")),
      ls(path.join(pwd, "packages", "@functionless")),
    ])
  ).flat();

  const allReferences = (
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

  const tsConfigPath = path.join(pwd, "tsconfig.json");
  const tsConfig = JSON.parse(
    (await fs.readFile(tsConfigPath)).toString("utf-8")
  );
  tsConfig.references = allReferences.map((ref) => ({ path: ref }));
  await fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function ls(dir) {
  return (await fs.readdir(dir)).map((d) => path.join(dir, d));
}
