import { Expr } from "@functionless/ast";
import { VTL } from "@functionless/vtl";

export interface APIGatewayVTL extends VTL {
  /**
   * Attempt to return the expression as a valid escaped json string.
   *
   * ```ts
   * {
   *    x: input
   * }
   * ```
   *
   * =>
   *
   * ```ts
   * { "x": $input.json('$') }
   * ```
   *
   * =>
   *
   * ```ts
   * "{ \"x\": $util.escapeJavaScript($input.json('$')) }"
   * ```
   */
  stringify(expr: Expr): string;
}
