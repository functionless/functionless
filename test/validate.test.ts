import "jest";
import fs from "fs";
import path from "path";
import ts from "typescript";
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
