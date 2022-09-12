const register = require("@swc/register/lib/node").default;
const { config } = require("./lib/swc");
const path = require("path");

const src = path.resolve("src");
const functionlessLib = path.resolve(__dirname, "lib");
register({
  ...config,
  ignore: [
    (file) => {
      if (file.startsWith(src) || file.startsWith(functionlessLib)) {
        return false;
      } else {
        return true;
      }
    },
  ],
});
