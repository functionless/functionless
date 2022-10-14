const swcJest = require("@swc/jest");
import { config } from "@functionless/swc-config";

function createTransformer() {
  return swcJest.createTransformer(config);
}

module.exports = { createTransformer };
