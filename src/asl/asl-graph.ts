import { assertNever } from "../assert";
import { SynthError, ErrorCodes } from "../error-code";
import type { Expr } from "../expression";
import { FunctionlessNode } from "../node";
import { anyOf, formatJsonPath, invertBinaryOperator } from "../util";
import { ASLOptimizer } from "./optimizer";
import {
  isState,
  isChoiceState,
  isFailState,
  isSucceedState,
  isWaitState,
  isTaskState,
  isParallelTaskState,
  isMapTaskState,
  isPassState,
  States,
  CommonFields,
  Task,
  State,
  Pass,
  Condition,
  Parameters,
} from "./states";
import { ASL } from "./synth";

/**
 * ASL Graph is an intermediate API used to represent a nested and dynamic ASL State Machine Graph.
 *
 * Unlike ASL, the ASL graph supports nested nodes, can associate nodes to {@link FunctionlessNode}s, and contains a representation of the output of a state.
 *
 * ASL Graph is completely stateless.
 */
export namespace ASLGraph {
  export interface ASLOptions {
    /**
     * Options for the ASL Optimizer.
     *
     * Default: Suggested
     */
    optimization?: ASLOptimizer.OptimizeOptions;
  }

  /**
   * Used by integrations as a placeholder for the "Next" property of a task.
   *
   * When task.Next is ASLGraph.DeferNext, Functionless will replace the Next with the appropriate value.
   * It may also add End or ResultPath based on the scenario.
   */
  export const DeferNext = "__DeferNext";

  export function isSubState(
    state: ASLGraph.NodeState | ASLGraph.SubState | ASLGraph.NodeResults
  ): state is ASLGraph.SubState {
    return state && "startState" in state;
  }

  /**
   * A Sub-State is a collection of possible return values.
   * A start state is the first state in the result. It will take on the name of the parent statement node.
   * States are zero to many named states or sub-stages that will take on the name of the parent statement node.
   */
  export interface SubState {
    startState: string;
    node?: FunctionlessNode;
    states: Record<string, ASLGraph.NodeState | ASLGraph.SubState>;
  }

  export const isStateOrSubState = anyOf(isState, ASLGraph.isSubState);

  /**
   * An {@link ASLGraph} interface which adds an optional {@link FunctionlessNode} to a state.
   *
   * The node is used to name the state.
   */
  export type NodeState = State & {
    node?: FunctionlessNode;
  };

  /**
   * The possible outputs of evaluating an {@link Expr}.
   *
   * State - A state with an {@link ASLGraph.Output} and optional {@link FunctionlessNode}
   * SubStates - A sub-state graph with an {@link ASLGraph.Output} and optional {@link FunctionlessNode}
   * JsonPath - a JSON Path Variable Reference, the consumer should use where json path is valid, ignore, or fail.
   * Value - a Value of type number, string, boolean, object, or null. Consumers should use where values can be used or turn into JsonPath using a {@link Pass} state.
   */
  export type NodeResults =
    | ASLGraph.OutputState
    | ASLGraph.OutputSubState
    | ASLGraph.Output;

  /**
   * A compound state is a state node that may contain a simple Constant or Variable output instead of
   * built states or sub-states.
   *
   * Compound states are designed to be incorporated into existing states or turned into
   * states before they are returned up.
   *
   * Compound states cannot be nested in sub-states.
   */
  export interface OutputSubState extends ASLGraph.SubState {
    output: ASLGraph.Output;
  }

  /**
   * An {@link ASLGraph} interface which adds an {@link ASLGraph.Output} a state.
   *
   * The node is used to name the state.
   */
  export type OutputState = NodeState & {
    output: ASLGraph.Output;
  };

  export function isOutputStateOrSubState(
    state: any
  ): state is ASLGraph.OutputSubState | ASLGraph.OutputState {
    return "output" in state;
  }

  export type LiteralValueType =
    | undefined
    | string
    | number
    | null
    | boolean
    | {
        [key: string]: LiteralValueType;
      }
    | LiteralValueType[];

  /**
   * A literal value of type string, number, boolean, object, or null.
   *
   * If this is an Object, the object may contain nested JsonPaths as denoted by `containsJsonPath`.
   */
  export interface LiteralValue<
    Value extends LiteralValueType = LiteralValueType
  > {
    /**
     * Whether there is json path in the constant.
     *
     * Helps determine where this constant can go for validation and
     * when false use Result in a Pass State instead of Parameters
     */
    containsJsonPath: boolean;
    value: Value;
  }

  /**
   * A json path based state values reference.
   */
  export interface JsonPath {
    jsonPath: string;
  }

  export interface ConditionOutput {
    condition: Condition;
  }

  export type Output =
    | ASLGraph.LiteralValue
    | ASLGraph.JsonPath
    | ASLGraph.ConditionOutput;

  export interface IntrinsicFunction {
    funcName: string;
    args: (
      | ASLGraph.JsonPath
      | ASLGraph.LiteralValue
      | ASLGraph.IntrinsicFunction
    )[];
  }

  export function isLiteralValue(state: any): state is ASLGraph.LiteralValue {
    return "value" in state;
  }

  export function isLiteralNull(
    state: any
  ): state is ASLGraph.LiteralValue<null> {
    return isLiteralValue(state) && state.value === null;
  }

  export function isLiteralUndefined(
    state: any
  ): state is ASLGraph.LiteralValue<undefined> {
    return isLiteralValue(state) && state.value === undefined;
  }

  export function isLiteralNumber(
    state: any
  ): state is ASLGraph.LiteralValue<number> {
    return isLiteralValue(state) && typeof state.value === "number";
  }

  export function isLiteralString(
    state: any
  ): state is ASLGraph.LiteralValue<string> {
    return isLiteralValue(state) && typeof state.value === "string";
  }

  export function isLiteralArray(
    state: any
  ): state is ASLGraph.LiteralValue<any[]> {
    return isLiteralValue(state) && Array.isArray(state.value);
  }

  export function isLiteralObject(
    state: any
  ): state is ASLGraph.LiteralValue<Record<string, any>> {
    return (
      isLiteralValue(state) &&
      typeof state.value === "object" &&
      !Array.isArray(state.value) &&
      state.value !== null
    );
  }

  export function isJsonPath(state: any): state is ASLGraph.JsonPath {
    return "jsonPath" in state;
  }

  export function isIntrinsicFunction(
    state: any
  ): state is ASLGraph.IntrinsicFunction {
    return "funcName" in state;
  }

  export function isConditionOutput(
    state: any
  ): state is ASLGraph.ConditionOutput {
    return "condition" in state;
  }

  export const isAslGraphOutput = anyOf(
    isLiteralValue,
    isJsonPath,
    isConditionOutput
  );

