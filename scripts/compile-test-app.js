const path = require("path");
const { tsc } = require("../lib/tsc");

(async function () {
  await tsc(path.resolve(__dirname, "..", "test-app"));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
