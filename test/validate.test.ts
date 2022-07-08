import "jest";
import fs from "fs";
import { readFile } from "fs/promises";
import path from "path";
import ts from "typescript";
import { ErrorCodes } from "../src";
import { makeFunctionlessChecker } from "../src/checker";
import { formatDiagnosticsWithColorAndContext } from "../src/format-error";
import { validate } from "../src/validate";

const testFilesDir = path.resolve(path.join(__dirname, "test-files"));

const tsconfig = {};
const compilerHost = ts.createCompilerHost(tsconfig, true);

const fileNames = fs
  .readdirSync(testFilesDir)
  .map((fileName) => path.join(testFilesDir, fileName));

const program = ts.createProgram(fileNames, tsconfig, compilerHost);

const checker = makeFunctionlessChecker(program.getTypeChecker());

test("api-gateway.ts", () => runTest("api-gateway.ts"));

test("step-function.ts", () => runTest("step-function.ts"));

test("function.ts", () => runTest("function.ts"));

test("appsync.ts", () => runTest("appsync.ts"));

test("event-bus.ts", () => runTest("event-bus.ts"));

describe("all error codes tested", () => {
  let file: string | undefined = undefined;
  beforeAll(async () => {
    file = (
      await readFile(
        path.resolve(__dirname, "./__snapshots__/validate.test.ts.snap")
      )
    ).toString("utf8");
  });

  test.concurrent.each(Object.values(ErrorCodes))(
    "$code: $title",
    async (code) => {
      expect(file!).toContain(`${code.code}`);
    }
  );
});

function runTest(fileName: string) {
  const diagnostics = validate(
    ts,
    checker,
    program.getSourceFile(path.join(testFilesDir, fileName))!
  );
  const errors = normalize(
    formatDiagnosticsWithColorAndContext(diagnostics, compilerHost)
  );
  expect(errors).toMatchSnapshot();
}

function normalize(str: string) {
  return str.replace(
    new RegExp(escapeRegExp(testFilesDir), "g"),
    "<workspace>"
  );
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
