const register = require("@swc/register/lib/node").default;
const { config } = require("./swc-config");
const path = require("path");

const src = path.resolve("src");
const functionlessLib = path.resolve(__dirname, "lib");

register({
  ...config,
  ignore: [
    (file) => {
      if (
        file.startsWith(src) ||
        file.startsWith(functionlessLib) ||
        file.includes("/fl-exp/lib/")
      ) {
        return false;
      } else {
        return true;
      }
    },
  ],
});
