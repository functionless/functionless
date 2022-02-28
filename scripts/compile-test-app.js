const path = require("path");
const { tsc } = require("../lib/tsc");

(async function () {
  await tsc(path.join(__dirname, "..", "test-app"));
})().catch((err) => process.exit(1));