  /**
   * Wires together an array of {@link State} or {@link ASLGraph.SubState} nodes in the order given.
   * Any state which is missing Next/End will be given a Next value of the next state with the final state
   * either being left as is.
   */
  export function joinSubStates(
    node?: FunctionlessNode,
    ...subStates: (
      | ASLGraph.NodeState
      | ASLGraph.SubState
      | ASLGraph.NodeResults
      | undefined
    )[]
  ): ASLGraph.SubState | ASLGraph.NodeState | undefined {
    if (subStates.length === 0) {
      return undefined;
    }

    const realStates = subStates
      .filter((x) => !!x)
      .filter(ASLGraph.isStateOrSubState);
    return realStates.length === 0
      ? undefined
      : realStates.length === 1
      ? { node, ...realStates[0]! }
      : {
          startState: "0",
          node,
          states: Object.fromEntries(
            realStates.map((subState, i) => {
              return [
                `${i}`,
                i === realStates.length - 1
                  ? subState
                  : updateDeferredNextStates({ Next: `${i + 1}` }, subState),
              ];
            })
          ),
        };
  }

  /**
   * Used to lazily provide the next step to a provided state or nested set of states.
   *
   * Recursively traverse sub-states down to regular states, replacing any
   * nodes with `Next: ASLGraph.DeferNext` or `Next: undefined` with the given props.
   *
   * Note: States without `Next` are ignored and {@link Map} states replace Default and `Choices[].Next` instead.
   */
  export function updateDeferredNextStates<T extends State | ASLGraph.SubState>(
    props:
      | {
          End: true;
          OutputPath?: string;
        }
      | {
          Next: string;
        },
    state: T
  ): T {
    return ASLGraph.isSubState(state)
      ? updateDeferredNextSubStates<Extract<typeof state, T>>(props, state)
      : (updateDeferredNextState<any>(props, state) as T);
  }

  /**
   * Updates DeferNext states for an entire sub-state.
   */
  function updateDeferredNextSubStates<T extends ASLGraph.SubState>(
    props:
      | {
          End: true;
          OutputPath?: string;
        }
      | {
          Next: string;
        },
    subState: T
  ): T {
    // address the next state as a level up to keep the name unique.
    const updatedProps =
      "Next" in props && props.Next
        ? {
            ...props,
            Next: `../${props.Next}`,
          }
        : props;
    return {
      ...subState,
      states: Object.fromEntries(
        Object.entries(subState.states ?? {}).map(([id, state]) => {
          return [id, updateDeferredNextStates(updatedProps, state)];
        })
      ),
    };
  }

  /**
   * Step functions can fail to deploy when extraneous properties are left on state nodes.
   * Only inject the properties the state type can handle.
   *
   * For example: https://github.com/functionless/functionless/issues/308
   * A Wait state with `ResultPath: null` was failing to deploy.
   */
  function updateDeferredNextState<T extends State>(
    props:
      | {
          End: true;
          OutputPath?: string;
        }
      | {
          Next: string;
        },
    state: T
  ): T {
    const [End, Next, OutputPath] =
      "End" in props
        ? [props.End, undefined, props.OutputPath]
        : [undefined, props.Next, undefined];

    if (isChoiceState(state)) {
      return {
        ...state,
        Choices: state.Choices.map((choice) => ({
          ...choice,
          Next: choice.Next === ASLGraph.DeferNext ? Next! : choice.Next,
        })),
        Default: state.Default === ASLGraph.DeferNext ? Next : state.Default,
      };
    } else if (isFailState(state) || isSucceedState(state)) {
      return state;
    } else if (isWaitState(state)) {
      return {
        ...state,
        End: state.Next === ASLGraph.DeferNext ? End : state.End,
        Next: state.Next === ASLGraph.DeferNext ? Next : state.Next,
        OutputPath:
          state.Next === ASLGraph.DeferNext ? OutputPath : state.OutputPath,
      } as T;
    } else if (
      isTaskState(state) ||
      isParallelTaskState(state) ||
      isMapTaskState(state)
    ) {
      return {
        ...state,
        Catch: state.Catch
          ? state.Catch.map((_catch) => ({
              ..._catch,
              Next: _catch.Next === ASLGraph.DeferNext ? Next : _catch.Next,
            }))
          : undefined,
        End: state.Next === ASLGraph.DeferNext ? End : state.End,
        Next: state.Next === ASLGraph.DeferNext ? Next : state.Next,
        OutputPath:
          state.Next === ASLGraph.DeferNext ? OutputPath : state.OutputPath,
      } as T;
    } else if (isPassState(state)) {
      return {
        ...state,
        End: state.Next === ASLGraph.DeferNext ? End : state.End,
        Next: state.Next === ASLGraph.DeferNext ? Next : state.Next,
        OutputPath:
          state.Next === ASLGraph.DeferNext ? OutputPath : state.OutputPath,
      };
    }
    assertNever(state);
  }

  /**
   * Helper which can update a Asl state to a new output.
   * Sometimes the output can be updated in places like when accessing a constant or variable.
   *
   * If the state is a compound state, only the output needs to change, not the states it contains.
   *
   * ```ts
   * const obj = { a: { b: 1 } };
   * return obj.a.b;
   * ```
   *
   * output of obj.a
   * { startState: ..., states: {...}, output: { jsonPath: "$.obj.a" } }
   *
   * output of obj.a.b
   * { startState: ..., states: {...}, output: { jsonPath: "$.obj.a.b" } }
   *
   * Only the jsonPath has been mutated because no one used use intermediate output.
   */
  export function updateAslStateOutput(
    state: ASLGraph.NodeResults,
    newOutput: ASLGraph.Output
  ) {
    if (ASLGraph.isOutputStateOrSubState(state)) {
      return {
        ...state,
        output: newOutput,
      };
    }
    return newOutput;
  }

  /**
   * Key map for re-writing relative state names to absolute
   */
  interface NameMap {
    parent?: NameMap;
    localNames: Record<string, string>;
  }

