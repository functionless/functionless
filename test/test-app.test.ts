import "jest";
import path from "path";
import { App } from "aws-cdk-lib";

jest.setTimeout(60000);

import { tsc } from "../src/tsc";

describe("workflow", () => {
  test("should compile test-app", async () => {
    await tsc(path.join(__dirname, "..", "test-app"));
  });

  test("should synth cdk application", async () => {
    const app: App = require("../test-app/lib/app").app;

    app.synth();
  });
});
