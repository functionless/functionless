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
      "<rootDir>/src/**/__tests__/**/*.(t|j)s?(x)",
      "<rootDir>/(test|src)/**/*(*.)@(spec|test).(t|j)s?(x)",
      "<rootDir>/lib-test/(test|src)/**/*(*.)@(spec|test).(t|j)s?(x)",
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
    transform: {
      "^.+\\.(t|j)sx?$": ["@swc/jest", {}],
    },
    preset: "ts-jest",
    globals: {
      "ts-jest": {
        tsconfig: "tsconfig.dev.json",
      },
    },
  };
};