  /**
   * Transforms an {@link ASLGraph.AslState} or {@link ASLGraph.SubState} into a ASL {@link States} collection of flat states.
   *
   * Uses the parent name as a starting point. All state nodes of sub-states will be given the name of their parent.
   *
   * Sub-States with local or relative state references will be rewritten to the updated parent state name.
   *
   * Removes unreachable states from the graph. Unreachable states will cause step functions to fail.
   *
   * sub state
   * ```ts
   * {
   *    startState: "default",
   *    states: {
   *      default: { Next: 'b' },
   *      b: { Next: 'c' },
   *      c: { Next: 'externalState' }
   *    }
   * }
   * ```
   *
   * Parent state name: parentState
   *
   * rewrite
   * ```ts
   * {
   *    parentState: { Next: 'b__parentState' },
   *    b__parentState: { Next: 'c__parentState' },
   *    c__parentState: { Next: 'externalState' }
   * }
   * ```
   *
   * Local State Names
   *
   * In the below example, default, b, and c are all local state names.
   *
   * ```ts
   * {
   *    startState: "default",
   *    states: {
   *      default: { Next: 'b' },
   *      b: { Next: 'c' },
   *      c: { Next: 'externalState' }
   *    }
   * }
   * ```
   *
   * Relative state names
   *
   * Path structures can be used to denote relative paths. ex: `../stateName`.
   *
   * ```ts
   * {
   *    startState: "default",
   *    states: {
   *      default: { Next: 'b' },
   *      b: {
   *         startState: "start",
   *         states: {
   *            start: {
   *               Next: "../c"
   *            }
   *         }
   *      },
   *      c: { Next: 'externalState' }
   *    }
   * }
   * ```
   *
   * In the above example, b/start's next state is c in it's parent state.
   *
   * Currently referencing child states (ex: `./b/start`) is not supported.
   *
   * All state names not found in local or parent sub-states will be assumed to be top level state names and will not be re-written.
   */
  export function toStates(
    startState: string,
    states:
      | ASLGraph.NodeState
      | ASLGraph.SubState
      | ASLGraph.OutputState
      | ASLGraph.OutputSubState,
    getStateNames: (
      parentName: string,
      states: ASLGraph.SubState
    ) => Record<string, string>,
    options?: ASLOptions
  ): States {
    const namedStates = internal(startState, states, { localNames: {} });

    return ASLOptimizer.optimizeGraph(
      startState,
      Object.fromEntries(namedStates),
      options?.optimization
    );

    function internal(
      parentName: string,
      states:
        | ASLGraph.NodeState
        | ASLGraph.SubState
        | ASLGraph.OutputState
        | ASLGraph.OutputSubState,
      stateNameMap: NameMap
    ): [string, State][] {
      if (!states) {
        return [];
      } else if (!ASLGraph.isSubState(states)) {
        // strip output and node off of the state object.
        const { node, output, ...updated } = <ASLGraph.OutputState>(
          rewriteStateTransitions(states, stateNameMap)
        );
        return [[parentName, updated]];
      } else {
        const nameMap: NameMap = {
          parent: stateNameMap,
          localNames: getStateNames(parentName, states),
        };
        return Object.entries(states.states).flatMap(([key, state]) => {
          const parentName = nameMap.localNames[key];
          if (!parentName) {
            throw new SynthError(
              ErrorCodes.Unexpected_Error,
              `Expected all local state names to be provided with a parent name, found ${key}`
            );
          }
          return internal(parentName, state, nameMap);
        });
      }
    }
  }

  /**
   * Visit each transition in each state.
   * Use the callback to update the transition name.
   */
  function visitTransition(
    state: State,
    cb: (next: string) => string | undefined | void
  ): State {
    const cbOrNext = (next: string) => cb(next) ?? next;
    if ("End" in state && state.End !== undefined) {
      return state;
    }
    if (isChoiceState(state)) {
      return {
        ...state,
        Choices: state.Choices.map((choice) => ({
          ...choice,
          Next: cbOrNext(choice.Next),
        })),
        Default: state.Default ? cbOrNext(state.Default) : undefined,
      };
    } else if ("Catch" in state) {
      return {
        ...state,
        Catch: state.Catch?.map((_catch) => ({
          ..._catch,
          Next: _catch.Next ? cbOrNext(_catch.Next) : _catch.Next,
        })),
        Next: state.Next ? cbOrNext(state.Next) : state.Next,
      };
    } else if (!("Next" in state)) {
      return state;
    }
    return {
      ...state,
      Next: state.Next ? cbOrNext(state.Next) : state.Next,
    };
  }

  /**
   * Finds the local state name in the nameMap.
   *
   * If the name contains the prefix `../` the search will start up a level.
   *
   * If a name is not found at the current level, the parent names will be searched.
   *
   * If no local name is found, the next value is returned as is.
   */
  function rewriteStateTransitions(
    state: ASLGraph.NodeState,
    subStateNameMap: NameMap
  ) {
    return visitTransition(state, (next) =>
      updateTransition(next, subStateNameMap)
    );

    function updateTransition(next: string, nameMap: NameMap): string {
      if (next.startsWith("../")) {
        if (nameMap.parent) {
          return updateTransition(next.substring(3), nameMap.parent);
        }
        return next.substring(3);
      } else {
        const find = (nameMap: NameMap): string => {
          if (next in nameMap.localNames) {
            return nameMap.localNames[next]!;
          } else if (nameMap.parent) {
            return find(nameMap.parent);
          } else {
            return next;
          }
        };
        return find(nameMap);
      }
    }
  }

  /**
   * Normalized an ASL state to just the output (constant or variable).
   */
  export function getAslStateOutput(
    state: ASLGraph.NodeResults
  ): ASLGraph.Output {
    return ASLGraph.isAslGraphOutput(state) ? state : state.output;
  }

  /**
   * Applies an {@link ASLGraph.Output} to a partial {@link Pass}.
   *
   * {@link ASLGraph.ConditionOutput} must be first turned into a {@link ASLGraph.JsonPath}.
   */
  export function passWithInput(
    pass: Omit<NodeState & Pass, "Parameters" | "InputPath" | "Result"> &
      CommonFields,
    value: Exclude<ASLGraph.Output, ASLGraph.ConditionOutput>
  ): Pass {
    return {
      ...pass,
      ...(ASLGraph.isJsonPath(value)
        ? {
            InputPath: value.jsonPath,
          }
        : value.containsJsonPath
        ? {
            Parameters: value.value as unknown as Parameters,
          }
        : {
            Result: value.value,
          }),
    };
  }

  /**
   * Applies an {@link ASLGraph.Output} to a partial {@link Task}
   *
   * {@link ASLGraph.ConditionOutput} must be first turned into a {@link ASLGraph.JsonPath}.
   */
  export function taskWithInput(
    task: Omit<Task, "Parameters" | "InputPath"> & CommonFields,
    value: Exclude<ASLGraph.Output, ASLGraph.ConditionOutput>
  ): Task {
    return {
      ...task,
      ...(ASLGraph.isJsonPath(value)
        ? {
            InputPath: value.jsonPath,
          }
        : {
            Parameters: value.value as unknown as Parameters,
          }),
    };
  }

  /**
   * As of Sept 2022, Step Functions failed validation when more than 10 intrinsic functions were nested.
   * The below functions attempt to bypass the issue by dynamically splitting trees of intrinsic functions
   * when the max is reached.
   */
  export const MAX_INTRINSIC_COUNT = 10;

