import { Expr } from "@functionless/ast";
import { ASLGraph } from "./asl-graph";

export interface EvalExprContext {
  /**
   * Callback provided to inject additional states into the graph.
   * The state will be joined (@see ASLGraph.joinSubStates ) with the previous and next states in the order received.
   */
  addState: (state: ASLGraph.NodeState | ASLGraph.SubState) => void;
  /**
   * Returns a {@link ASLGraph.JsonPath} which points to the output value of the evaluated expression.
   * Any states required are added to the graph in order.
   *
   * * If the output was a {@link ASLGraph.LiteralValue}, a new state will be added that turns the literal into a json path.
   * * If the output was a {@link ASLGraph.JsonPath}, the output is returned.
   * * If the output was a {@link ASLGraph.ConditionOutput}, a new {@link Choice} state will turn the conditional into a boolean
   *   and return a {@link ASLGraph.JsonPath}.
   */
  normalizeOutputToJsonPath(): ASLGraph.JsonPath;
  /**
   * Returns a {@link ASLGraph.JsonPath} or {@link ASLGraph.LiteralValue} which points to the output value of the evaluated expression.
   * Any states required are added to the graph in order.
   *
   * * If the output was a {@link ASLGraph.LiteralValue}, the output is returned.
   * * If the output was a {@link ASLGraph.JsonPath}, the output is returned.
   * * If the output was a {@link ASLGraph.ConditionOutput}, a new {@link Choice} state will turn the conditional into a boolean
   *   and return a {@link ASLGraph.JsonPath}.
   */
  normalizeOutputToJsonPathOrLiteral():
    | ASLGraph.JsonPath
    | ASLGraph.LiteralValue;
}

export interface EvalContextContext {
  /**
   * Callback provided to inject additional states into the graph.
   * The state will be joined (@see ASLGraph.joinSubStates ) with the previous and next states in the order received.
   */
  addState: (state: ASLGraph.NodeState | ASLGraph.SubState) => void;
  /**
   * Evaluates a single expression and returns the {@link ASLGraph.Output}.
   *
   * Any generated states will be merged in with the output.
   *
   * This method is the same as {@link ASL.evalExpr}, but it adds any generated states to the current {@link ASL.evalContext}.
   */
  evalExpr: (expr: Expr, allowUndefined?: boolean) => ASLGraph.Output;
  /**
   * Evaluates a single expression and returns the {@link ASLGraph.Output}.
   *
   * Any generated states will be merged in with the output.
   *
   * * If the output was a {@link ASLGraph.LiteralValue}, a new state will be added that turns the literal into a {@link ASL.JsonPath}.
   * * If the output was a {@link ASLGraph.ConditionOutput}, a new {@link Choice} state will turn the conditional into a boolean
   *
   * This method is the same as {@link ASL.evalExprToJsonPath}, but it adds any generated states to the current {@link ASL.evalContext}.
   */
  evalExprToJsonPath: (
    expr: Expr,
    allowUndefined?: boolean
  ) => ASLGraph.JsonPath;
  /**
   * Evaluates a single expression and returns the {@link ASLGraph.JsonPath} or {@link ASLGraph.LiteralValue}.
   *
   * Any generated states will be merged in with the output.
   *
   * If the output was a {@link ASLGraph.ConditionOutput}, a new {@link Choice} state will turn the conditional into a boolean
   * and return a {@link ASLGraph.JsonPath}.
   *
   * This method is the same as {@link ASL.evalExprToJsonPathOrLiteral}, but it adds any generated states to the current {@link ASL.evalContext}.
   */
  evalExprToJsonPathOrLiteral: (
    expr: Expr,
    allowUndefined?: boolean
  ) => ASLGraph.JsonPath | ASLGraph.LiteralValue;
  /**
   * Returns a {@link ASLGraph.JsonPath} which points to the value of the given output.
   * Any states required are added to the graph in order.
   *
   * * If the output was a {@link ASLGraph.LiteralValue}, a new state will be added that turns the literal into a json path.
   * * If the output was a {@link ASLGraph.JsonPath}, the output is returned.
   * * If the output was a {@link ASLGraph.ConditionOutput}, a new {@link Choice} state will turn the conditional into a boolean
   *   and return a {@link ASLGraph.JsonPath}.
   */
  normalizeOutputToJsonPath(output: ASLGraph.Output): ASLGraph.JsonPath;
  /**
   * Returns a {@link ASLGraph.JsonPath} which points to the value of the given output.
   * Any states required are added to the graph in order.
   *
   * * If the output was a {@link ASLGraph.LiteralValue}, the output is returned.
   * * If the output was a {@link ASLGraph.JsonPath}, the output is returned.
   * * If the output was a {@link ASLGraph.ConditionOutput}, a new {@link Choice} state will turn the conditional into a boolean
   *   and return a {@link ASLGraph.JsonPath}.
   */
  normalizeOutputToJsonPathOrLiteral(
    output: ASLGraph.Output
  ): ASLGraph.JsonPath | ASLGraph.LiteralValue;
  /**
   * Assigns an {@link ASLGraph.Output} to a jsonPath variable.
   *
   * If the {@link value} is a {@link ASLGraph.ConditionOutput}, states are added to turn
   * the condition into a boolean value.
   *
   * Any states required to assign the value are added to the graph in order.
   */
  assignValue(
    value: ASLGraph.Output,
    targetJsonPath?: string
  ): ASLGraph.JsonPath;
}

/**
 * Handler used by {@link ASL.evalContext} functions.
 *
 * @param context - some helper functions specific to the evaluation context.
 * @returns a state with output or output to be merged into the other states generated during evaluation.
 */
export type EvalContextHandler<T extends ASLGraph.NodeResults> = (
  context: EvalContextContext
) => T;

/**
 * Handler used by {@link ASL.evalExpr}* functions.
 *
 * @param output - the {@link ASLGraph.Output} generated by the output by the expression.
 * @param context - some helper functions specific to the evaluation context.
 * @returns a state with output or output to be merged into the other states generated during evaluation.
 */
export type EvalExprHandler<
  Output extends ASLGraph.Output = ASLGraph.Output,
  Result extends ASLGraph.NodeResults = ASLGraph.NodeResults
> = (output: Output, context: EvalExprContext) => Result;
