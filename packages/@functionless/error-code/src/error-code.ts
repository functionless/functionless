import { ErrorType } from "./error-type";

export interface ErrorCode {
  /**
   * Error code, a unique number between 10000 and 99999.
   *
   * New error codes should be sequential.
   */
  readonly code: number;
  /**
   * The type of the error, determine how the error is displayed in the language service and on the website.
   */
  readonly type: ErrorType;
  /**
   * Title of the error which will appear on `https://functionless.org/docs/error-codes` and act as the deep link.
   * (https://functionless.org/docs/error-codes#title-with-dashes)
   */
  readonly title: string;
}