  /**
   * Helper that generates a {@link Pass} state to assign a single jsonPath or intrinsic to
   * an output location.
   *
   * ```ts
   * assignJsonPathOrIntrinsic("out", "$.var", "States.Array(1,2,3)");
   * ```
   *
   * =>
   *
   * ```ts
   * {
   *    "Type": "Pass",
   *    "Parameters": {
   *       "out.$": "State.Array(1,2,3)"
   *    },
   *    "Next": ASLGraph.DeferNext,
   *    "ResultPath": "$.var",
   *    "output": { "jsonPath": "$.var.out" }
   * }
   * ```
   *
   * Note: when the nested intrinsic depth exceeds {@link ASLGraph.MAX_INTRINSIC_COUNT}, multiple states will be created to not hit the limit.
   *
   * @param jsonPathOrIntrinsic - json path (ex: $.var) or instrinsic function (ex: States.Array) to place into the output.
   */
  export function assignJsonPathOrIntrinsic(
    jsonPathOrIntrinsic: IntrinsicFunction | JsonPath,
    resultPath: string | ASLGraph.JsonPath,
    propertyName: string = "out",
    next: string = ASLGraph.DeferNext,
    node?: FunctionlessNode
  ): ((ASLGraph.NodeState & Pass) | ASLGraph.OutputSubState) & {
    output: ASLGraph.JsonPath;
  } {
    const fullPath = ASLGraph.jsonPath(resultPath, propertyName);
    const { rendered, states = undefined } = ASLGraph.isIntrinsicFunction(
      jsonPathOrIntrinsic
    )
      ? safeRenderIntrinsicFunction(jsonPathOrIntrinsic, fullPath)
      : { rendered: jsonPathOrIntrinsic.jsonPath };

    const returnState: Pass = {
      Type: "Pass",
      Parameters: {
        [`${propertyName}.$`]: rendered,
      },
      ResultPath:
        typeof resultPath === "string" ? resultPath : resultPath.jsonPath,
      Next: next,
    };

    if (states) {
      return {
        ...ASLGraph.joinSubStates(node, states, returnState)!,
        node,
        output: fullPath,
      } as ASLGraph.OutputSubState & { output: ASLGraph.JsonPath };
    }

    return {
      ...returnState,
      node,
      output: fullPath,
    };
  }

  /**
   * Render an {@link ASLGraph.IntrinsicFunction}.
   *
   * If an Intrinsic function contains nested intrinsic calls beyond {@link ASLGraph.MAX_INTRINSIC_COUNT},
   * new states are also returned that render the nested calls in new Pass Parameters assignments.
   *
   * If the MAX is 2 for example `States.Call(States.Call(States.Call(), States.Call()))`
   *
   * The MAX of 2 means that having more than 2 intrinsic function calls in the same Parameter key will fail ASL validation.
   *
   * We would return the follow
   *
   * ```
   * states => {
   *    Pass,
   *    Parameters: {
   *      "d0.$": "States.Call()",
   *      "d1.$": "States.Call()"
   *    },
   *    ResultPath: "$.result.out"
   * }
   *
   *
   * rendered => "States.Call(States.Call($.result.out.d1, $.result.out.d1))"
   * ```
   *
   * Notice that the given resultPath is used for the nested calls, meaning the
   * temporary values will be erased by the final assignment.
   */
  export function safeRenderIntrinsicFunction(
    jsonPathOrIntrinsic: IntrinsicFunction,
    resultPath: string | ASLGraph.JsonPath
  ): { rendered: string; states?: ASLGraph.SubState | ASLGraph.NodeState } {
    // all states required to render the nested functions, may be empty.
    const intrinsicSequenceStates: (ASLGraph.SubState | State)[] = [];
    // all properties to return in the final pass.
    const nestedFunctionAssignment: [string, string][] = [];

    // create unique property names for each nested function.
    let subPropCounter = 0;

    /**
     * When the {@link renderMaxNestedIntrinsicFunctions} reaches {@link MAX_INTRINSIC_COUNT},
     * this callback is called to handle the rendering of the next nested function.
     *
     * This next function may also need to be further de-nested, so call ourselves recursively until a leaf is found.
     */
    const renderIntrinsicSafeHandler = (func: ASLGraph.IntrinsicFunction) => {
      const depthProp = `d${subPropCounter++}`;
      const basePath = ASLGraph.jsonPath(resultPath, depthProp);
      const { rendered, states } = safeRenderIntrinsicFunction(func, basePath);
      if (states) {
        // it may takes new states to render the children of this intrinsic function
        // (when MAX_INTRINSIC_COUNT is reached again).
        intrinsicSequenceStates.push(states);
      }
      // add the property to our set of properties to return
      nestedFunctionAssignment.push([depthProp, rendered]);
      // return a reference to the value we will create.
      return basePath;
    };

    const rendered = ASLGraph.renderMaxNestedIntrinsicFunctions(
      jsonPathOrIntrinsic,
      renderIntrinsicSafeHandler
    );

    return {
      rendered,
      states: joinSubStates(
        undefined,
        ...intrinsicSequenceStates,
        ...(nestedFunctionAssignment.length > 0
          ? [
              {
                Type: "Pass" as const,
                Parameters: Object.fromEntries(
                  nestedFunctionAssignment.map(([key, value]) => [
                    `${key}.$`,
                    value,
                  ])
                ),
                ResultPath: ASLGraph.jsonPath(resultPath).jsonPath,
                Next: ASLGraph.DeferNext,
              },
            ]
          : [])
      ),
    };
  }

  /**
   * Render an {@link ASLGraph.IntrinsicFunction}.
   *
   * This render method may produce an invalid intrinsic function is the depth is greater than {@link ASLGraph.MAX_INTRINSIC_COUNT}.
   *
   * Use {@link ASLGraph.safeRenderIntrinsicFunction} or {@link ASLGraph.renderMaxNestedIntrinsicFunctions} to handle functions that can hit a max depth.
   */
  export function renderIntrinsicFunction(func: IntrinsicFunction): string {
    return renderMaxNestedIntrinsicFunctions(func, (f) => f);
  }

