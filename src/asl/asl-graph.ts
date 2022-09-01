import { assertNever } from "../assert";
import { SynthError, ErrorCodes } from "../error-code";
import { FunctionlessNode } from "../node";
import { anyOf, invertBinaryOperator } from "../util";
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
  /**
   * Used by integrations as a placeholder for the "Next" property of a task.
   *
   * When task.Next is ASLGraph.DeferNext, Functionless will replace the Next with the appropriate value.
   * It may also add End or ResultPath based on the scenario.
   */
  export const DeferNext: string = "__DeferNext";

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
    states: { [stateName: string]: ASLGraph.NodeState | ASLGraph.SubState };
  }

  export const isStateOrSubState = anyOf(isState, ASLGraph.isSubState);

  /**
   * An {@link ASLGraph} interface which adds an optional {@link FunctionlessNode} to a state.
   *
   * The node is used to name the state.
   */
  export type NodeState<S extends State = State> = S & {
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

  /**
   * A literal value of type string, number, boolean, object, or null.
   *
   * If this is an Object, the object may contain nested JsonPaths as denoted by `containsJsonPath`.
   */
  export interface LiteralValue {
    /**
     * Whether there is json path in the constant.
     *
     * Helps determine where this constant can go for validation and
     * when false use Result in a Pass State instead of Parameters
     */
    containsJsonPath: boolean;
    value: string | number | null | boolean | Record<string, any> | any[];
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

  export function isLiteralValue(state: any): state is ASLGraph.LiteralValue {
    return "value" in state;
  }

  export function isJsonPath(state: any): state is ASLGraph.JsonPath {
    return "jsonPath" in state;
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
        }
      | {
          Next: string;
        },
    state: T
  ): T {
    const [End, Next] =
      "End" in props ? [props.End, undefined] : [undefined, props.Next];

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
      } as T;
    } else if (isPassState(state)) {
      return {
        ...state,
        End: state.Next === ASLGraph.DeferNext ? End : state.End,
        Next: state.Next === ASLGraph.DeferNext ? Next : state.Next,
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
    ) => Record<string, string>
  ): States {
    const namedStates = internal(startState, states, { localNames: {} });

    /**
     * Find any choice states that can be joined with their target state.
     * TODO: generalize the optimization statements.
     */
    const updatedStates = joinChainedChoices(
      startState,
      /**
       * Remove any states with no effect (Pass, generally)
       * The incoming states to the empty states are re-wired to the outgoing transition of the empty state.
       */
      removeEmptyStates(startState, namedStates)
    );

    const reachableStates = findReachableStates(startState, updatedStates);

    // only take the reachable states
    return Object.fromEntries(
      Object.entries(updatedStates).filter(([name]) =>
        reachableStates.has(name)
      )
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
   * Given a directed adjacency matrix, return a `Set` of all reachable states from the start state.
   */
  function findReachableStates(
    startState: string,
    states: Record<string, State>
  ) {
    const visited = new Set<string>();

    // starting from the start state, find all reachable states
    depthFirst(startState);

    return visited;

    function depthFirst(stateName: string) {
      if (visited.has(stateName)) return;
      visited.add(stateName);
      const state = states[stateName]!;
      visitTransition(state, depthFirst);
    }
  }

  function removeEmptyStates(
    startState: string,
    stateEntries: [string, State][]
  ): [string, State][] {
    /**
     * Find all {@link Pass} states that do not do anything.
     */
    const emptyStates = Object.fromEntries(
      stateEntries.filter((entry): entry is [string, Pass] => {
        const [name, state] = entry;
        return (
          name !== startState &&
          isPassState(state) &&
          !!state.Next &&
          !(
            state.End ||
            state.InputPath ||
            state.OutputPath ||
            state.Parameters ||
            state.Result ||
            state.ResultPath
          )
        );
      })
    );

    const emptyTransitions = computeEmptyStateToUpdatedTransition(emptyStates);

    // return the updated set of name to state.
    return stateEntries.flatMap(([name, state]) => {
      if (name in emptyTransitions) {
        return [];
      }

      return [
        [
          name,
          visitTransition(state, (transition) =>
            transition in emptyTransitions
              ? emptyTransitions[transition]!
              : transition
          ),
        ],
      ];
    });

    /**
     * Find the updated next value for all of the empty states.
     * If the updated Next cannot be determined, do not remove the state.
     */
    function computeEmptyStateToUpdatedTransition(
      emptyStates: Record<string, Pass>
    ) {
      return Object.fromEntries(
        Object.entries(emptyStates).flatMap(([name, { Next }]) => {
          const newNext = Next ? getNext(Next, []) : Next;

          /**
           * If the updated Next value for this state cannot be determined,
           * do not remove the state.
           *
           * This can because the state has no Next value (Functionless bug)
           * or because all of the states in a cycle are empty.
           */
          if (!newNext) {
            return [];
          }

          return [[name, newNext]];

          /**
           * When all states in a cycle are empty, the cycle will be impossible to exit.
           *
           * Note: This should be a rare case and is not an attempt to find any non-terminating logic.
           *       ex: `for(;;){}`
           *       Adding most conditions, incrementors, or bodies will not run into this issue.
           *
           * ```ts
           * {
           *   1: { Type: "???", Next: 2 },
           *   2: { Type: "Pass", Next: 3 },
           *   3: { Type: "Pass", Next: 4 },
           *   4: { Type: "Pass", Next: 2 }
           * }
           * ```
           *
           * State 1 is any state that transitions to state 2.
           * State 2 transitions to empty state 3
           * State 3 transitions to empty state 4
           * State 4 transitions back to empty state 2.
           *
           * Empty Pass states provide no value and will be removed.
           * Empty Pass states can never fail and no factor can change where it goes.
           *
           * This is not an issue for other states which may fail or inject other logic to change the next state.
           * Even the Wait stat could be used in an infinite loop if the machine is terminated from external source.
           *
           * If this happens, return undefined.
           */
          function getNext(
            transition: string,
            seen: string[] = []
          ): string | undefined {
            if (seen?.includes(transition)) {
              return undefined;
            }
            return transition in emptyStates
              ? getNext(
                  emptyStates[transition]!.Next!,
                  seen ? [...seen, transition] : [transition]
                )
              : transition;
          }
        })
      );
    }
  }

  /**
   * A {@link Choice} state that points to another {@link Choice} state can adopt the target state's
   * choices and Next without adding an additional transition.
   *
   * 1
   *    if a -> 2
   *    if b -> 3
   *    else -> 4
   * 2
   *    if c -> 3
   *    else -> 4
   * 3       - Task
   * 4
   *    if e -> 5
   *    else -> 6
   * 5       - Task
   * 6       - Task
   *
   * =>
   *
   * 1
   *    if a && c -> 3 (1 and 2)
   *    if a && e -> 5 (1 and 4)
   *    if b      -> 3
   *    if e      -> 5 (4)
   *    else      -> 6 (4's else)
   * 2            - remove (if nothing else points to it)
   * 3            - Task
   * 4            - remove (if nothing else points to it)
   * 5            - Task
   * 6            - Task
   */
  function joinChainedChoices(
    startState: string,
    stateEntries: [string, State][]
  ) {
    const stateMap = Object.fromEntries(stateEntries);

    const updatedStates: Record<string, State | null> = {};

    depthFirst(startState);

    // we can assume that all null states have been updated by here.
    return updatedStates as Record<string, State>;

    function depthFirst(state: string): State | null {
      if (state in updatedStates) return updatedStates[state]!;
      const stateObj = stateMap[state]!;
      if (!isChoiceState(stateObj)) {
        updatedStates[state] = stateObj;
        visitTransition(stateObj, (next) => {
          depthFirst(next);
        });
        // no change
        return stateObj;
      }
      // set self to null to 1) halt circular references 2) avoid circular merges between choices.
      // if #2 happens, that choice will always fail as state cannot change between transitions.
      updatedStates[state] = null;
      const branches = stateObj.Choices.flatMap((branch) => {
        const { Next: branchNext, ...branchCondition } = branch;
        const nextState = depthFirst(branchNext);
        // next state should only by null when there is a circular reference between choices
        if (!nextState || !isChoiceState(nextState)) {
          return [branch];
        } else {
          const nextBranches = nextState.Choices.map(
            ({ Next, ...condition }) => {
              // for each branch in the next state, AND with the current branch and assign the next state's Next.
              return { ...ASL.and(branchCondition, condition), Next };
            }
          );
          return nextState.Default
            ? [...nextBranches, { ...branchCondition, Next: nextState.Default }]
            : nextBranches;
        }
      });
      const defaultState = stateObj.Default
        ? depthFirst(stateObj.Default)
        : undefined;

      const [defaultValue, defaultBranches] =
        !defaultState || !isChoiceState(defaultState)
          ? [stateObj.Default, []]
          : [defaultState.Default, defaultState.Choices];

      const mergedChoice = {
        ...stateObj,
        Choices: [...branches, ...defaultBranches],
        Default: defaultValue,
      };

      updatedStates[state] = mergedChoice;
      return mergedChoice;
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
    pass: Omit<NodeState<Pass>, "Parameters" | "InputPath" | "Result"> &
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
            Parameters: value.value,
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
            Parameters: value.value,
          }),
    };
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
          rightOutput.value !== null &&
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
    element: string | number,
    targetJsonPath: ASLGraph.JsonPath
  ): Condition {
    const accessed = ASLGraph.accessConstant(targetJsonPath, element, true);

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
    field: string | number,
    element: boolean
  ): ASLGraph.JsonPath | ASLGraph.LiteralValue {
    if (ASLGraph.isJsonPath(value)) {
      return typeof field === "number"
        ? { jsonPath: `${value.jsonPath}[${field}]` }
        : element
        ? { jsonPath: `${value.jsonPath}['${field}']` }
        : { jsonPath: `${value.jsonPath}.${field}` };
    }

    if (ASLGraph.isLiteralValue(value) && value.value) {
      const accessedValue = (() => {
        if (Array.isArray(value.value)) {
          if (typeof field === "number") {
            return value.value[field];
          }
          throw new SynthError(
            ErrorCodes.StepFunctions_Invalid_collection_access,
            "Accessor to an array must be a constant number"
          );
        } else if (typeof value.value === "object") {
          return value.value[field];
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
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
