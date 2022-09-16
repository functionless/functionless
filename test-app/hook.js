const register = require("@swc/register/lib/node").default;
const path = require("path");

const src = path.join(__dirname, "src");
const functionlessLib = path.dirname(require.resolve("functionless"));
register({
  sourceMaps: true,
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
