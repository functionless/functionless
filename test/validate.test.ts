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

const skipErrorCodes: number[] = [
  // not possible to test, not validated for
  10001,
  // dynamic validation - lambda closure serialize poison pill
  10004,
  // generic - unexpected error
  10005,
  // dynamic validation - wrong step function import type
  10006,
  // dynamic validation - unsafe use of secrets
  10007,
  // generic - unsupported feature
  10021,
];

/**
 * Test for recorded validations of each error code.
 * 1. Checks if there is a validation for an error code.
 * 2. Checks if there is a test for the validation of the error code.
 *
 * If the error code cannot be validated or the validation cannot be easily tested, use skipErrorCodes to skip the code.
 */
describe("all error codes tested", () => {
  let file: string | undefined = undefined;
  beforeAll(async () => {
    file = (
      await readFile(
        path.resolve(__dirname, "./__snapshots__/validate.test.ts.snap")
      )
    ).toString("utf8");
  });

  test.concurrent.each(
    Object.values(ErrorCodes).filter(
      ({ code }) => !skipErrorCodes.includes(code)
    )
  )("$code: $title", async (code) => {
    expect(file!).toContain(`${code.code}`);
  });

  test.skip.each(
    Object.values(ErrorCodes).filter(({ code }) =>
      skipErrorCodes.includes(code)
    )
  )("$code: $title", () => {});
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
