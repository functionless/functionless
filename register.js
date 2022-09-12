const register = require("@swc/register/lib/node").default;
const { config } = require("./lib/swc");

register(config);
