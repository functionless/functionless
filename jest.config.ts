// ensure the SWC require-hook is installed before anything else runs
import "@swc/register";

import fs from "fs";
import path from "path";
import type { Config } from "@jest/types";

// Or async function
export default async (): Promise<Config.InitialOptions> => {
  // load the projen-generated jest configuration from ./jest.config.defaults.json
  const defaults = JSON.parse(
    (
      await fs.promises.readFile(
        path.join(__dirname, "jest.config.defaults.json")
      )
    ).toString("utf8")
  );
  return {
    // override defaults programmatically if needed
    ...defaults,
  };
};
