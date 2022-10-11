import register from "@swc/register/lib/node";
import { config } from "@functionless/swc-config";
import path from "path";

function tryResolve(mod: string) {
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

const prefixes = [awsConstructs, flExp, src].filter(
  (s): s is Exclude<typeof s, undefined> => s !== undefined
);

register({
  ...(config as any),
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