  /**
   * Render an {@link ASLGraph.IntrinsicFunction}.
   *
   * If an Intrinsic function contains nested intrinsic calls beyond {@link ASLGraph.MAX_INTRINSIC_COUNT},
   * the `onMaxNestedReached` callback is called.
   *
   * If an {@link ASLGraph.IntrinsicFunction} is returned by the `onMaxNestedReached` callback,
   * the rest of this branch will render unsafe (using {@link ASLGraph.renderIntrinsicFunction}).
   */
  export function renderMaxNestedIntrinsicFunctions(
    func: IntrinsicFunction,
    onMaxNestedReached: (
      func: ASLGraph.IntrinsicFunction
    ) => ASLGraph.JsonPath | ASLGraph.IntrinsicFunction
  ): string {
    let total = 1;

    return render(func);

    function render(func: IntrinsicFunction): string {
      const { funcName, args } = func;
      return `${funcName}(${args
        .map((arg) => {
          if (
            // if the argument is an intrinsic function, check to see if we hit the limit.
            ASLGraph.isIntrinsicFunction(arg) &&
            total++ >= MAX_INTRINSIC_COUNT
          ) {
            // if so, ask the caller what to do and use their answer.
            const depthHandled = onMaxNestedReached(arg);

            return ASLGraph.isJsonPath(depthHandled)
              ? depthHandled.jsonPath
              : // if an intrinsic function is returned, render the test of the stack unsafe.
                ASLGraph.renderIntrinsicFunction(depthHandled);
          }
          return ASLGraph.isIntrinsicFunction(arg)
            ? render(arg)
            : ASLGraph.isLiteralString(arg)
            ? `'${arg.value}'`
            : ASLGraph.isLiteralValue(arg)
            ? arg.value
            : arg.jsonPath;
        })
        .join(",")})`;
    }
  }

  /**
   * Compare any two {@link ASLGraph.Output} values.
   */
  export function compareOutputs(
    leftOutput: ASLGraph.Output,
    rightOutput: ASLGraph.Output,
    operator: ASL.ValueComparisonOperators
  ): Condition {
    if (
      ASLGraph.isLiteralValue(leftOutput) &&
      ASLGraph.isLiteralValue(rightOutput)
    ) {
      return ((operator === "==" || operator === "===") &&
        leftOutput.value === rightOutput.value) ||
        ((operator === "!=" || operator === "!==") &&
          leftOutput.value !== rightOutput.value) ||
        (leftOutput.value !== null &&
          leftOutput.value !== undefined &&
          rightOutput.value !== null &&
          rightOutput.value !== undefined &&
          ((operator === ">" && leftOutput.value > rightOutput.value) ||
            (operator === "<" && leftOutput.value < rightOutput.value) ||
            (operator === "<=" && leftOutput.value <= rightOutput.value) ||
            (operator === ">=" && leftOutput.value >= rightOutput.value)))
        ? ASL.trueCondition()
        : ASL.falseCondition();
    }

    const [left, right] =
      ASLGraph.isJsonPath(leftOutput) || ASLGraph.isConditionOutput(leftOutput)
        ? [leftOutput, rightOutput]
        : [
            rightOutput as ASLGraph.JsonPath | ASLGraph.ConditionOutput,
            leftOutput,
          ];
    // if the right is a variable and the left isn't, invert the operator
    // 1 >= a -> a <= 1
    // a >= b -> a >= b
    // a >= 1 -> a >= 1
    const op = leftOutput === left ? operator : invertBinaryOperator(operator);

    return ASLGraph.compare(left, right, op as any);
  }

  /**
   * Compare a computed variable or unresolved conditional (left) to any other value (right).
   *
   * Comparing two literals is done with {@link ASLGraph.compareOutputs}.
   *
   * TODO: Implement abstract equality algorithm for `==` and `!=`
   *       https://github.com/functionless/functionless/issues/445
   *       Current `==` and `===` are treated the same.
   */
  export function compare(
    left: ASLGraph.JsonPath | ASLGraph.ConditionOutput,
    right: ASLGraph.Output,
    operator: ASL.ValueComparisonOperators | "!=" | "!=="
  ): Condition {
    if (
      operator === "==" ||
      operator === "===" ||
      operator === ">" ||
      operator === "<" ||
      operator === ">=" ||
      operator === "<="
    ) {
      // left is a condition and right is any value
      if (ASLGraph.isConditionOutput(left)) {
        return (
          ASLGraph.booleanCompare(left, right, operator) ?? ASL.falseCondition()
        );
      }

      return ASL.or(
        // for ==/===
        // if right is undefined literal, check isNotPresent(left)
        // if right is a variable, check isNotPresent(left) && isNotPresent(right)
        ASLGraph.undefinedCompare(left, right, operator),
        // ||
        ASL.and(
          // left !== undefined
          ASL.isPresent(left.jsonPath),
          // && right !== undefined (if right is a variable)
          ASLGraph.isJsonPath(right)
            ? ASL.isPresent(right.jsonPath)
            : undefined,
          ASL.or(
            // left === null && right === null
            ASLGraph.nullCompare(left, right, operator),
            ASL.and(
              // left !== null
              ASL.isNotNull(left.jsonPath),
              // right !== null
              ASLGraph.isJsonPath(right)
                ? ASL.isNotNull(right.jsonPath)
                : undefined,
              // && left [op] right
              ASL.or(
                ASLGraph.stringCompare(left, right, operator),
                ASLGraph.booleanCompare(left, right, operator),
                ASLGraph.numberCompare(left, right, operator)
              )
            )
          )
        )
      );
    } else if (operator === "!=" || operator === "!==") {
      return ASL.not(
        ASLGraph.compare(left, right, operator === "!==" ? "===" : "==")
      );
    }

    assertNever(operator);
  }

  /**
   * Provide comparison logic when right may be a string for any left value.
   *
   * if right is string literal or json path
   *   typeof left === "string" && left === right
   * else
   *    undefined
   */
  export function stringCompare(
    left: ASLGraph.JsonPath,
    right: ASLGraph.Output,
    operator: ASL.ValueComparisonOperators
  ) {
    if (
      ASLGraph.isJsonPath(right) ||
      (ASLGraph.isLiteralValue(right) && typeof right.value === "string")
    ) {
      return ASL.and(
        ASL.isString(left.jsonPath),
        ASLGraph.isJsonPath(right)
          ? ASL.comparePathOfType(
              left.jsonPath,
              operator,
              right.jsonPath,
              "string"
            )
          : ASL.compareValueOfType(
              left.jsonPath,
              operator,
              right.value as string
            )
      );
    }
    return undefined;
  }

  /**
   * Provide comparison logic when right may be a number for any left value.
   *
   * if right is number literal or json path
   *   typeof left === "number" && left === right
   * else
   *    undefined
   */
  export function numberCompare(
    left: ASLGraph.JsonPath,
    right: ASLGraph.Output,
    operator: ASL.ValueComparisonOperators
  ) {
    if (
      ASLGraph.isJsonPath(right) ||
      (ASLGraph.isLiteralValue(right) && typeof right.value === "number")
    ) {
      return ASL.and(
        ASL.isNumeric(left.jsonPath),
        ASLGraph.isJsonPath(right)
          ? ASL.comparePathOfType(
              left.jsonPath,
              operator,
              right.jsonPath,
              "number"
            )
          : ASL.compareValueOfType(
              left.jsonPath,
              operator,
              right.value as number
            )
      );
    }
    return undefined;
  }

