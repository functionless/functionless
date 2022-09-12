const swcJest = require("@swc/jest");
const { config } = require("./lib/swc");

function createTransformer() {
  return swcJest.createTransformer(config);
}

module.exports = { createTransformer };
