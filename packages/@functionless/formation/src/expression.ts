import { IntrinsicFunction } from "./function";

/**
 * An Expression which evaluates to a string value.
 */
export type Expression =
  | IntrinsicFunction
  | null
  | string
  | number
  | boolean
  | Expression[]
  | {
      [key: string]: Expression;
    };
