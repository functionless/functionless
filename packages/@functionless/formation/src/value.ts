// @ts-ignore - import for tsdoc
import type { Expression } from "./expression";

/**
 * A {@link Value} is a raw JSON value that contains no un-evaluated {@link Expression}s
 */
export type Value =
  | undefined
  | null
  | boolean
  | number
  | string
  | Value[]
  | {
      [key: string]: Value;
    };
