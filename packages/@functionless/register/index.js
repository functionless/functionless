const register = require("@swc/register/lib/node").default;
const { config } = require("@functionless/swc-config");
const path = require("path");

const awsConstructs = path.dirname(
  require.resolve("@functionless/aws-constructs")
);
const flExp = path.dirname(require.resolve("@functionless/fl-exp"));
const src = path.resolve("src");

const prefixes = [awsConstructs, flExp, src];

register({
  ...config,
  ignore: [
    (file) => {
      // console.log(file);
      if (prefixes.find((p) => file.startsWith(p)) !== undefined) {
        return false;
      } else {
        return true;
      }
    },
  ],
});