  /**
   * Provide comparison logic when right may be a boolean for any left value.
   *
   * If ==/===
   *   if left is a conditional
   *      if right is a conditional
   *         (!left && !right) || (left && right)
   *      if right is boolean literal
   *         right ? left : !left
   *      if right is jsonPath
   *         (!left && right === false) || (left && right === true)
   *   if right is conditional
   *      (!right && left === false) || (right && left === true)
   *   if right is boolean literal or json path
   *      typeof left === "boolean" && left === right
   * else
   *   undefined
   */
  export function booleanCompare(
    left: ASLGraph.JsonPath | ASLGraph.ConditionOutput,
    right: ASLGraph.Output,
    operator: ASL.ValueComparisonOperators
  ) {
    if (operator === "===" || operator === "==") {
      // (z == b) === (a ==c c)
      if (ASLGraph.isConditionOutput(left)) {
        if (ASLGraph.isConditionOutput(right)) {
          // (!left && !right) || (left && right)
          return ASL.or(
            ASL.and(ASL.not(left.condition), ASL.not(right.condition)),
            ASL.and(left.condition, right.condition)
          );
        } else if (
          ASLGraph.isLiteralValue(right) &&
          typeof right.value === "boolean"
        ) {
          // (a === b) === true
          return right.value ? left.condition : ASL.not(left.condition);
        } else if (ASLGraph.isJsonPath(right)) {
          // (a === b) === c
          return ASL.or(
            ASL.and(
              ASL.not(left.condition),
              ASL.booleanEquals(right.jsonPath, false)
            ),
            ASL.and(left.condition, ASL.booleanEquals(right.jsonPath, true))
          );
        }
      } else if (ASLGraph.isConditionOutput(right)) {
        // a === (b === c)
        return ASL.or(
          ASL.and(
            ASL.not(right.condition),
            ASL.booleanEquals(left.jsonPath, false)
          ),
          ASL.and(right.condition, ASL.booleanEquals(left.jsonPath, true))
        );
      } else if (
        ASLGraph.isJsonPath(right) ||
        typeof right.value === "boolean"
      ) {
        return ASL.and(
          ASL.isBoolean(left.jsonPath),
          ASLGraph.isJsonPath(right)
            ? ASL.comparePathOfType(
                left.jsonPath,
                operator,
                right.jsonPath,
                "boolean"
              )
            : ASL.compareValueOfType(
                left.jsonPath,
                operator,
                right.value as boolean
              )
        );
      }
    }
    return undefined;
  }

  /**
   * Provide comparison logic when right may be null for any left value.
   *
   * If ==/===
   *   if right is a variable - check for isNull(left) && isNull(right)
   *   if right is null - check for isNull(left)
   *   else
   *     undefined
   * else
   *   undefined
   */
  export function nullCompare(
    left: ASLGraph.JsonPath,
    right: ASLGraph.Output,
    operator: ASL.ValueComparisonOperators
  ) {
    if (operator === "==" || operator === "===") {
      if (ASLGraph.isJsonPath(right)) {
        return ASL.and(ASL.isNull(left.jsonPath), ASL.isNull(right.jsonPath));
      } else if (ASLGraph.isLiteralValue(right) && right.value === null) {
        return ASL.isNull(left.jsonPath);
      }
    }
    return undefined;
  }

  /**
   * Provide comparison logic when right may be undefined for any left value.
   *
   * If ==/===
   *   if right is a variable - check for isNotPresent(left) && isNotPresent(right)
   *   if right is undefined - check for isNotPresent(left)
   *   else
   *     undefined
   * else
   *   undefined
   */
  export function undefinedCompare(
    left: ASLGraph.JsonPath,
    right: ASLGraph.Output,
    operator: ASL.ValueComparisonOperators
  ) {
    if (operator === "==" || operator === "===") {
      if (ASLGraph.isJsonPath(right)) {
        return ASL.and(
          ASL.isNotPresent(left.jsonPath),
          ASL.isNotPresent(right.jsonPath)
        );
      } else if (ASLGraph.isLiteralValue(right) && right.value === undefined) {
        return ASL.isNotPresent(left.jsonPath);
      }
    }
    return undefined;
  }

  /**
   * Returns a object with the key formatted based on the contents of the value.
   * in ASL, object keys that reference json path values must have a suffix of ".$"
   * { "input.$": "$.value" }
   */
  export function jsonAssignment(
    key: string,
    output: Exclude<ASLGraph.Output, ASLGraph.ConditionOutput>
  ): Record<string, any> {
    return {
      [ASLGraph.isJsonPath(output) ? `${key}.$` : key]: ASLGraph.isLiteralValue(
        output
      )
        ? output.value
        : output.jsonPath,
    };
  }

  /**
   * Safely sets a key into a literal object.
   *
   * In ASL, `key.$` and `key` are the same. If both exist at runtime, the machine will fail.
   *
   * {
   *    key.$: $.value
   * }
   * set("key", "someConstant")
   * {
   *    key: "someConstant"
   * }
   */
  export function setKeyOnLiteralObject(
    key: string,
    literalObject: ASLGraph.LiteralValue<
      Record<string, ASLGraph.LiteralValueType>
    >,
    value: ASLGraph.LiteralValue | ASLGraph.JsonPath,
    containsJsonPath?: boolean
  ): ASLGraph.LiteralValue<Record<string, ASLGraph.LiteralValueType>> {
    const obj = { ...literalObject.value };
    delete obj[`${key}.$`];
    delete obj[key];
    return ASLGraph.literalValue(
      {
        ...obj,
        ...ASLGraph.jsonAssignment(key, value),
      },
      ASLGraph.isJsonPath(value) ||
        literalObject.containsJsonPath ||
        value.containsJsonPath ||
        containsJsonPath
    );
  }

  /**
   * Merge two object literals together.
   */
  export function mergeLiteralObject(
    literalObject: ASLGraph.LiteralValue<
      Record<string, ASLGraph.LiteralValueType>
    >,
    literalObject2: ASLGraph.LiteralValue<
      Record<string, ASLGraph.LiteralValueType>
    >
  ): ASLGraph.LiteralValue<Record<string, ASLGraph.LiteralValueType>> {
    return Object.entries(literalObject2.value).reduce((obj, [key, value]) => {
      const isJsonPath =
        typeof value === "string" && key[key.length - 1] === "$";
      return setKeyOnLiteralObject(
        isJsonPath ? key.substring(0, key.length - 2) : key,
        obj,
        isJsonPath ? ASLGraph.jsonPath(value) : ASLGraph.literalValue(value),
        literalObject2.containsJsonPath
      );
    }, literalObject);
  }

