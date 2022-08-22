const register = require("@swc/register/lib/node").default;
const path = require("path");

const src = path.join(__dirname, "src");
const functionlessLib = path.resolve(__dirname, "..", "lib");
register({
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
