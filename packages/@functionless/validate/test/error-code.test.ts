import { ErrorCodes } from "@functionless/error-code";

test("error codes must be unique", () => {
  const errorCodes = new Set<number>();
  Object.values(ErrorCodes).forEach(({ code }) => {
    expect(errorCodes).not.toContain(code);
    errorCodes.add(code);
  });
});

test("error codes must be between 10000 and 99999", () => {
  Object.values(ErrorCodes).forEach(({ code }) => {
    expect(code).toBeGreaterThanOrEqual(10000);
    expect(code).toBeLessThanOrEqual(99999);
  });
});