  export function isTruthyOutput(v: ASLGraph.Output): Condition {
    return ASLGraph.isLiteralValue(v)
      ? v.value
        ? ASL.trueCondition()
        : ASL.falseCondition()
      : ASLGraph.isJsonPath(v)
      ? ASL.isTruthy(v.jsonPath)
      : v.condition;
  }

  export function elementIn(
    element: ASLGraph.LiteralValue<string> | ASLGraph.LiteralValue<number>,
    targetJsonPath: ASLGraph.JsonPath
  ): Condition {
    const accessed = ASLGraph.accessConstant(targetJsonPath, element);

    if (ASLGraph.isLiteralValue(accessed)) {
      return accessed.value === undefined
        ? ASL.falseCondition()
        : ASL.trueCondition();
    } else {
      return ASL.isPresent(accessed.jsonPath);
    }
  }

  /**
   * @param element - when true (or field is a number) the output json path will prefer to use the square bracket format.
   *                  `$.obj[field]`. When false will prefer the dot format `$.obj.field`.
   */
  export function accessConstant(
    value: ASLGraph.Output,
    field: ASLGraph.LiteralValue<string> | ASLGraph.LiteralValue<number>
  ): ASLGraph.JsonPath | ASLGraph.LiteralValue {
    if (ASLGraph.isJsonPath(value)) {
      return { jsonPath: formatJsonPath([field.value], value.jsonPath) };
    }

    if (ASLGraph.isLiteralValue(value) && value.value) {
      const accessedValue = (() => {
        if (Array.isArray(value.value)) {
          if (ASLGraph.isLiteralNumber(field)) {
            return value.value[field.value];
          }
          throw new SynthError(
            ErrorCodes.StepFunctions_Invalid_collection_access,
            "Accessor to an array must be a constant number"
          );
        } else if (ASLGraph.isLiteralObject(value)) {
          return value.value[field.value];
        }
        throw new SynthError(
          ErrorCodes.StepFunctions_Invalid_collection_access,
          "Only a constant object or array may be accessed."
        );
      })();

      return typeof accessedValue === "string" &&
        (accessedValue.startsWith("$") || accessedValue.startsWith("States."))
        ? { jsonPath: accessedValue }
        : {
            value: accessedValue,
            containsJsonPath: value.containsJsonPath,
          };
    }

    throw new SynthError(
      ErrorCodes.StepFunctions_Invalid_collection_access,
      "Only a constant object or array may be accessed."
    );
  }

  /**
   * Wraps any literal value which can be output an an ASL state.
   *
   * @param containsJsonPath - when true, denotes that an object contains json path in it's properties at any depth.
   *                           ```ts
   *                           { "key.$": "$.value" }
   *                           ```
   *                           ```ts
   *                           { k: { "key.$": "$.value" } }
   *                           ```
   */
  export function literalValue<V extends LiteralValueType = LiteralValueType>(
    value: V,
    containsJsonPath: boolean = false
  ): ASLGraph.LiteralValue<V> {
    return {
      value,
      containsJsonPath,
    };
  }

  /**
   * Represents any json path output by an ASL state.
   *
   * Provides a friendly helper for formatting json path segments.
   *
   * ```ts
   * const j = ASLGraph.jsonPath("$.path", "seg");
   * j.jsonPath // $.path.seg
   * ```
   */
  export function jsonPath(
    jsonPath: string | JsonPath,
    ...segment: string[]
  ): JsonPath {
    return {
      jsonPath: `${
        typeof jsonPath === "string"
          ? jsonPath.startsWith("$")
            ? jsonPath
            : // normalize leading segments to `$.`
              // strings that are already $., $, or $$. should be unaffected
              `$.${jsonPath}`
          : jsonPath.jsonPath
      }${segment.length > 0 ? `.${segment.join(".")}` : ""}`,
    };
  }

  /**
   * Represents a conditional statement which can be returned from a state.
   *
   * For example
   *
   * ```ts
   * x === 1 // ASLGraph.conditionOutput(ASL.equals(...))
   * ```
   */
  export function conditionOutput(condition: Condition) {
    return { condition };
  }

  /**
   * Formats an intrinsic function.
   *
   * ```ts
   * ASLGraph.intrinsicFunction("States.Format", `'{}{}'`, ASLGraph.jsonPath("$.val"), ASLGraph.literalValue("someString"));
   * ```
   * =>
   * "States.format('{}{}', $.val, 'someString')"
   */
  export function intrinsicFunction(
    name: string,
    ...args: (
      | ASLGraph.JsonPath
      | ASLGraph.LiteralValue
      | ASLGraph.IntrinsicFunction
    )[]
  ): IntrinsicFunction {
    return { funcName: name, args };
  }

  /**
   * States.Format(template, ...args)
   *
   * @param template used to format the values. A bare string will be quoted.
   *                 `intrinsicFormat("{}", ASLGraph.jsonPath("$.a"))` => States.Format('{}', $.a)
   */
  export function intrinsicFormat(
    template: string | ASLGraph.JsonPath | ASLGraph.LiteralValue<string>,
    ...args: (
      | ASLGraph.IntrinsicFunction
      | ASLGraph.JsonPath
      | ASLGraph.LiteralValue
    )[]
  ) {
    return intrinsicFunction(
      "States.Format",
      typeof template === "string" ? ASLGraph.literalValue(template) : template,
      ...args
    );
  }

  /**
   * States.StringSplit(value, separator)
   *
   * @param value to split.
   * @param separator used to split the value.
   */
  export function intrinsicStringSplit(
    value:
      | ASLGraph.IntrinsicFunction
      | ASLGraph.JsonPath
      | ASLGraph.LiteralValue<string>,
    separator:
      | ASLGraph.IntrinsicFunction
      | (ASLGraph.JsonPath | ASLGraph.LiteralValue<string>)
  ) {
    return intrinsicFunction("States.StringSplit", value, separator);
  }

  /**
   * States.StringToJson(value)
   *
   * @param value to turn to json.
   */
  export function intrinsicStringToJson(
    value:
      | ASLGraph.IntrinsicFunction
      | ASLGraph.JsonPath
      | ASLGraph.LiteralValue<string>
  ) {
    return intrinsicFunction("States.StringToJson", value);
  }

  /**
   * States.JsonToString(value)
   *
   * @param value to turn to a string.
   */
  export function intrinsicJsonToString(
    value:
      | ASLGraph.IntrinsicFunction
      | ASLGraph.JsonPath
      | ASLGraph.LiteralValue
  ) {
    return intrinsicFunction("States.JsonToString", value);
  }

