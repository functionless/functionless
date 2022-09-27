const register = require("@swc/register/lib/node").default;
const { config } = require("./swc-config");
const path = require("path");

const src = path.resolve("src");
const functionlessLib = path.resolve(__dirname, "lib");
const flExpPathPart = path.join("fl-exp", "lib");

register({
  ...config,
  ignore: [
    (file) => {
      if (
        file.startsWith(src) ||
        file.startsWith(functionlessLib) ||
        file.includes(flExpPathPart)
      ) {
        return false;
      } else {
        return true;
      }
    },
  ],
});
