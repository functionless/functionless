import { ASL } from "./asl";
import { VTL } from "./vtl";

// @ts-ignore - imported for ts-doc
import type { Table } from "./table";

/**
 * A {@link CallContext} refers to the context in which a functionless function called.
 *
 * Functionless Functions refer to functions of the shape:
 * ```ts
 * function functionlessFunc(call: CallExpr, context: CallContext): any;
 * ```
 *
 * For example, the {@link Table.getItem}.
 */
export type CallContext = ASL | VTL;