  /**
   * States.ArrayGet(arr, index)
   *
   * @param arr to access.
   * @param index position to access.
   */
  export function intrinsicArrayGetItem(
    arr: ASLGraph.IntrinsicFunction | ASLGraph.JsonPath,
    index: number | ASLGraph.JsonPath | ASLGraph.LiteralValue<number>
  ) {
    return intrinsicFunction(
      "States.ArrayGetItem",
      arr,
      typeof index === "number" ? ASLGraph.literalValue(index) : index
    );
  }

  /**
   * States.ArrayContains(arr, item)
   *
   * @param arr to access.
   * @param item to search for.
   */
  export function intrinsicArrayContains(
    arr: ASLGraph.IntrinsicFunction | ASLGraph.JsonPath,
    item: ASLGraph.IntrinsicFunction | ASLGraph.JsonPath | ASLGraph.LiteralValue
  ) {
    return intrinsicFunction("States.ArrayContains", arr, item);
  }

  /**
   * States.ArrayLength(arr, index)
   *
   * @param arr to get length of
   */
  export function intrinsicArrayLength(
    arr: ASLGraph.IntrinsicFunction | ASLGraph.JsonPath
  ) {
    return intrinsicFunction("States.ArrayLength", arr);
  }

  /**
   * States.ArrayRange(start, end, step)
   *
   * @param start inclusive start value of the output array
   * @param end inclusive end value of the output array
   * @param step increment to step between start and range
   */
  export function intrinsicArrayRange(
    start:
      | number
      | ASLGraph.IntrinsicFunction
      | ASLGraph.JsonPath
      | ASLGraph.LiteralValue<number>,
    end:
      | number
      | ASLGraph.IntrinsicFunction
      | ASLGraph.JsonPath
      | ASLGraph.LiteralValue<number>,
    step:
      | number
      | ASLGraph.IntrinsicFunction
      | ASLGraph.JsonPath
      | ASLGraph.LiteralValue<number>
  ) {
    return intrinsicFunction(
      "States.ArrayRange",
      typeof start === "number" ? ASLGraph.literalValue(start) : start,
      typeof end === "number" ? ASLGraph.literalValue(end) : end,
      typeof step === "number" ? ASLGraph.literalValue(step) : step
    );
  }

  /**
   * States.Array(start, end, step)
   *
   * @param items to put in the list
   */
  export function intrinsicArray(
    ...items: (
      | ASLGraph.IntrinsicFunction
      | ASLGraph.JsonPath
      | ASLGraph.LiteralValue<
          Exclude<ASLGraph.LiteralValueType, Record<string, any> | any[]>
        >
    )[]
  ) {
    return intrinsicFunction("States.Array", ...items);
  }

  /**
   * States.ArrayPartition(arr, size)
   */
  export function intrinsicArrayPartition(
    arr: ASLGraph.JsonPath,
    partitionSize: ASLGraph.JsonPath | ASLGraph.LiteralValue<number>
  ) {
    return intrinsicFunction("States.ArrayPartition", arr, partitionSize);
  }

  /**
   * States.ArrayUnique(arr)
   */
  export function intrinsicArrayUnique(arr: ASLGraph.JsonPath) {
    return intrinsicFunction("States.ArrayUnique", arr);
  }

  /**
   * States.JsonMerge(left, right, false)
   *
   * Shallowly merges two json objects together.
   */
  export function intrinsicJsonMerge(
    left: ASLGraph.JsonPath | ASLGraph.IntrinsicFunction,
    right: ASLGraph.JsonPath | ASLGraph.IntrinsicFunction
  ) {
    return intrinsicFunction(
      "States.JsonMerge",
      left,
      right,
      // deep merge - false
      ASLGraph.literalValue(false)
    );
  }

  /**
   * States.Base64Encode(data)
   */
  export function intrinsicBase64Encode(
    data:
      | ASLGraph.JsonPath
      | ASLGraph.IntrinsicFunction
      | ASLGraph.LiteralValue<string>
  ) {
    return intrinsicFunction("States.Base64Encode", data);
  }

  /**
   * States.Base64Decode(data)
   */
  export function intrinsicBase64Decode(
    data:
      | ASLGraph.JsonPath
      | ASLGraph.IntrinsicFunction
      | ASLGraph.LiteralValue<string>
  ) {
    return intrinsicFunction("States.Base64Decode", data);
  }

  export const HashAlgorithms = [
    "MD5",
    "SHA-1",
    "SHA-256",
    "SHA-384",
    "SHA-512",
  ] as const;

  /**
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-intrinsic-functions.html#asl-intrsc-func-hash-calc
   */
  export type HashAlgorithm = typeof HashAlgorithms[number];

  /**
   * States.Hash(data, algorithm)
   */
  export function intrinsicHash(
    data:
      | ASLGraph.JsonPath
      | ASLGraph.IntrinsicFunction
      | ASLGraph.LiteralValue<string>,
    algorithm:
      | ASLGraph.JsonPath
      | ASLGraph.IntrinsicFunction
      | ASLGraph.LiteralValue<HashAlgorithm>
  ) {
    return intrinsicFunction("States.Hash", data, algorithm);
  }

  /**
   * States.MathAdd(left, right)
   */
  export function intrinsicMathAdd(
    left:
      | number
      | ASLGraph.IntrinsicFunction
      | ASLGraph.JsonPath
      | ASLGraph.LiteralValue<number>,
    right:
      | number
      | ASLGraph.IntrinsicFunction
      | ASLGraph.JsonPath
      | ASLGraph.LiteralValue<number>
  ) {
    return intrinsicFunction(
      "States.MathAdd",
      typeof left === "number" ? ASLGraph.literalValue(left) : left,
      typeof right === "number" ? ASLGraph.literalValue(right) : right
    );
  }

  /**
   * States.MathRandom(start, end, seed)
   */
  export function intrinsicMathRandom(
    start:
      | ASLGraph.JsonPath
      | ASLGraph.IntrinsicFunction
      | ASLGraph.LiteralValue<number>,
    end:
      | ASLGraph.JsonPath
      | ASLGraph.IntrinsicFunction
      | ASLGraph.LiteralValue<number>,
    seed?:
      | ASLGraph.JsonPath
      | ASLGraph.IntrinsicFunction
      | ASLGraph.LiteralValue<number>
  ) {
    return intrinsicFunction(
      "States.MathRandom",
      start,
      end,
      ...(seed ? [seed] : [])
    );
  }

  /**
   * Escape special characters in Step Functions intrinsics.
   *
   * } => \}
   * { => \{
   * ' => \'
   *
   * https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-intrinsic-functions.html#amazon-states-language-intrinsic-functions-escapes
   */
  export function escapeFormatString(literal: ASLGraph.LiteralValue) {
    if (typeof literal.value === "string") {
      return literal.value.replace(/[\}\{\'}]/g, "\\$&");
    } else {
      return literal.value;
    }
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
