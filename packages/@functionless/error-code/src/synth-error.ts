import { ErrorCode } from "./error-code";
import { formatErrorMessage } from "./format-error";

/**
 * Error to throw during synth failures
 */
export class SynthError extends Error {
  constructor(readonly code: ErrorCode, message?: string) {
    super(formatErrorMessage(code, message));
  }
}
