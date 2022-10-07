const register = require("@swc/register/lib/node").default;
const { config } = require("@functionless/swc-config");
const path = require("path");

function tryResolve(mod) {
  try {
    const index = require.resolve(mod);
    return path.dirname(index);
  } catch {
    return undefined;
  }
}

const awsConstructs = tryResolve("@functionless/aws-constructs");
const flExp = tryResolve("@functionless/fl-exp");
const src = path.resolve("src");

const prefixes = [awsConstructs, flExp, src].filter((s) => s !== undefined);

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
