import { assertNever } from "../assert";
import {
  anyOf,
  jsonPathStartsWith,
  normalizeJsonPath,
  formatJsonPath,
  replaceJsonPathPrefix,
  escapeRegExp,
} from "../util";
import {
  States,
  isPassState,
  isTaskState,
  isMapTaskState,
  isParallelTaskState,
  isChoiceState,
  isFailState,
  isSucceedState,
  isWaitState,
  Catch,
  State,
  Parameters,
  Condition,
  Pass,
} from "./states";
import { ASL, visitTransition } from "./synth";

/**
 * Operations that can help "optimize" an ASL state machine.
 */
export namespace ASLOptimizer {
  /**
   * Traverses the graph and removes any nodes unreachable from the start state.
   */
  export function removeUnreachableStates(
    startState: string,
    states: States
  ): States {
    const reachableStates = findReachableStates(startState, states);

    // only take the reachable states
    return Object.fromEntries(
      Object.entries(states).filter(([name]) => reachableStates.has(name))
    );
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
      if (visited.has(stateName)) {
        return;
      }
      visited.add(stateName);
      const state = states[stateName]!;
      visitTransition(state, depthFirst);
    }
  }

  /**
   * Find all {@link Pass} states that do not do anything.
   */
  function findEmptyStates(startState: string, states: States): string[] {
    return Object.entries(states)
      .filter((entry): entry is [string, Pass] => {
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
      .map(([name]) => name);
  }

  /**
   * A variable is assigned from one to another
   */
  interface Assignment {
    kind: "Assignment";
    from: string;
    to: string;
  }

  function isAssignment(usage: VariableUsage): usage is Assignment {
    return usage.kind === "Assignment";
  }

  /**
   * A variable is assigned to a property in a map.
   */
  interface PropertyAssignment {
    kind: "PropAssignment";
    from: string;
    to: string;
    props: string[];
  }

  function isPropertyAssignment(
    usage: VariableUsage
  ): usage is PropertyAssignment {
    return usage.kind === "PropAssignment";
  }

  /**
   * When a variable is used in an intrinsic function.
   * Similar to {@link Assignment},
   * but highlights that this is not a 1:1 assignment.
   *
   * {
   *    "Parameters": {
   *       "string.$": "States.Array($.var1)"
   *    },
   *    ResultPath: "$.var2"
   * }
   * =>
   * from: "$.var1"
   * to: "$.var2"
   */
  interface IntrinsicUsage {
    kind: "Intrinsic";
    from: string;
    props: string[];
    to: string;
  }

  function isIntrinsicUsage(usage: VariableUsage): usage is IntrinsicUsage {
    return usage.kind === "Intrinsic";
  }

  /**
   * Variables found in a json path filter.
   */
  interface FilterUsage {
    kind: "Filter";
    from: string;
    to: string;
  }

  function isFilterUsage(usage: VariableUsage): usage is FilterUsage {
    return usage.kind === "Filter";
  }

  /**
   * Variables found in a json path filter in a parameters object.
   */
  interface FilterPropAssignment {
    kind: "FilterPropAssignment";
    from: string;
    props: string[];
    to: string;
  }

  function isFilterPropAssignment(
    usage: VariableUsage
  ): usage is FilterPropAssignment {
    return usage.kind === "FilterPropAssignment";
  }

  /**
   * A variable is the output of a opaque state.
   *
   * For example, the output of a task that invoked a lambda function.
   */
  interface StateOutput {
    kind: "StateOutput";
    stateType: "Map" | "Parallel" | "Catch" | "Task";
    to: string;
  }

  function isStateOutput(usage: VariableUsage): usage is StateOutput {
    return usage.kind === "StateOutput";
  }

  /**
   * When a variable is used to return from a sub-graph;
   *
   * ```ts
   * return heap0;
   * ```
   */
  interface ReturnUsage {
    kind: "ReturnUsage";
    from: string;
  }

  function isReturnUsage(usage: VariableUsage): usage is ReturnUsage {
    return usage.kind === "ReturnUsage";
  }

  /**
   * A input path is the input to an opaque state.
   *
   * For example, an input to a Task which invokes a lambda function.
   */
  interface StateInput {
    kind: "StateInput";
    stateType: "Map" | "Task";
    from: string;
  }

  function isStateInput(usage: VariableUsage): usage is StateInput {
    return usage.kind === "StateInput";
  }

  /**
   * A input path is the input to an opaque state.
   *
   * For example, an input to a Task which invokes a lambda function.
   */
  interface StateInputProps {
    kind: "StateInputProps";
    stateType: "Map" | "Task" | "Parallel";
    from: string;
    props: string[];
  }

  function isStateInputProps(usage: VariableUsage): usage is StateInputProps {
    return usage.kind === "StateInputProps";
  }

  /**
   * When a variable is set using a constant value.
   */
  interface LiteralAssignment {
    kind: "LiteralAssignment";
    value: Parameters;
    to: string;
  }

  function isLiteralAssignment(
    usage: VariableUsage
  ): usage is LiteralAssignment {
    return usage.kind === "LiteralAssignment";
  }

  interface LiteralPropAssignment {
    kind: "LiteralPropAssignment";
    value: Parameters;
    to: string;
    props: string[];
  }

  function isLiteralPropAssignment(
    usage: VariableUsage
  ): usage is LiteralPropAssignment {
    return usage.kind === "LiteralPropAssignment";
  }

  /**
   * When a variable is used in a conditional statement.
   */
  interface ConditionUsage {
    kind: "Condition";
    from: string;
  }

  function isConditionUsage(usage: VariableUsage): usage is ConditionUsage {
    return usage.kind === "Condition";
  }

  type VariableUsage =
    | Assignment
    | PropertyAssignment
    | LiteralAssignment
    | LiteralPropAssignment
    | ConditionUsage
    | IntrinsicUsage
    | FilterUsage
    | FilterPropAssignment
    | StateOutput
    | StateInput
    | StateInputProps
    | ReturnUsage;

  type StateVariableUsage = VariableUsage & {
    state: string;
  };

  interface VariableStats {
    variable: string;
    assigns: {
      id: number;
      index: number;
      usage: StateVariableUsage;
    }[];
    usage: {
      id: number;
      index: number;
      usage: StateVariableUsage;
    }[];
  }

  const isVariableAssignment = anyOf(
    isAssignment,
    isLiteralPropAssignment,
    isLiteralAssignment,
    isStateOutput,
    isIntrinsicUsage,
    isFilterUsage,
    isFilterPropAssignment
  );

  function isAssignmentTo(variable: string, usage: VariableUsage) {
    return (
      isVariableAssignment(usage) && jsonPathStartsWith(usage.to, variable)
    );
  }

  const isVariableUsage = anyOf(
    isAssignment,
    isIntrinsicUsage,
    isStateInput,
    isStateInputProps,
    isConditionUsage,
    isPropertyAssignment,
    isFilterUsage,
    isFilterPropAssignment,
    isReturnUsage
  );

  function isUsageOf(variable: string, usage: VariableUsage) {
    return isVariableUsage(usage) && jsonPathStartsWith(usage.from, variable);
  }

  function analyzeVariables(
    startState: string,
    states: States
  ): {
    variableUsages: StateVariableUsage[];
    variableNames: string[];
    stats: VariableStats[];
  } {
    const variableUsages: StateVariableUsage[] = [];
    const variableNames = new Set<string>();
    const visited = new Set<string>();

    const topo = topoSort(startState, states);

    depthFirst(startState);

    const variableNamesArray = [...variableNames];
    // grab all of the variable prefixes.
    const variableNamePrefixes = [
      ...new Set(
        variableNamesArray
          // ignore the root `$`
          .filter((v) => v !== "$")
          .map((v) => normalizeJsonPath(v)[0]!)
          .map((v) => formatJsonPath([v]))
      ),
    ];

    const variableUsageWithId = variableUsages.map((u, i) => ({
      id: i,
      index: topo.findIndex((t) => t[0] === u.state),
      usage: u,
    }));

    const stats = variableNamePrefixes.map((v) => ({
      variable: v,
      assigns: variableUsageWithId.filter(({ usage }) =>
        isAssignmentTo(v, usage)
      ),
      usage: variableUsageWithId.filter(({ usage }) => isUsageOf(v, usage)),
    }));

    return { variableUsages, variableNames: [...variableNames], stats };

    function depthFirst(stateName: string) {
      if (visited.has(stateName)) return;
      visited.add(stateName);
      const state = states[stateName]!;
      variableUsages.push(
        ...getVariableUsage(state).map((usage) => ({
          ...usage,
          state: stateName,
        }))
      );
      const names = getVariableNamesFromState(state);
      names.forEach((n) => variableNames.add(n));
      visitTransition(state, depthFirst);
    }
  }

  function getVariableUsage(state: State): VariableUsage[] {
    const usages: VariableUsage[] = (() => {
      if (isPassState(state)) {
        if (state.ResultPath) {
          if (state.Result !== undefined) {
            return [
              {
                kind: "LiteralAssignment",
                to: state.ResultPath,
                value: state.Result,
              },
            ];
          } else if (state.InputPath) {
            if (
              state.InputPath.includes("?(") ||
              state.InputPath.includes(":")
            ) {
              return extractVariableReferences(state.InputPath).map((v) => ({
                kind: "Filter",
                from: v,
                to: state.ResultPath as string,
              }));
            }
            return [
              {
                kind: "Assignment",
                from: state.InputPath,
                to: state.ResultPath,
              },
            ];
          } else if (state.Parameters) {
            return parametersAssignment(
              state.Parameters,
              false,
              state.ResultPath
            );
          }
        }
        return [];
      } else if (isTaskState(state)) {
        return [
          ...(state.InputPath
            ? [
                {
                  kind: "StateInput" as const,
                  stateType: "Task" as const,
                  from: state.InputPath,
                },
              ]
            : []),
          ...(state.ResultPath
            ? [
                {
                  kind: "StateOutput" as const,
                  stateType: "Task" as const,
                  to: state.ResultPath,
                },
              ]
            : []),
          ...(state.Parameters
            ? parametersAssignment(state.Parameters, false, "[[task]]")
            : []),
          ...catchAssignment(state.Catch),
        ];
      } else if (isMapTaskState(state)) {
        if (state.ResultPath) {
          return [
            { kind: "StateOutput", stateType: "Map", to: state.ResultPath },
            ...catchAssignment(state.Catch),
            ...(state.Parameters
              ? parametersAssignment(state.Parameters, false, "[[map]]")
              : []),
            ...(state.ItemsPath
              ? [
                  {
                    kind: "StateInput" as const,
                    stateType: "Map" as const,
                    from: state.ItemsPath,
                  },
                ]
              : []),
          ];
        }
        return [];
      } else if (isParallelTaskState(state)) {
        if (state.ResultPath) {
          return [
            {
              kind: "StateOutput",
              stateType: "Parallel",
              to: state.ResultPath,
            },
            ...catchAssignment(state.Catch),
            ...(state.Parameters
              ? parametersAssignment(state.Parameters, false, "[[parallel]]")
              : []),
          ];
        }
        return [];
      } else if (isChoiceState(state)) {
        const vars = state.Choices.flatMap(choiceUsage);
        return [...new Set(vars)].map((v) => ({
          kind: "Condition",
          from: v,
        }));
      } else if (
        isFailState(state) ||
        isSucceedState(state) ||
        isWaitState(state)
      ) {
        return [];
      }
      return assertNever(state);
    })();

    if (
      "End" in state &&
      state.End &&
      "ResultPath" in state &&
      state.ResultPath
    ) {
      return [
        ...usages,
        {
          kind: "ReturnUsage" as const,
          from: state.ResultPath,
        },
      ];
    }
    return usages;

    function choiceUsage(condition: Condition): string[] {
      const vars = new Set<string>();
      for (const key in condition) {
        if (key === "Variable") {
          vars.add(condition.Variable!);
        } else if (key === "And" || key === "Or") {
          const conds = (condition.And! ?? condition.Or!) as Condition[];
          conds.flatMap(choiceUsage).map((v) => vars.add(v));
        } else if (key === "Not") {
          return choiceUsage(condition.Not!);
        } else if (key.endsWith("Path")) {
          // @ts-ignore
          vars.add(condition[key]!);
        }
      }
      return [...vars];
    }

    function catchAssignment(_catch?: Catch[]): StateOutput[] {
      return _catch
        ? _catch
            .filter(
              (_catch): _catch is Catch & { ResultPath: string } =>
                !!_catch.ResultPath
            )
            .map(({ ResultPath }) => ({
              kind: "StateOutput",
              stateType: "Catch",
              to: ResultPath,
            }))
        : [];
    }

    /**
     * {
     *  Parameters: {
     *     "a.$": "$.value"
     *  },
     *  ResultPath: "$.out"
     * }
     * =>
     * ["$.value", "$.out.a"]
     */
    function parametersAssignment(
      parameters: Parameters,
      containsJsonPath: boolean,
      resultPath: string | "[[task]]" | "[[map]]" | "[[parallel]]",
      _props?: string[]
    ): (
      | PropertyAssignment
      | LiteralPropAssignment
      | IntrinsicUsage
      | FilterPropAssignment
      | StateInputProps
    )[] {
      const props: string[] = _props ?? [];
      if (!parameters) {
        return [];
      }
      if (typeof parameters === "object") {
        if (Array.isArray(parameters)) {
          return [
            {
              kind: "LiteralPropAssignment",
              to: resultPath,
              value: parameters,
              props,
            },
          ];
        } else {
          return Object.entries(parameters).flatMap(([key, param]) => {
            const jsonPath = key.endsWith(".$");
            return parametersAssignment(param, jsonPath, resultPath, [
              ...props,
              jsonPath ? key.substring(0, key.length - 2) : key,
            ]);
          });
        }
      }
      if (!containsJsonPath) {
        // don't need to return anything for literal state inputs.
        if (
          resultPath === "[[task]]" ||
          resultPath === "[[map]]" ||
          resultPath === "[[parallel]]"
        ) {
          return [];
        }
        return [
          {
            kind: "LiteralPropAssignment",
            to: resultPath,
            value: parameters,
            props,
          },
        ];
      }
      if (typeof parameters === "string") {
        if (parameters.startsWith("States.")) {
          return extractVariableReferences(parameters).map((x) => ({
            kind: "Intrinsic",
            from: x,
            to: resultPath,
            props,
          }));
        } else if (parameters.includes("?(") || parameters.includes(":")) {
          return extractVariableReferences(parameters).map((x) => ({
            kind: "FilterPropAssignment",
            from: x,
            to: resultPath,
            props,
          }));
        }
      }
      // if the value is json path, it will not be a boolean or string
      return [
        resultPath === "[[task]]" ||
        resultPath === "[[map]]" ||
        resultPath === "[[parallel]]"
          ? {
              kind: "StateInputProps",
              from: parameters as string,
              props,
              stateType:
                resultPath === "[[task]]"
                  ? "Task"
                  : resultPath === "[[parallel]]"
                  ? "Parallel"
                  : "Map",
            }
          : {
              kind: "PropAssignment",
              from: parameters as string,
              to: resultPath,
              props,
            },
      ];
    }

    /**
     * Pull variable references out of intrinsic functions and json path filters.
     *
     * States.Array($.var) => $.var
     * $.arr[?(['value'] == $.var)] => $.arr, $.var
     */
    function extractVariableReferences(jsonPath: string) {
      return jsonPath.match(/(\$\.?[^,)]+)+/g) ?? [];
    }
  }

  function getVariableNamesFromState(state: State): string[] {
    const names = ((state) => {
      if (
        isTaskState(state) ||
        isMapTaskState(state) ||
        isParallelTaskState(state)
      ) {
        return [
          state.ResultPath,
          ...(state.Catch?.map((c) => c.ResultPath) ?? []),
        ];
      } else if (isPassState(state)) {
        return [state.ResultPath];
      } else if (
        isSucceedState(state) ||
        isFailState(state) ||
        isChoiceState(state) ||
        isWaitState(state)
      ) {
        return [];
      }
      return assertNever(state);
    })(state);

    return names.filter((n): n is string => !!n);
  }

  export const DefaultOptimizeOptions: OptimizeOptions = {
    optimizeVariableAssignments: true,
    removeUnreachableStates: true,
    joinConsecutiveChoices: true,
    removeNoOpStates: true,
  };

  export interface OptimizeOptions {
    /**
     * Attempts to collapse assignments that provide no functional value.
     *
     * Collapses assignments created by the interpreter and the input source.
     *
     * ```ts
     * const a = "a"
     * const b = a;
     * =>
     * const b = "a"
     * ```
     */
    optimizeVariableAssignments: boolean;
    /**
     * Traverses the graph transitions and removes any states that cannot be reached.
     * Unreachable states will fail on deployment to AWS Step Functions.
     *
     * Note: If this optimization is turned off, it is likely the output ASL will fail.
     *       Functionless creates some unreachable that this logic is expected to remove.
     *       Only turn this off if you intend to preform similar logic or use the ASL for another
     *       purpose than AWS Step Functions.
     */
    removeUnreachableStates: boolean;
    /**
     * When {@link Choice} states are chained together, they can be simplified by merging the branches together.
     *
     * ```ts
     * if(a) {
     *   if(b) {
     *   } else {
     *   }
     * }
     *
     * =>
     *
     * ```ts
     * if(a && b) {}
     * else(a) {}
     * ```
     *
     * In ASL this may remove unnecessary state transitions without any impact on the logic.
     *
     * Note: This could make the ASL itself larger when the same Choice is merged into multiple calling choices.
     *       Turn off at the cost of adding more state transitions.
     */
    joinConsecutiveChoices: boolean;
    /**
     * The Functionless transpiler and sometimes user can can create states that don't do anything.
     *
     * Functionless does this to make the transpilation logic simpler by adding empty, targetable named nodes.
     *
     * This optimization flag finds all {@link Pass} states that do nothing but transition to another state and removes it from the graph.
     *
     * The previous and next states are then wired together with no impact on the logic.
     */
    removeNoOpStates: boolean;
  }

  export function optimizeGraph(
    startState: string,
    states: States,
    _options?: Partial<OptimizeOptions>
  ): States {
    const options = {
      ...DefaultOptimizeOptions,
      ..._options,
    };

    const reducedGraph = reduceGraph(startState, states, options);

    // finally run remove unreachable states (when enabled) to ensure any isolated sub-graphs are removed.
    return options.removeUnreachableStates
      ? removeUnreachableStates(startState, reducedGraph)
      : reducedGraph;
  }

  /**
   * Run optimizations that reduce the number of states in the graph
   */
  function reduceGraph(
    startState: string,
    states: States,
    options: OptimizeOptions
  ): States {
    const collapsedStates = options.joinConsecutiveChoices
      ? joinChainedChoices(startState, states)
      : states;

    const [unusedAssignmentStates, updatedStates] =
      options.optimizeVariableAssignments
        ? optimizeVariableAssignment(startState, collapsedStates)
        : [[], collapsedStates];

    const noOpStates = options.removeNoOpStates
      ? findEmptyStates(startState, updatedStates)
      : [];

    const removedStates = [...noOpStates, ...unusedAssignmentStates];

    const removedTransitions = computeRemovedStateToUpdatedTransition(
      new Set(removedStates),
      updatedStates
    );

    // return the updated set of name to state.
    return Object.fromEntries(
      Object.entries(updatedStates).flatMap(([name, state]) => {
        if (name in removedTransitions) {
          return [];
        }

        return [
          [
            name,
            visitTransition(state, (transition) =>
              transition in removedTransitions
                ? removedTransitions[transition]!
                : transition
            ),
          ],
        ];
      })
    );

    /**
     * Find the updated next value for all of the empty states.
     * If the updated Next cannot be determined, do not remove the state.
     */
    function computeRemovedStateToUpdatedTransition(
      removedStates: Set<string>,
      states: States
    ) {
      return Object.fromEntries(
        [...removedStates]
          // assume removed states have Next for now
          .map((s): [string, State & Pick<Pass, "Next">] => [
            s,
            states[s]! as State & Pick<Pass, "Next">,
          ])
          .flatMap(([name, { Next }]) => {
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
              return removedStates.has(transition)
                ? getNext(
                    // assuming the removes states have Next
                    (states[transition]! as State & Pick<Pass, "Next">).Next!,
                    seen ? [...seen, transition] : [transition]
                  )
                : transition;
            }
          })
      );
    }
  }

  /**
   * Attempts to re-write and collapse variable usage and assignments are unnecessary.
   *
   * @returns states with assignments that are unused, updates graph states (with the unused ones)
   */
  function optimizeVariableAssignment(
    startState: string,
    states: States
  ): [string[], States] {
    const { stats } = analyzeVariables(startState, states);

    // sort the stats by the location of the first assignment.
    const sortStats = stats.sort((first, second) => {
      return firstAssignIndex(first) - firstAssignIndex(second);

      function firstAssignIndex(stats: VariableStats) {
        return stats.assigns.length === 0
          ? 0
          : Math.min(...stats.assigns.map((s) => s.index));
      }
    });

    const [statsMap, updatedStates] = sortStats.reduce(
      ([statsMap, states], sourceVariable) => {
        return (
          tryRemoveVariable(
            statsMap[sourceVariable.variable]!,
            statsMap,
            states
          ) ?? [statsMap, states]
        );
      },
      [Object.fromEntries(stats.map((s) => [s.variable, s])), states]
    );

    const unusedAssignments = Object.values(statsMap).filter(
      (s) => s.usage.length === 0
    );

    const unusedAssignmentStates = unusedAssignments.flatMap((u) =>
      u.assigns.flatMap((a) => {
        if (isStateOutput(a.usage) || a.usage.state === startState) {
          // state outputs should not be removed as they can still have effects.
          // Also do not remove the start states of sub-graphs.
          // Instead we will update their result path to be null
          // @ts-ignore
          updatedStates[a.usage.state] = {
            ...updatedStates[a.usage.state],
            ResultPath: null,
          };
          return [];
        }
        return [a.usage.state];
      })
    );

    return [unusedAssignmentStates, updatedStates];
  }

  /**
   * Given a variable name, attempt to remove it from the graph by updating its usage(s)
   * without changing the behavior of the graph.
   *
   * @return - the updated graph states and variable states after removing the variable or nothing if there was no change.
   */
  function tryRemoveVariable(
    sourceVariable: VariableStats,
    statsMap: Record<string, VariableStats>,
    states: States
  ): [Record<string, VariableStats>, States] | undefined {
    /**
     * The source assignment is the location at which the current variable is assigned a value.
     *
     * ```ts
     * const b = a; // source <--
     * const c = b; // target
     * ```
     *
     * For now, all optimization only support a single assignment of the target variable.
     *
     * Also only support for simple source assignment.
     *
     * ```ts
     * const b = "a"; // LiteralAssignment
     * const c = b; // Assignment
     *
     * ```
     *
     */
    const [sourceAssign, ...otherAssign] = sourceVariable.assigns ?? [];
    if (
      otherAssign.length > 0 ||
      !sourceAssign ||
      !(
        isAssignment(sourceAssign.usage) ||
        isLiteralAssignment(sourceAssign.usage)
      )
    ) {
      return;
    }

    /**
     * For now, all optimizations only support a single usage of the current variable.
     *
     * The target usage is the point at which the current variable is assigned to another variable.
     *
     * ```ts
     * const b = a; // source
     * const c = b; // target <--
     * ```
     */
    const [targetUsage, ...otherUsages] = sourceVariable.usage ?? [];
    if (otherUsages.length > 0 || !targetUsage) {
      // only update variables with a single assignment
      return;
    }

    /**
     * The state at the {@link targetUsage} which we will try to update.
     */
    const state = states[targetUsage.usage.state]!;

    /**
     * Assignment of a literal or variable to another variable.
     *
     * ```ts
     * const a = "a" // source - literal
     * const b = a; // target - assignment
     * // =>
     * const b = "a";
     * ```
     *
     * ```ts
     * const a = x; // source - literal
     * const b = a; // target - assignment
     * // =>
     * const b = x;
     * ```
     */
    if (isAssignment(targetUsage.usage)) {
      if (!isPassState(state)) {
        return;
      }

      if (isLiteralAssignment(sourceAssign.usage)) {
        const value = accessLiteralAtJsonPathSuffix(
          targetUsage.usage.from,
          sourceAssign.usage.to,
          sourceAssign.usage.value
        );

        return [
          updateVariableUsage(targetUsage, {
            ...targetUsage.usage,
            kind: "LiteralAssignment",
            value,
          }),
          {
            ...states,
            [targetUsage.usage.state]: {
              ...state,
              Result: undefined,
              InputPath: undefined,
              Parameters: value,
            },
          },
        ];
      } else {
        /**
         * if the "from" variable we intend to update the prop assignment with will be
         *  assigned to after the source assignment and before the target assignment, skip.
         */
        if (
          isMutatedInRange(
            sourceAssign.usage.from,
            sourceAssign.index,
            targetUsage.index
          )
        ) {
          return;
        }

        const updatedFrom = replaceJsonPathPrefix(
          targetUsage.usage.from,
          sourceAssign.usage.to,
          sourceAssign.usage.from
        );

        return [
          /**
           * Update the target's stats to contain the new assign and remove the old one.
           */
          updateVariableUsage(targetUsage, {
            ...targetUsage.usage,
            from: updatedFrom,
          }),
          {
            ...states,
            [targetUsage.usage.state]: {
              ...state,
              Parameters: undefined,
              Result: undefined,
              /**
               * Search assignment to value should be a prefix of the old `usage.from`.
               * Maintain the tail of the `usage.from`, but replace the prefix with `sourceAssign.usage.from`
               * Value: $.source[0]
               * Search Value: $.source
               * Replace Value: $.from
               * => $.from[0]
               */
              InputPath: updatedFrom,
            },
          },
        ];
      }
      return;
    } else if (
      isPropertyAssignment(targetUsage.usage) ||
      isStateInputProps(targetUsage.usage)
    ) {
      /**
       * Assignment of a literal or variable to property on a pass, task, map, or parallel state.
       *
       * ```ts
       * const a = "a" // source - literal
       * const b = {
       *   c: a // target - prop assignment
       * };
       * // =>
       * const b = {
       *    c: "a"
       * };
       * ```
       *
       * ```ts
       * const a = x; // source - literal
       * const b = {
       *    c: // target - prop assignment
       * };
       * // =>
       * const b = {
       *    c: x
       * };
       * ```
       */
      if (
        !(
          isPassState(state) ||
          isParallelTaskState(state) ||
          isMapTaskState(state) ||
          isTaskState(state)
        ) ||
        !state.Parameters ||
        typeof state.Parameters !== "object" ||
        Array.isArray(state.Parameters)
      ) {
        return;
      }

      if (isLiteralAssignment(sourceAssign.usage)) {
        const value = accessLiteralAtJsonPathSuffix(
          targetUsage.usage.from,
          sourceAssign.usage.to,
          sourceAssign.usage.value
        );

        return [
          updateVariableUsage(
            targetUsage,
            isPropertyAssignment(targetUsage.usage)
              ? {
                  ...targetUsage.usage,
                  kind: "LiteralPropAssignment",
                  value,
                }
              : undefined
          ),
          {
            ...states,
            [targetUsage.usage.state]: {
              ...state,
              Parameters: updateParameters(
                targetUsage.usage.props,
                state.Parameters!,
                value,
                false
              ),
            },
          },
        ];
      } else {
        /**
         * if the "from" variable we intend to update the prop assignment with will be
         * assigned to after the source assignment and before the target assignment, skip.
         */
        if (
          isMutatedInRange(
            sourceAssign.usage.from,
            sourceAssign.index,
            targetUsage.index
          )
        ) {
          return;
        }

        /**
         * Search assignment to value should be a prefix of the old `usage.from`.
         * Maintain the tail of the `usage.from`, but replace the prefix with `sourceAssign.usage.from`
         * Value: $.source[0]
         * Search Value: $.source
         * Replace Value: $.from
         * => $.from[0]
         */
        const updatedFrom = replaceJsonPathPrefix(
          targetUsage.usage.from,
          sourceAssign.usage.to,
          sourceAssign.usage.from
        );

        return [
          updateVariableUsage(targetUsage, {
            ...targetUsage.usage,
            from: updatedFrom,
          }),
          // update the state's parameter to contain the new input variable.
          {
            ...states,
            [targetUsage.usage.state]: {
              ...state,
              Parameters: updateParameters(
                targetUsage.usage.props,
                state.Parameters!,
                updatedFrom,
                true
              ),
            },
          },
        ];
      }
      return;
    } else if (isIntrinsicUsage(targetUsage.usage)) {
      /**
       * Use of a literal or variable to property in an intrinsic function.
       * Note: intrinsic properties must be in Parameter objects.
       *
       * ```ts
       * const a = "a" // source - literal
       * const b = {
       *   c: `format ${a}` // target - intrinsic
       * };
       * // =>
       * const b = {
       *    c: `format a`
       * };
       * ```
       *
       * ```ts
       * const a = x; // source - literal
       * const b = {
       *   c: `format ${a}` // target - intrinsic
       * };
       * // =>
       * const b = {
       *   c: `format ${x}` // target - intrinsic
       * };
       * ```
       */
      if (
        !(
          isPassState(state) ||
          isParallelTaskState(state) ||
          isMapTaskState(state) ||
          isTaskState(state)
        ) ||
        !state.Parameters ||
        typeof state.Parameters !== "object" ||
        Array.isArray(state.Parameters)
      ) {
        return;
      }

      /**
       * Update the target's stats to contain the new assign and remove the old one.
       */
      if (isLiteralAssignment(sourceAssign.usage)) {
        const value = accessLiteralAtJsonPathSuffix(
          targetUsage.usage.from,
          sourceAssign.usage.to,
          sourceAssign.usage.value
        );

        if (typeof value === "object" && value !== null) {
          return;
        }

        // literals are inlined into the intrinsic function, remove the assignment
        statsMap = updateVariableUsage(targetUsage);

        const from = targetUsage.usage.from;

        return [
          updateVariableUsage(targetUsage),
          {
            ...states,
            [targetUsage.usage.state]: {
              ...state,
              Parameters: updateParameters(
                targetUsage.usage.props,
                state.Parameters!,
                (original) => {
                  const intrinsic = original;
                  if (typeof intrinsic !== "string") {
                    throw new Error(
                      "Expected intrinsic property value to be a string."
                    );
                  }
                  return replaceJsonPathInIntrinsic(
                    intrinsic,
                    from,
                    formatValue(value)
                  );
                },
                true
              ),
            },
          },
        ];

        function formatValue(value: any): string {
          return typeof value === "string"
            ? `'${value}'`
            : // handles arrays and null which may exist as a Parameter value
            Array.isArray(value)
            ? `States.Array(${value.map(formatValue).join(",")})`
            : `${value}`;
        }
      } else {
        /**
         * if the "from" variable we intend to update the prop assignment with will be
         *  assigned to after the source assignment and before the target assignment, skip.
         */
        if (
          isMutatedInRange(
            sourceAssign.usage.from,
            sourceAssign.index,
            targetUsage.index
          )
        ) {
          return;
        }

        const updatedFrom = replaceJsonPathPrefix(
          (<IntrinsicUsage>targetUsage.usage).from,
          sourceAssign.usage.to,
          sourceAssign.usage.from
        )
          .split("$")
          .join("$$");

        return [
          updateVariableUsage(targetUsage, {
            ...targetUsage.usage,
            // update the from
            from: updatedFrom,
          }),
          {
            ...states,
            [targetUsage.usage.state]: {
              ...state,
              Parameters: updateParameters(
                targetUsage.usage.props,
                state.Parameters!,
                (original) => {
                  const intrinsic = original;
                  if (typeof intrinsic !== "string") {
                    throw new Error(
                      "Expected intrinsic property value to be a string."
                    );
                  }
                  const originalFrom = (<IntrinsicUsage>targetUsage.usage).from;
                  // States.Format($.heap0) => States.Format($.v)
                  // States.Format($.heap0) => States.Format("someString")
                  // States.Format($.heap0) => States.Format(0)
                  return replaceJsonPathInIntrinsic(
                    intrinsic,
                    originalFrom,
                    updatedFrom
                  );
                },
                true
              ),
            },
          },
        ];
      }
      return;
    } else if (isStateInput(targetUsage.usage)) {
      /**
       * Use of a literal or variable to property in a task/map input.
       * Note: this is a special case because:
       *       1. Task does not support Result as input, only Parameters (literal) or InputPath (reference)
       *       2. Map's reference input is the ItemsPath and does not support literal inputs for the array input
       *       3. Neither Map nor Task have a named output (to), only an input (from) as both are black boxes.
       *
       * ```ts
       * const a = arr // source - assignment
       * a.map(x => {}); // target - state input
       * // =>
       * arr.map(x => {});
       * ```
       *
       * ```ts
       * const a = "a"; // source - literal
       * func(a); // target - state input
       * // =>
       * func("a");
       * ```
       *
       * ```ts
       * const a = x; // source - assignment
       * func(x); // target - state input
       * // =>
       * func(x);
       * ```
       */
      if (!(isMapTaskState(state) || isTaskState(state))) {
        return;
      }

      if (isLiteralAssignment(sourceAssign.usage)) {
        const value = accessLiteralAtJsonPathSuffix(
          targetUsage.usage.from,
          sourceAssign.usage.to,
          sourceAssign.usage.value
        );

        // map items cannot be a literal
        if (state.Type === "Map") {
          return;
        }

        return [
          // the state takes a literal, clear the usage.
          updateVariableUsage(targetUsage),
          {
            ...states,
            [targetUsage.usage.state]: {
              ...state,
              InputPath: undefined,
              Parameters: value,
            },
          },
        ];
      } else {
        /**
         * if the "from" variable we intend to update the prop assignment with will be
         *  assigned to after the source assignment and before the target assignment, skip.
         */
        if (
          isMutatedInRange(
            sourceAssign.usage.from,
            sourceAssign.index,
            targetUsage.index
          )
        ) {
          return;
        }

        const updatedFrom = replaceJsonPathPrefix(
          targetUsage.usage.from,
          sourceAssign.usage.to,
          sourceAssign.usage.from
        );

        return [
          updateVariableUsage(targetUsage, {
            ...targetUsage.usage,
            from: updatedFrom,
          }),
          {
            ...states,
            [targetUsage.usage.state]:
              state.Type === "Map"
                ? {
                    ...state,
                    ItemsPath: sourceAssign.usage.from,
                  }
                : {
                    ...state,
                    InputPath: updatedFrom,
                  },
          },
        ];
      }
      return;
    } else if (
      isFilterUsage(targetUsage.usage) ||
      isFilterPropAssignment(targetUsage.usage) ||
      isReturnUsage(targetUsage.usage)
    ) {
      // TODO: support more cases.
      return;
    } else if (
      isLiteralAssignment(targetUsage.usage) ||
      isLiteralPropAssignment(targetUsage.usage) ||
      isStateOutput(targetUsage.usage) ||
      isConditionUsage(targetUsage.usage)
    ) {
      // nothing else to simplify here.
      return;
    } else {
      return assertNever(targetUsage.usage);
    }

    /**
     * Determines if a variable is mutated between the (topologically sorted) node indices given.
     *
     * a = "a"
     * source = a
     * a = "b" // mutated in range
     * target = a
     * a = "c" // mutated out of range.
     */
    function isMutatedInRange(
      variable: string,
      startNodeIndex: number,
      endNodeIndex: number
    ) {
      const variableStats = statsMap[jsonPathPrefix(variable)];
      return (
        variableStats?.assigns.some(
          (a) => a.index > startNodeIndex && a.index < endNodeIndex
        ) ?? false
      );
    }

    function jsonPathPrefix(jsonPath: string) {
      return formatJsonPath([normalizeJsonPath(jsonPath)[0]!]);
    }

    function updateVariableUsage(
      originalUsage: typeof statsMap[string]["assigns"][number],
      updatedUsage?: StateVariableUsage
    ): typeof statsMap {
      // all variables in the stats map should be the prefix of the json path.
      const originalTo =
        "to" in originalUsage.usage && originalUsage.usage.to
          ? jsonPathPrefix(originalUsage.usage.to)
          : undefined;
      const originalFrom =
        "from" in originalUsage.usage && originalUsage.usage.from
          ? jsonPathPrefix(originalUsage.usage.from)
          : undefined;
      const updatedTo =
        updatedUsage && "to" in updatedUsage && updatedUsage.to
          ? jsonPathPrefix(updatedUsage.to)
          : undefined;
      const updatedFrom =
        updatedUsage && "from" in updatedUsage && updatedUsage.from
          ? jsonPathPrefix(updatedUsage.from)
          : undefined;

      const uniqueTargets = [
        ...new Set([originalTo, originalFrom, updatedTo, updatedFrom]),
      ].filter((s): s is string => !!s);

      const newUsage = updatedUsage
        ? {
            ...originalUsage,
            usage: updatedUsage,
          }
        : undefined;

      return {
        ...statsMap,
        ...Object.fromEntries(
          uniqueTargets.map((variable) => {
            const usage = statsMap[variable] ?? {
              variable,
              assigns: [],
              usage: [],
            };

            return [
              variable,
              {
                ...usage,
                assigns: [
                  ...usage.assigns.filter((a) => a.id !== originalUsage.id),
                  ...(newUsage && variable === updatedTo ? [newUsage] : []),
                ],
                usage: [
                  ...usage.usage.filter((a) => a.id !== originalUsage.id),
                  ...(newUsage && variable === updatedFrom ? [newUsage] : []),
                ],
              },
            ];
          })
        ),
      };
    }

    function accessLiteralAtJsonPathSuffix(
      originalJsonPath: string,
      prefixJsonPath: string,
      value: any
    ) {
      if (jsonPathStartsWith(originalJsonPath, prefixJsonPath)) {
        const normOriginal = normalizeJsonPath(originalJsonPath);
        const normPrefix = normalizeJsonPath(prefixJsonPath);

        return access(normOriginal.slice(normPrefix.length), value);
      }

      function access(segments: (string | number)[], value: any): any {
        const [segment, ...tail] = segments;
        if (segment === undefined) {
          return value;
        } else if (!value) {
          throw new Error("Expected object or array literal, found: " + value);
        } else if (typeof value === "object") {
          if (Array.isArray(value)) {
            const index = Number(segment);
            if (Number.isNaN(index)) {
              throw new Error(
                "Expected number to access an array literal literal, found: " +
                  segment
              );
            }
            return access(tail, value[index]);
          } else {
            return value[segment];
          }
        }
        throw new Error("Expected object or array to access.");
      }
    }

    function updateParameters(
      /**
       * Json path prefix to skip in the json path.
       *
       * Prefix: $.output.param
       * JsonPath: $.output.param.param2.param3
       *
       * {
       *    Parameters: {
       *       param2: { param3: value }
       *    },
       *    ResultPath: $.output.param
       * }
       */
      props: string[],
      originalParameters: Record<string, Parameters>,
      value: Parameters | ((value: Parameters) => Parameters),
      isValueJsonPath: boolean
    ): Record<string, Parameters> {
      const [segment, ...tail] = props;
      if (typeof segment !== "string") {
        throw new Error("Parameters objects should only contain string keys");
      }
      if (props.length === 1) {
        const paramClone = { ...originalParameters };
        const updatedValue =
          typeof value === "function"
            ? value(paramClone[`${segment}.$`] ?? paramClone[segment] ?? null)
            : value;
        delete paramClone[`${segment}.$`];
        delete paramClone[segment];
        if (isValueJsonPath) {
          return {
            ...paramClone,
            [`${segment}.$`]: updatedValue,
          };
        } else {
          return {
            ...paramClone,
            [segment]: updatedValue,
          };
        }
      } else {
        const _params = originalParameters[segment];
        if (!_params || typeof _params !== "object" || Array.isArray(_params)) {
          throw new Error(
            "Something went wrong when updating parameter object. Expected structure to stay the same."
          );
        }
        return {
          ...originalParameters,
          [segment]: updateParameters(tail, _params, value, isValueJsonPath),
        };
      }
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
  function joinChainedChoices(startState: string, stateMap: States) {
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
   * Topologically sort a connected directed graph.
   */
  function topoSort(
    startState: string,
    states: States
  ): [stateName: string, state: State][] {
    const marks: Record<string, boolean> = {};
    let nodes: [stateName: string, state: State][] = [];

    visit(startState);

    return nodes;
    function visit(state: string) {
      const stateMark = marks[state];
      if (stateMark === false) {
        // cycle
        return;
      } else if (stateMark === true) {
        return;
      }
      const stateObj = states[state]!;

      marks[state] = false;

      visitTransition(stateObj, visit);
      marks[state] = true;
      nodes = [[state, stateObj], ...nodes];
    }
  }
}

function replaceJsonPathInIntrinsic(
  intrinsic: string,
  jsonPath: string,
  value: string
) {
  // States.Format($.heap0) => States.Format($.v)
  // States.Format($.heap0) => States.Format("someString")
  // States.Format($.heap0) => States.Format(0)
  return intrinsic.replace(
    new RegExp(escapeRegExp(jsonPath) + "(?=\\.|\\)|,|\\[)", "g"),
    value
  );
}
