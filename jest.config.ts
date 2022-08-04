// @e
import type { Config } from "@jest/types";

import "@swc/register";

export default async (): Promise<Config.InitialOptions> => {
  return {
    collectCoverage: false,
    coveragePathIgnorePatterns: ["/test/", "/node_modules/", "/lib"],
    moduleNameMapper: {
      "^@fnls$": "<rootDir>/lib/index",
    },
    testMatch: [
      "<rootDir>/src/**/__tests__/**/*.ts?(x)",
      "<rootDir>/(test|src)/**/*(*.)@(spec|test).ts?(x)",
    ],
    clearMocks: true,
    coverageReporters: ["json", "lcov", "clover", "cobertura", "text"],
    coverageDirectory: "coverage",
    testPathIgnorePatterns: ["/node_modules/"],
    watchPathIgnorePatterns: ["/node_modules/"],
    reporters: [
      "default",
      [
        "jest-junit",
        {
          outputDirectory: "test-reports",
        },
      ],
    ],
    preset: "ts-jest",
    globals: {
      "ts-jest": {
        tsconfig: "tsconfig.dev.json",
      },
    },
  };
};
