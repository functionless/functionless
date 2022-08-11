import { aws_iam } from "aws-cdk-lib";
import { Construct } from "constructs";
import { BindingPattern } from "typescript";
import { assertNever } from "./assert";
import {
  BindingElem,
  BindingName,
  FunctionLike,
  ParameterDecl,
  VariableDecl,
  VariableDeclList,
} from "./declaration";
import { ErrorCodes, SynthError } from "./error-code";
import {
  ArrowFunctionExpr,
  CallExpr,
  ElementAccessExpr,
  Expr,
  FunctionExpr,
  Identifier,
  NullLiteralExpr,
  PropAccessExpr,
  SuperKeyword,
} from "./expression";
import {
  isArgument,
  isArrayBinding,
  isArrayLiteralExpr,
  isAwaitExpr,
  isBigIntExpr,
  isBinaryExpr,
  isBindingElem,
  isBindingPattern,
  isBlockStmt,
  isBooleanLiteralExpr,
  isBreakStmt,
  isCallExpr,
  isCaseClause,
  isCatchClause,
  isClassDecl,
  isClassExpr,
  isClassStaticBlockDecl,
  isComputedPropertyNameExpr,
  isConditionExpr,
  isConstructorDecl,
  isContinueStmt,
  isDebuggerStmt,
  isDefaultClause,
  isDeleteExpr,
  isDoStmt,
  isElementAccessExpr,
  isEmptyStmt,
  isErr,
  isExpr,
  isExprStmt,
  isForInStmt,
  isForOfStmt,
  isForStmt,
  isFunctionLike,
  isGetAccessorDecl,
  isIdentifier,
  isIfStmt,
  isImportKeyword,
  isLabelledStmt,
  isLiteralExpr,
  isMethodDecl,
  isNewExpr,
  isNode,
  isNoSubstitutionTemplateLiteral,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectBinding,
  isObjectLiteralExpr,
  isOmittedExpr,
  isParameterDecl,
  isParenthesizedExpr,
  isPostfixUnaryExpr,
  isPrivateIdentifier,
  isPropAccessExpr,
  isPropAssignExpr,
  isPropDecl,
  isReferenceExpr,
  isRegexExpr,
  isReturnStmt,
  isSetAccessorDecl,
  isSpreadAssignExpr,
  isSpreadElementExpr,
  isStmt,
  isStringLiteralExpr,
  isSuperKeyword,
  isSwitchStmt,
  isTaggedTemplateExpr,
  isTemplateExpr,
  isTemplateHead,
  isTemplateMiddle,
  isTemplateSpan,
  isTemplateTail,
  isThisExpr,
  isThrowStmt,
  isTryStmt,
  isTypeOfExpr,
  isUnaryExpr,
  isUndefinedLiteralExpr,
  isVariableDecl,
  isVariableDeclList,
  isVariableReference,
  isVariableStmt,
  isVoidExpr,
  isWhileStmt,
  isWithStmt,
  isYieldExpr,
} from "./guards";
import {
  IntegrationImpl,
  isIntegration,
  isIntegrationCallPattern,
  tryFindIntegration,
} from "./integration";
import { BindingDecl, FunctionlessNode } from "./node";
import { emptySpan } from "./span";
import {
  BlockStmt,
  BreakStmt,
  ContinueStmt,
  ForInStmt,
  IfStmt,
  ReturnStmt,
  Stmt,
} from "./statement";
import { StepFunctionError } from "./step-function";
import {
  anyOf,
  DeterministicNameGenerator,
  evalToConstant,
  invertBinaryOperator,
  isPromiseAll,
  UniqueNameGenerator,
} from "./util";
import { visitEachChild } from "./visit";

export interface StateMachine<S extends States> {
  Version?: "1.0";
  Comment?: string;
  TimeoutSeconds?: number;
  StartAt: keyof S;
  States: S;
}

export interface States {
  [stateName: string]: State;
}

export const isState = (state: any): state is State => {
  return "Type" in state;
};

export type State =
  | Choice
  | Fail
  | MapTask
  | ParallelTask
  | Pass
  | Succeed
  | Task
  | Wait;

export type TerminalState = Succeed | Fail | Extract<State, { End: true }>;

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-common-fields.html
 */
export type CommonFields = {
  /**
   * Holds a human-readable description of the state.
   */
  Comment?: string;
  /**
   * A path that selects a portion of the state's input to be passed to the state's task for processing. If omitted, it has the value $ which designates the entire input. For more information, see Input and Output Processing).
   */
  InputPath?: string;
  /**
   * A path that selects a portion of the state's input to be passed to the state's output. If omitted, it has the value $ which designates the entire input. For more information, see Input and Output Processing.
   */
  OutputPath?: string;
} & (
  | {
      /**
       * The name of the next state that is run when the current state finishes. Some state types, such as Choice, allow multiple transition states.
       */
      Next: string;
      End?: never;
    }
  | {
      /**
       * Designates this state as a terminal state (ends the execution) if set to true. There can be any number of terminal states per state machine. Only one of Next or End can be used in a state. Some state types, such as Choice, don't support or use the End field.
       */
      End: true;
      Next?: never;
    }
);

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-succeed-state.html
 */
export interface Succeed extends Omit<CommonFields, "Next" | "End"> {
  Type: "Succeed";
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-fail-state.html
 */
export interface Fail extends Pick<CommonFields, "Comment"> {
  Type: "Fail";
  Error?: string;
  Cause?: string;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html
 */
export type Wait = CommonFields & {
  Type: "Wait";
  /**
   * A time, in seconds, to wait before beginning the state specified in the Next field.
   */
  Seconds?: number;
  /**
   * An absolute time to wait until beginning the state specified in the Next field.
   *
   * Timestamps must conform to the RFC3339 profile of ISO 8601, with the further restrictions that an uppercase T must separate the date and time portions, and an uppercase Z must denote that a numeric time zone offset is not present, for example, 2016-08-18T17:33:00Z.
   */
  Timestamp?: string;
  /**
   * A time, in seconds, to wait before beginning the state specified in the Next field, specified using a path from the state's input data.
   */
  SecondsPath?: string;
  /**
   * An absolute time to wait until beginning the state specified in the Next field, specified using a path from the state's input data.
   */
  TimestampPath?: string;
};

export type Parameters =
  | null
  | boolean
  | number
  | string
  | Parameters[]
  | {
      [name: string]: Parameters;
    };

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-pass-state.html
 */
export type Pass = CommonFields & {
  Comment?: string;
  Type: "Pass";
  Result?: any;
  ResultPath?: string | null;
  Parameters?: Parameters;
};

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-task-state.html
 */
export type CommonTaskFields = CommonFields & {
  Comment?: string;
  Parameters?: Parameters;
  ResultSelector?: Parameters;
  ResultPath?: string | null;
  Retry?: Retry[];
  Catch?: Catch[];
};

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-task-state.html
 */
export type Task = CommonTaskFields & {
  Type: "Task";
  Resource: string;
};

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-choice-state.html
 */
export interface Choice extends Omit<CommonFields, "End" | "Next"> {
  Type: "Choice";
  Choices: Branch[];
  Default?: string;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-choice-state.html
 */
export interface Branch extends Condition {
  Next: string;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-choice-state.html
 */
export interface Condition {
  Variable?: string;
  Not?: Condition;
  And?: Condition[];
  Or?: Condition[];
  BooleanEquals?: boolean;
  BooleanEqualsPath?: string;
  IsBoolean?: boolean;
  IsNull?: boolean;
  IsNumeric?: boolean;
  IsPresent?: boolean;
  IsString?: boolean;
  IsTimestamp?: boolean;
  NumericEquals?: number;
  NumericEqualsPath?: string;
  NumericGreaterThan?: number;
  NumericGreaterThanPath?: string;
  NumericGreaterThanEquals?: number;
  NumericGreaterThanEqualsPath?: string;
  NumericLessThan?: number;
  NumericLessThanPath?: string;
  NumericLessThanEquals?: number;
  NumericLessThanEqualsPath?: string;
  StringEquals?: string;
  StringEqualsPath?: string;
  StringGreaterThan?: string;
  StringGreaterThanPath?: string;
  StringGreaterThanEquals?: string;
  StringGreaterThanEqualsPath?: string;
  StringLessThan?: string;
  StringLessThanPath?: string;
  StringLessThanEquals?: string;
  StringLessThanEqualsPath?: string;
  StringMatches?: string;
  TimestampEquals?: string;
  TimestampEqualsPath?: string;
  TimestampGreaterThan?: string;
  TimestampGreaterThanPath?: string;
  TimestampGreaterThanEquals?: string;
  TimestampGreaterThanEqualsPath?: string;
  TimestampLessThan?: string;
  TimestampLessThanPath?: string;
  TimestampLessThanEquals?: string;
  TimestampLessThanEqualsPath?: string;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
 */
export interface Retry {
  ErrorEquals: string[];
  IntervalSeconds?: number;
  MaxAttempts?: number;
  BackoffRate?: number;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
 */
export interface Catch {
  ErrorEquals: string[];
  ResultPath?: string | null;
  Next: string;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-map-state.html
 */
export type MapTask = CommonTaskFields & {
  Type: "Map";
  /**
   * The Iterator field’s value is an object that defines a state machine which will process each element of the array.
   */
  Iterator: StateMachine<States>;
  /**
   * The ItemsPath field’s value is a reference path identifying where in the effective input the array field is found. For more information, see ItemsPath.
   *
   * States within an Iterator field can only transition to each other, and no state outside the Iterator field can transition to a state within it.
   *
   * If any iteration fails, entire Map state fails, and all iterations are terminated.
   */
  ItemsPath?: string;
  /**
   * Specifies where (in the input) to place the output of the branches. The input is then filtered as specified by the OutputPath field (if present) before being used as the state's output. For more information, see Input and Output Processing.
   */
  ResultPath?: string | null;
  /**
   * The `MaxConcurrency` field’s value is an integer that provides an upper bound on how many invocations of the Iterator may run in parallel. For instance, a MaxConcurrency value of 10 will limit your Map state to 10 concurrent iterations running at one time.
   *
   * Concurrent iterations may be limited. When this occurs, some iterations will not begin until previous iterations have completed. The likelihood of this occurring increases when your input array has more than 40 items.
   *
   * The default value is 0, which places no quota on parallelism and iterations are invoked as concurrently as possible.
   *
   * A MaxConcurrency value of 1 invokes the Iterator once for each array element in the order of their appearance in the input, and will not start a new iteration until the previous has completed.
   */
  MaxConcurrency?: number;
};

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-parallel-state.html
 */
export type ParallelTask = CommonTaskFields & {
  Type: "Parallel";
  Branches: StateMachine<States>[];
};

export const isParallelTaskState = (state: State): state is ParallelTask => {
  return state.Type === "Parallel";
};
export const isMapTaskState = (state: State): state is MapTask => {
  return state.Type === "Map";
};
export const isTaskState = (state: State): state is Task => {
  return state.Type === "Task";
};
export const isPassState = (state: State): state is Pass => {
  return state.Type === "Pass";
};
export const isChoiceState = (state: State): state is Choice => {
  return state.Type === "Choice";
};
export const isFailState = (state: State): state is Fail => {
  return state.Type === "Fail";
};
export const isSucceedState = (state: State): state is Succeed => {
  return state.Type === "Succeed";
};
export const isWaitState = (state: State): state is Wait => {
  return state.Type === "Wait";
};

export interface EvalExprContext {
  /**
   * returns a possibly mutated output variable as json path.
   *
   * If the output was a {@link ASLGraph.LiteralValue}, a new state will be added that turns the literal into a json path.
   * If the output was a {@link ASLGraph.JsonPath}, the output is returned.
   */
  normalizeOutputToJsonPath: () => ASLGraph.JsonPath;
  /**
   * Callback provided to inject additional states into the graph.
   * The state will be joined (@see ASLGraph.joinSubStates ) with the previous and next states in the order received.
   */
  addState: (state: ASLGraph.NodeState | ASLGraph.SubState) => void;
}

/**
 * The name of the functionless context data node used in {@link FUNCTIONLESS_CONTEXT_JSON_PATH}.
 */
const FUNCTIONLESS_CONTEXT_NAME = "fnl_context";
/**
 * A json path which stores functionless context data like the input and a hard to manufacture null value
 *
 * This path/variable must start with a letter.
 * https://twitter.com/sussmansa/status/1542777348616990720?s=20&t=2PepSKvzPhojs_x01WoQVQ
 */
const FUNCTIONLESS_CONTEXT_JSON_PATH = `$.${FUNCTIONLESS_CONTEXT_NAME}`;

/**
 * Amazon States Language (ASL) Generator.
 */
export class ASL {
  /**
   * A friendly name to identify the Functionless Context.
   */
  static readonly ContextName = "Amazon States Language";
  /**
   * Tag this instance with its Functionless Context ({@link this.ContextName})
   */
  readonly kind = ASL.ContextName;
  /**
   * The Amazon States Language (ASL) State Machine Definition synthesized fro the {@link decl}.
   */
  readonly definition: StateMachine<States>;
  /**
   * The {@link FunctionLike} AST representation of the State Machine.
   */
  readonly decl: FunctionLike;
  private readonly stateNamesGenerator = new UniqueNameGenerator(
    (name, n) => `${name} ${n}`
  );
  private readonly variableNamesGenerator = new UniqueNameGenerator(
    (name, n) => `${name}__${n}`
  );
  private readonly variableNamesMap = new Map<FunctionlessNode, string>();
  private readonly generatedNames = new DeterministicNameGenerator();

  /**
   * A pointer to the state used to continue.
   *
   * For and While loops should implement this state.
   */
  private static readonly ContinueNext: string = "__ContinueNext";

  /**
   * A pointer to the nearest break point.
   *
   * For and While loops should implement this state.
   */
  private static readonly BreakNext: string = "__BreakNext";

  /**
   * A pointer to the nearest catch state.
   */
  private static readonly CatchState: string = "__catch";

  constructor(
    readonly scope: Construct,
    readonly role: aws_iam.IRole,
    decl: FunctionLike
  ) {
    this.decl = decl = visitEachChild(decl, function normalizeAST(node):
      | FunctionlessNode
      | FunctionlessNode[] {
      if (isBlockStmt(node)) {
        return new BlockStmt(node.span, [
          // for each block statement
          ...node.statements.flatMap((stmt) => {
            const transformed = normalizeAST(stmt) as Stmt[];
            if (Array.isArray(transformed)) {
              return transformed;
            } else {
              return [transformed];
            }
          }),

          // re-write the AST to include explicit `ReturnStmt(NullLiteral())` statements
          // this simplifies the interpreter code by always having a node to chain onto, even when
          // the AST has no final `ReturnStmt` (i.e. when the function is a void function)
          // without this, chains that should return null will actually include the entire state as their output
          ...(isFunctionLike(node.parent) &&
          (!node.lastStmt || !node.lastStmt.isTerminal())
            ? [
                new ReturnStmt(
                  node.lastStmt?.span ?? node.span,
                  new NullLiteralExpr(node.lastStmt?.span ?? node.span)
                ),
              ]
            : []),
        ]);
      } else if (isForOfStmt(node) && node.isAwait) {
        throw new SynthError(
          ErrorCodes.Unsupported_Feature,
          `Step Functions does not yet support for-await, see https://github.com/functionless/functionless/issues/390`
        );
      } else if (isParameterDecl(node) && node.isRest) {
        throw new SynthError(
          ErrorCodes.Unsupported_Feature,
          `Step Functions does not yet support rest parameters, see https://github.com/functionless/functionless/issues/391`
        );
      }
      return visitEachChild(node, normalizeAST);
    });

    const [inputParam, contextParam] = this.decl.parameters;

    // get the State Parameters and ASLGraph states to initialize any provided parameters (assignment and binding).
    const [paramInitializer, paramStates] =
      this.evalParameterDeclForStateParameter(
        this.decl,
        [inputParam, { jsonPath: "$$.Execution.Input" }],
        [
          // for the context parameter, we only want to assign up front if we need to bind parameter names.
          // in the case a simple `Identifier` is used as the parameter name, we'll inject the jsonPath "$$" later.
          // This should save us space on the state by not assigning the entire context object when not needed.
          contextParam && isBindingPattern(contextParam.name)
            ? contextParam
            : undefined,
          { jsonPath: "$$" },
        ]
      );

    /**
     * Always inject this initial state into the machine. It does 3 things:
     *
     * 1. Adds the fnl_context which provides hard to generate values like null.
     * 2. assigns the input to the mutable input parameter name.
     * 3. Clears out the initial input from the state.
     *
     * The 3rd task is always required as the input could populate later generated variables.
     */
    const functionlessContext: Pass = {
      Type: "Pass",
      Parameters: {
        [FUNCTIONLESS_CONTEXT_NAME]: { null: null },
        ...paramInitializer,
      },
      ResultPath: "$",
      Next: ASLGraph.DeferNext,
    };

    const states = this.evalStmt(this.decl.body, {
      End: true,
      ResultPath: "$",
    });

    this.definition = this.aslGraphToStates(
      ASLGraph.joinSubStates(
        this.decl.body,
        functionlessContext,
        paramStates,
        states
      )!,
      "Initialize Functionless Context"
    );
  }

  /**
   * Access Functionless context variables in the machine state like the input to the machine.
   *
   * The Functionless context is only added to the machine when needed.
   * Using this property anywhere in a machine will add the context Pass state to the start of the machine.
   */
  public context = {
    null: `${FUNCTIONLESS_CONTEXT_JSON_PATH}.null`,
  };

  /**
   * Returns a unique name for a declaration.
   *
   * The first time we see a declaration, the name will be the same as the identifier name.
   *
   * All future unique declarations with the same name will see an incremented number suffixed to the identifier.
   *
   * ```ts
   * const a;
   * const a; // a__1
   * const a; // a__2
   * for(let a in []) // a__3
   * ```
   */
  private getDeclarationName(binding: BindingDecl & { name: Identifier }) {
    if (!this.variableNamesMap.get(binding)) {
      const name = binding.name.name;
      this.variableNamesMap.set(
        binding,
        this.variableNamesGenerator.getUnique(name)
      );
    }
    return this.variableNamesMap.get(binding);
  }

  /**
   * Returns the unique variable name which has been registered for this identifier.
   *
   * Expects an {@link Identifier} which has a discoverable declaration.
   *
   * @see getDeclarationName
   */
  private getIdentifierName(identifier: Identifier) {
    const ref = identifier.lookup();

    if (
      (isBindingElem(ref) || isParameterDecl(ref) || isVariableDecl(ref)) &&
      isIdentifier(ref.name)
    ) {
      return this.getDeclarationName(ref as BindingDecl & { name: Identifier });
    }
    throw new ReferenceError(`${identifier.name} is not defined`);
  }

  /**
   * Generates a valid, unique state name for the ASL machine.
   *
   * * Truncates the name to 75 characters
   * * If the name is already used, suffix with a unique number
   * * Cache both the truncated name and the suffixed name to prevent future collisions.
   */
  private createUniqueStateName(stateName: string): string {
    const truncatedStateName =
      stateName.length > 75 ? stateName.slice(0, 75) : stateName;
    return this.stateNamesGenerator.getUnique(truncatedStateName);
  }

  /**
   * Flattens a {@link ASLGraph.SubState} graph or {@link ASLGraph.NodeState} into a {@link States} collection.
   *
   * Provides a node naming strategy. (see `stmtName`).
   *
   * @param stmtName - The name to use to start the graph. When a SubState is given, the first state of the collection
   *                   with use the `stmtName`. All subsequent states either use the name of the `node` given or their local name
   *                   prefixed onto the parent name.
   *                   When a NodeState is given, the `stmtName` is used.
   */
  public aslGraphToStates(
    state: ASLGraph.NodeState | ASLGraph.SubState,
    overrideStateName?: string
  ): StateMachine<States> {
    const stmtName = this.createUniqueStateName(
      overrideStateName ?? (state.node ? toStateName(state.node) : "Default")
    );
    // build a map of local state names to their unique flattened form
    return {
      StartAt: stmtName,
      States: ASLGraph.toStates(
        stmtName,
        ASLGraph.updateDeferredNextStates({ End: true }, state),
        (parentName, states) => {
          return Object.fromEntries(
            Object.entries(states.states ?? {}).map(([name, state]) => [
              name,
              states.startState === name
                ? parentName
                : state.node
                ? this.createUniqueStateName(toStateName(state.node))
                : this.createUniqueStateName(`${name}__${parentName}`),
            ])
          );
        }
      ),
    };
  }

  /**
   * Evaluate a single {@link Stmt} into a collection of named states.
   *
   * @param returnPass partial Pass state which will be given the return value as input using {@link ASLGraph.passWithInput}.
   *                   provide the rest to determine the behavior of the returnStmt.
   */
  public evalStmt(
    stmt: Stmt,
    returnPass: Omit<Pass, "Type" | "InputPath" | "Parameters" | "Result"> &
      CommonFields
  ): ASLGraph.SubState | ASLGraph.NodeState | undefined {
    if (isBlockStmt(stmt)) {
      return ASLGraph.joinSubStates(
        stmt,
        ...stmt.statements.map((s) => {
          const states = this.evalStmt(s, returnPass);
          // ensure all of the states in a block have a node associated with them
          return states
            ? {
                ...states,
                node: s,
              }
            : undefined;
        })
      );
    } else if (isBreakStmt(stmt) || isContinueStmt(stmt)) {
      const loop = stmt.findParent(
        anyOf(isForOfStmt, isForInStmt, isForStmt, isWhileStmt, isDoStmt)
      );
      if (loop === undefined) {
        throw new Error("Stack Underflow");
      }

      return isBreakStmt(stmt)
        ? {
            node: stmt,
            Type: "Pass",
            Next: ASL.BreakNext,
          }
        : {
            node: stmt,
            Type: "Pass",
            Next: ASL.ContinueNext,
            ResultPath: null,
          };
    } else if (isExprStmt(stmt)) {
      const expr = this.eval(stmt.expr);

      // Expr Stmt throws away the constant or reference result of a statement.
      // Either apply the next statement to the returned sub-state
      // or create an empty pass
      // TODO: Minor optimization. Could we update references to this line to the next statement?
      //       or could we defer wiring the next states until we know which statements
      //       have outputs?
      if (ASLGraph.isOutputStateOrSubState(expr)) {
        return expr;
      } else {
        return {
          node: stmt,
          Type: "Pass",
          ResultPath: null,
          Next: ASLGraph.DeferNext,
        };
      }
    } else if (isForOfStmt(stmt) || isForInStmt(stmt)) {
      return this.evalExprToSubState(stmt.expr, (output) => {
        const body = this.evalStmt(stmt.body, returnPass);

        // assigns either a constant or json path to a new variable
        const assignTempState = this.stateWithHeapOutput(
          ASLGraph.passWithInput(
            {
              Type: "Pass",
              Next: ASLGraph.DeferNext,
            },
            output
          )
        );
        const tempArrayPath = assignTempState.output.jsonPath;

        const assignTemp = isForOfStmt(stmt)
          ? assignTempState
          : // if `ForIn`, map the array into a tuple of index and item
            ASLGraph.joinSubStates(stmt.expr, assignTempState, {
              ...this.zipArray(
                tempArrayPath,
                (indexJsonPath) => `States.Format('{}', ${indexJsonPath})`
              ),
              ResultPath: tempArrayPath,
              Next: ASLGraph.DeferNext,
            })!;

        const initializer: ASLGraph.SubState | ASLGraph.NodeState = (() => {
          /**ForInStmt
           * Assign the value to $.0__[variableName].
           * Assign the index to the variable decl. If the variable decl is an identifier, it may be carried beyond the ForIn.
           */
          if (isForInStmt(stmt)) {
            const initializerName = isIdentifier(stmt.initializer)
              ? this.getIdentifierName(stmt.initializer)
              : isVariableDecl(stmt.initializer) &&
                isIdentifier(stmt.initializer.name)
              ? this.getDeclarationName(
                  stmt.initializer as VariableDecl & { name: Identifier }
                )
              : undefined;

            if (initializerName === undefined) {
              throw new SynthError(
                ErrorCodes.Unexpected_Error,
                "The left-hand side of a 'for...in' statement cannot be a destructuring pattern."
              );
            }

            return {
              startState: "assignIndex",
              node: stmt.initializer,
              states: {
                assignIndex: {
                  Type: "Pass",
                  InputPath: `${tempArrayPath}[0].index`,
                  ResultPath: `$.${initializerName}`,
                  Next: "assignValue",
                },
                assignValue: {
                  Type: "Pass",
                  InputPath: `${tempArrayPath}[0].item`,
                  ResultPath: `$.0__${initializerName}`,
                  Next: ASLGraph.DeferNext,
                },
              },
            };
          } else {
            return isVariableDecl(stmt.initializer)
              ? // supports deconstruction variable declaration
                this.evalDecl(stmt.initializer, {
                  jsonPath: `${tempArrayPath}[0]`,
                })!
              : this.evalAssignment(stmt.initializer, {
                  jsonPath: `${tempArrayPath}[0]`,
                })!;
          }
        })();

        return {
          startState: "assignTemp",
          node: stmt,
          states: {
            assignTemp: ASLGraph.updateDeferredNextStates(
              { Next: "hasNext" },
              assignTemp
            ),
            hasNext: {
              Type: "Choice",
              Choices: [
                { ...ASL.isPresent(`${tempArrayPath}[0]`), Next: "assign" },
              ],
              Default: "exit",
            },
            /**
             * Assign the index to $.[variableName].
             * When the loop.variableDecl is an {@link Identifier} (not {@link VariableStmt}), the variable may be used after the for loop.
             */
            assign: ASLGraph.updateDeferredNextStates(
              { Next: "body" },
              initializer
            ),
            // any ASLGraph.DeferNext (or empty) should be wired to exit
            body: ASLGraph.updateDeferredNextStates(
              { Next: "tail" },
              body ?? {
                Type: "Pass",
                Next: ASLGraph.DeferNext,
              }
            ),
            // tail the array
            tail: {
              Type: "Pass",
              InputPath: `${tempArrayPath}[1:]`,
              ResultPath: tempArrayPath,
              Next: "hasNext", // restart by checking for items after tail
            },
            // clean up?
            exit: {
              Type: "Pass",
              Next: ASLGraph.DeferNext,
            },
            [ASL.ContinueNext]: {
              Type: "Pass",
              Next: "tail",
              node: new ContinueStmt(emptySpan()),
            },
            [ASL.BreakNext]: {
              Type: "Pass",
              Next: "exit",
              node: new BreakStmt(emptySpan()),
            },
          },
        };
      });
    } else if (isForStmt(stmt)) {
      const body = this.evalStmt(stmt.body, returnPass);

      return this.evalContextToSubState(stmt, (evalExpr) => {
        const initializers = stmt.initializer
          ? isVariableDeclList(stmt.initializer)
            ? stmt.initializer.decls.map((x) => this.evalDecl(x))
            : [evalExpr(stmt.initializer)]
          : [undefined];

        const [cond, condStates] = stmt.condition
          ? this.toCondition(stmt.condition)
          : [];

        const increment = stmt.incrementor
          ? this.eval(stmt.incrementor)
          : undefined;

        // run optional initializer
        return ASLGraph.joinSubStates(stmt, ...initializers, {
          startState: "check",
          states: {
            // check the condition (or do nothing)
            check:
              cond && stmt.condition
                ? // join the states required to execute the condition with the condition value.
                  // This ensures the condition supports short circuiting and runs all expressions as needed
                  ASLGraph.joinSubStates(stmt.condition, condStates, {
                    Type: "Choice",
                    Choices: [{ ...cond, Next: "body" }],
                    Default: "exit",
                  })!
                : // no condition, for loop will require an explicit exit
                  { Type: "Pass", Next: "body" },
            // then run the body
            body: ASLGraph.updateDeferredNextStates(
              { Next: "increment" },
              body ?? {
                Type: "Pass",
                Next: ASLGraph.DeferNext,
              }
            ),
            // then increment (or do nothing)
            increment: ASLGraph.updateDeferredNextStates(
              { Next: "check" },
              increment && ASLGraph.isStateOrSubState(increment)
                ? increment
                : { Type: "Pass", Next: ASLGraph.DeferNext }
            ),
            // return back to check
            // TODO: clean up?
            exit: { Type: "Pass", Next: ASLGraph.DeferNext },
            [ASL.ContinueNext]: {
              Type: "Pass",
              Next: "check",
              node: new ContinueStmt(emptySpan()),
            },
            [ASL.BreakNext]: {
              Type: "Pass",
              Next: "exit",
              node: new BreakStmt(emptySpan()),
            },
          },
        })!;
      });
    } else if (isIfStmt(stmt)) {
      return this.evalContextToSubState(stmt, (_, evalCondition) => {
        const collect = (curr: IfStmt): [IfStmt[], Stmt | undefined] => {
          if (curr._else) {
            if (isIfStmt(curr._else)) {
              const [ifs, el] = collect(curr._else);
              return [[curr, ...ifs], el];
            } else {
              return [[curr], curr._else];
            }
          }
          return [[curr], undefined];
        };

        const [ifs, els] = collect(stmt);

        const choices = ifs.map((_if, i) => ({
          ...evalCondition(_if.when),
          Next: `if_${i}`,
        }));

        const elsState = els ? this.evalStmt(els, returnPass) : undefined;

        return {
          startState: "choose",
          states: {
            choose: {
              Type: "Choice",
              Choices: choices,
              Default: "else",
            },
            ...Object.fromEntries(
              ifs.map((_if, i) => [
                `if_${i}`,
                this.evalStmt(_if.then, returnPass),
              ])
            ),
            // provide an empty else statement. A choice default cannot terminate a sub-graph,
            // without a pass here, an if statement without else cannot end a block.
            // if the extra pass isn't needed, it will be pruned later
            else: elsState
              ? elsState
              : { Type: "Pass", Next: ASLGraph.DeferNext },
          },
        };
      });
    } else if (isReturnStmt(stmt)) {
      return this.evalExprToSubState(
        stmt.expr ?? stmt.fork(new NullLiteralExpr(stmt.span)),
        (output) =>
          ASLGraph.passWithInput(
            {
              Type: "Pass",
              ...returnPass,
            },
            output
          )
      );
    } else if (isVariableStmt(stmt)) {
      return ASLGraph.joinSubStates(
        stmt,
        ...stmt.declList.decls.map((decl) => this.evalDecl(decl))
      );
    } else if (isThrowStmt(stmt)) {
      if (
        !(
          isNewExpr(stmt.expr) ||
          isCallExpr(stmt.expr) ||
          isIntegrationCallPattern(stmt.expr)
        )
      ) {
        throw new Error(
          "the expr of a ThrowStmt must be a NewExpr or CallExpr"
        );
      }

      const updated =
        isNewExpr(stmt.expr) || isCallExpr(stmt.expr)
          ? stmt.expr
          : stmt.expr.expr;

      const throwState = this.evalContextToSubState(updated, (evalExpr) => {
        const errorClassName =
          // new StepFunctionError will be a ReferenceExpr with the name: Step
          isReferenceExpr(updated.expr) &&
          StepFunctionError.isConstructor(updated.expr.ref())
            ? StepFunctionError.kind
            : isReferenceExpr(updated.expr) || isIdentifier(updated.expr)
            ? updated.expr.name
            : isPropAccessExpr(updated.expr)
            ? updated.expr.name.name
            : undefined;

        // we support three ways of throwing errors within Step Functions
        // throw new Error(msg)
        // throw Error(msg)
        // throw StepFunctionError(cause, message);

        const { errorName, causeJson } = resolveErrorNameAndCause();

        const throwTransition = this.throw(stmt);
        if (throwTransition === undefined) {
          return {
            Type: "Fail",
            Error: errorName,
            Cause: JSON.stringify(causeJson),
          };
        } else {
          return {
            Type: "Pass",
            Result: causeJson,
            ...throwTransition,
          };
        }

        function resolveErrorNameAndCause(): {
          errorName: string;
          causeJson: unknown;
        } {
          if (errorClassName === "Error") {
            const errorMessage = updated.args[0]?.expr;
            if (
              errorMessage === undefined ||
              isUndefinedLiteralExpr(errorMessage)
            ) {
              return {
                errorName: "Error",
                causeJson: {
                  message: null,
                },
              };
            } else {
              return {
                errorName: "Error",
                causeJson: {
                  message: toJson(errorMessage),
                },
              };
            }
          } else if (errorClassName === "StepFunctionError") {
            const [error, cause] = updated.args.map(({ expr }) => expr);
            if (error === undefined || cause === undefined) {
              // this should never happen if typescript type checking is enabled
              // hence why we don't add a new ErrorCode for it
              throw new SynthError(
                ErrorCodes.Unexpected_Error,
                `Expected 'error' and 'cause' parameter in StepFunctionError`
              );
            }
            const errorName = toJson(error);
            if (typeof errorName !== "string") {
              // this should never happen if typescript type checking is enabled
              // hence why we don't add a new ErrorCode for it
              throw new SynthError(
                ErrorCodes.Unexpected_Error,
                `Expected 'error' parameter in StepFunctionError to be of type string, but got ${typeof errorName}`
              );
            }
            try {
              return {
                errorName,
                causeJson: toJson(cause),
              };
            } catch (err: any) {
              throw new SynthError(
                ErrorCodes.StepFunctions_error_cause_must_be_a_constant,
                err.message
              );
            }
          } else {
            throw new SynthError(
              ErrorCodes.StepFunction_Throw_must_be_Error_or_StepFunctionError_class
            );
          }
        }

        /**
         * Attempts to convert a Node into a JSON object.
         *
         * Only literal expression types are supported - no computation.
         */
        function toJson(expr: Expr): unknown {
          const val = evalExpr(expr);
          if (!ASLGraph.isLiteralValue(val) || val.containsJsonPath) {
            throw new SynthError(
              ErrorCodes.StepFunctions_error_cause_must_be_a_constant
            );
          }
          return val.value;
        }
      });

      return { ...throwState, node: stmt };
    } else if (isTryStmt(stmt)) {
      const tryFlow = analyzeFlow(stmt.tryBlock);

      const errorVariableName = stmt.catchClause
        ? this.generatedNames.generateOrGet(stmt.catchClause)
        : undefined;

      const tryState = {
        startState: "try",
        node: stmt.tryBlock,
        states: {
          try: this.evalStmt(stmt.tryBlock, returnPass) ?? {
            Type: "Pass",
            ResultPath: null,
            Next: ASLGraph.DeferNext,
          },
          // create a special catch clause that is only visible to states in the try block
          ...(stmt.catchClause
            ? { [ASL.CatchState]: { Type: "Pass", Next: "catch" } }
            : {}),
        },
      };

      const tryFlowStates =
        tryFlow.hasTask && stmt.catchClause?.variableDecl
          ? ASLGraph.joinSubStates(
              stmt.catchClause.variableDecl,
              {
                Type: "Pass",
                Next: ASLGraph.DeferNext,
                Parameters: {
                  "0_ParsedError.$": `States.StringToJson($.${errorVariableName}.Cause)`,
                },
                ResultPath: `$.${errorVariableName}`,
              },
              {
                Type: "Pass",
                InputPath: `$.${errorVariableName}.0_ParsedError`,
                ResultPath: `$.${errorVariableName}`,
                Next: ASLGraph.DeferNext,
              }
            )
          : undefined;

      const catchClauseState = stmt.catchClause
        ? {
            startState: "catch",
            states: {
              catch: ASLGraph.joinSubStates(
                stmt.catchClause,
                tryFlowStates,
                this.evalStmt(stmt.catchClause, returnPass)
              ) ?? { Type: "Pass", Next: ASLGraph.DeferNext },
              // if there is a finally, make sure any thrown errors in catch are handled
              ...(stmt.finallyBlock
                ? {
                    [ASL.CatchState]: {
                      Type: "Pass",
                      Next: "finally",
                    },
                  }
                : {}),
            },
          }
        : undefined;

      const finallyState = stmt.finallyBlock
        ? ASLGraph.joinSubStates(
            stmt.finallyBlock,
            // finally block, which may be empty.
            this.evalStmt(stmt.finallyBlock, returnPass) ?? {
              Type: "Pass",
              ResultPath: null,
              Next: ASLGraph.DeferNext,
            },
            stmt.catchClause && canThrow(stmt.catchClause)
              ? (() => {
                  if (stmt.finallyBlock.isTerminal()) {
                    // if every branch in the finallyBlock is terminal (meaning it always throws or returns)
                    // then we don't need the exit and throw blocks of a finally - because the finally
                    // will always return
                    // this is an extreme edge case
                    // see: https://github.com/microsoft/TypeScript/issues/27454
                    return undefined;
                  }
                  const throwTarget = this.throw(stmt.finallyBlock);
                  const errVariable = `$.${this.generatedNames.generateOrGet(
                    stmt.finallyBlock
                  )}`;
                  return {
                    startState: "exit",
                    states: {
                      exit: {
                        // when exiting the finally block, if we entered via an error, then we need to re-throw the error
                        Type: "Choice",
                        Choices: [
                          {
                            // errors thrown from the catch block will be directed to this special variable for the `finally` block
                            Variable: errVariable,
                            IsPresent: true,
                            Next: `throw`,
                          },
                        ],
                        Default: ASLGraph.DeferNext,
                      },
                      throw: throwTarget
                        ? {
                            Type: "Pass",
                            InputPath: errVariable,
                            ...throwTarget,
                          }
                        : {
                            Type: "Fail",
                            Error: "ReThrowFromFinally",
                            Cause:
                              "an error was re-thrown from a finally block which is unsupported by Step Functions",
                          },
                    },
                  };
                })()
              : undefined
          )!
        : undefined;

      return {
        startState: "try",
        node: stmt,
        states: {
          try: finallyState
            ? // if there is a finally, go there next
              ASLGraph.updateDeferredNextStates({ Next: "finally" }, tryState)
            : tryState,
          ...(catchClauseState
            ? {
                catch: finallyState
                  ? // if there is a finally, go there next
                    ASLGraph.updateDeferredNextStates(
                      { Next: "finally" },
                      catchClauseState
                    )
                  : catchClauseState,
              }
            : {}),
          ...(finallyState ? { finally: finallyState } : {}),
        },
      };
    } else if (isCatchClause(stmt)) {
      const _catch = this.evalStmt(stmt.block, returnPass) ?? {
        Type: "Pass",
        Next: ASLGraph.DeferNext,
      };
      const initialize = stmt.variableDecl
        ? this.evalDecl(stmt.variableDecl, {
            jsonPath: `$.${this.generatedNames.generateOrGet(stmt)}`,
          })
        : undefined;
      return ASLGraph.joinSubStates(stmt, initialize, _catch);
    } else if (isWhileStmt(stmt) || isDoStmt(stmt)) {
      const blockState = this.evalStmt(stmt.block, returnPass);
      if (!blockState) {
        throw new SynthError(
          ErrorCodes.Unexpected_Error,
          `a ${stmt.kindName} block must have at least one Stmt`
        );
      }
      return this.evalContextToSubState(stmt, (_, evalCondition) => {
        return {
          startState: "check",
          states: {
            check: {
              Type: "Choice",
              node: stmt.condition,
              Choices: [
                {
                  ...evalCondition(stmt.condition),
                  Next: "whenTrue",
                },
              ],
              Default: ASLGraph.DeferNext,
            },
            // return to check until complete
            whenTrue: ASLGraph.updateDeferredNextStates(
              { Next: "check" },
              blockState
            ),
            [ASL.ContinueNext]: {
              Type: "Pass",
              node: new ContinueStmt(emptySpan()),
              Next: "check",
            },
            [ASL.BreakNext]: {
              Type: "Pass",
              node: new BreakStmt(emptySpan()),
              Next: ASLGraph.DeferNext,
            },
          },
        };
      });
    } else if (isDebuggerStmt(stmt) || isEmptyStmt(stmt)) {
      return undefined;
    } else if (isLabelledStmt(stmt)) {
      return this.evalStmt(stmt.stmt, returnPass);
    } else if (isWithStmt(stmt)) {
      throw new SynthError(
        ErrorCodes.Unsupported_Feature,
        `with statements are not yet supported by ASL`
      );
    } else if (
      isSwitchStmt(stmt) ||
      isCaseClause(stmt) ||
      isDefaultClause(stmt)
    ) {
      // see: https://github.com/functionless/functionless/issues/306
      throw new SynthError(
        ErrorCodes.Unsupported_Feature,
        `switch statements are not yet supported in Step Functions, see https://github.com/functionless/functionless/issues/306`
      );
    }
    return assertNever(stmt);
  }

  /**
   * Recursively evaluate a single expression, building a single {@link ASLGraph.NodeResults} object.
   * All SubStates generated during evaluation will be merged into into a {@link ASLGraph.OutputSubState} along with the output
   * of the handler callback.
   *
   * @param expr - Expression to evaluate.
   * @param contextNode - Optional node to associate with the output state. This node may be used to name the resulting state.
   *                      Otherwise expr is used.
   * @param handler - A handler callback which received the {@link ASLGraph.Output} resolved from the expression.
   *                  This output will represent the constant or variable representing the output of the expression.
   *                  An `addState` callback is also provided to inject additional states into the graph.
   *                  The state will be joined (@see ASLGraph.joinSubStates ) with the previous and next states in the order received.
   */
  public evalExpr<T extends ASLGraph.NodeResults>(
    expr: Expr,
    handler: (output: ASLGraph.Output, context: EvalExprContext) => T
  ): T extends ASLGraph.OutputSubState
    ? ASLGraph.OutputSubState
    : ASLGraph.NodeResults;
  public evalExpr<T extends ASLGraph.NodeResults>(
    expr: Expr,
    contextNode: FunctionlessNode,
    handler: (output: ASLGraph.Output, context: EvalExprContext) => T
  ): T extends ASLGraph.OutputSubState
    ? ASLGraph.OutputSubState
    : ASLGraph.NodeResults;
  public evalExpr<T extends ASLGraph.NodeResults>(
    expr: Expr,
    nodeOrHandler:
      | FunctionlessNode
      | ((output: ASLGraph.Output, context: EvalExprContext) => T),
    maybeHandler?: (output: ASLGraph.Output, context: EvalExprContext) => T
  ): T extends ASLGraph.OutputSubState
    ? ASLGraph.OutputSubState
    : ASLGraph.NodeResults {
    const [node, handler] = isNode(nodeOrHandler)
      ? [nodeOrHandler, maybeHandler!]
      : [expr, nodeOrHandler];

    const [exprState, states] = this.evalExprBase<T>(expr, handler);

    const exprStateOutput = ASLGraph.getAslStateOutput(exprState);

    const joined = ASLGraph.joinSubStates(node, ...states, exprState);

    return (
      joined
        ? {
            ...joined,
            output: exprStateOutput,
          }
        : exprStateOutput
    ) as any;
  }

  /**
   * Recursively evaluate a single expression, building a single {@link ASLGraph.NodeResults} object.
   * All SubStates generated during evaluation will be merged into into a {@link ASLGraph.SubState}.
   *
   * @param expr - Expression to evaluate.
   * @param handler - A handler callback which receives the {@link ASLGraph.Output} resolved from the expression.
   *                  This output will represent the constant or variable representing the output of the expression.
   */
  private evalExprToSubState(
    expr: Expr,
    handler: (
      output: ASLGraph.Output,
      context: EvalExprContext
    ) => ASLGraph.SubState | ASLGraph.NodeState | undefined
  ): ASLGraph.SubState | ASLGraph.NodeState | undefined {
    const [exprState, states] = this.evalExprBase(expr, handler);

    return ASLGraph.joinSubStates(expr, ...states, exprState);
  }

  /**
   * evalExpr* functions provide a stateful closure that simplifies the evaluation
   * of an expression into {@link ASLGraph} states and {@link ASLGraph.Output}s.
   *
   * Unlike {@link eval} which requires manually joining of states, evalExpr* methods
   * maintain an array of that that we joined together at the end. They reduce control,
   * but reduce the work to generate valid ASLGraphs.
   */
  private evalExprBase<T>(
    expr: Expr,
    handler: (output: ASLGraph.Output, context: EvalExprContext) => T
  ): [T, (ASLGraph.SubState | ASLGraph.NodeState | undefined)[]] {
    // evaluate the expression, returning an output and optional state or substate(s)
    const state = this.eval(expr);
    // get the output from the evaluated expression state
    const output = ASLGraph.getAslStateOutput(state);

    // collect all intermediate states including the operation one(s) evaluated from the expression
    // additional states may be added by the caller using addState or normalizeOutputToJsonPath
    // these states will be returned to the caller to be joined together.
    const states: (ASLGraph.NodeState | ASLGraph.SubState)[] =
      ASLGraph.isStateOrSubState(state) ? [state] : [];

    // call the handler given by the caller with the output and helper functions
    const handlerOutput = handler(output, {
      // allows the user to add arbitrary states to the sequence of states
      addState: (state) => {
        states.push(state);
      },
      // normalizes the output into a json path, creating a Pass state to turn a constant into a jsonPath if needed.
      normalizeOutputToJsonPath: () => {
        if (ASLGraph.isJsonPath(output)) {
          return output;
        } else {
          const heap = this.newHeapVariable();

          states.push({
            ...ASLGraph.passWithInput(
              {
                Type: "Pass",
                ResultPath: heap,
                Next: ASLGraph.DeferNext,
              },
              output
            ),
            node: expr,
          });

          return {
            jsonPath: heap,
          };
        }
      },
    });

    // return the value generated by the handler and any intermediate states generated
    // by eval, `addState`, or `normalizeOutputToJsonPath`.
    return [handlerOutput, states];
  }

  /**
   * Provides a contextual `evalExpr` and `evalCondition` functions to the handler provided.
   * Any SubStates generated using the provided functions will be joined into a single {@link ASLGraph.OutputSubState}
   * with the output of the handler.
   *
   * All SubStates generated during evaluation will be merged into into a {@link ASLGraph.OutputSubState} along with the output
   * of the handler callback.
   *
   * @param expr - Expression to evaluate.
   * @param contextNode - Optional node to associate with the output state. This node may be used to name the resulting state.
   *                      Otherwise expr is used.
   * @param handler - A handler callback which receives the contextual `evalExpr` function. The out of this handler will be
   *                  joined with any SubStates created from the `evalExpr` function.
   */
  public evalContext<T extends ASLGraph.NodeResults>(
    contextNode: FunctionlessNode,
    handler: (
      evalExpr: (expr: Expr) => ASLGraph.Output,
      evalCondition: (expr: Expr) => Condition
    ) => T
  ): T extends ASLGraph.OutputSubState
    ? ASLGraph.OutputSubState
    : ASLGraph.NodeResults {
    const [handlerState, states] = this.evalContextBase(handler);
    const handlerStateOutput = ASLGraph.getAslStateOutput(handlerState);

    const joined = ASLGraph.joinSubStates(contextNode, ...states, handlerState);

    return (
      joined
        ? {
            ...joined,
            output: handlerStateOutput,
          }
        : handlerStateOutput
    ) as any;
  }

  /**
   * Internal method similar to {@link evalContext}.
   *
   * Unlike {@link evalContext}, this method does not return an output with the State or SubState.
   *
   * Used by the {@link evalStmt} cases which do not need an output (the output is determined by the stmt).
   *
   * @see evalContext for more details.
   */
  private evalContextToSubState(
    contextNode: FunctionlessNode,
    handler: (
      evalExpr: (expr: Expr) => ASLGraph.Output,
      evalCondition: (expr: Expr) => Condition
    ) => ASLGraph.SubState | ASLGraph.NodeState
  ): ASLGraph.SubState | ASLGraph.NodeState {
    const [handlerOut, states] = this.evalContextBase(handler);

    return ASLGraph.joinSubStates(contextNode, ...states, handlerOut)!;
  }

  /**
   * Base logic shared by {@link evalContext} and {@link evalContextToSubState}.
   *
   * @see evalContext for more details.
   */
  private evalContextBase<T>(
    handler: (
      evalExpr: (expr: Expr) => ASLGraph.Output,
      evalCondition: (expr: Expr) => Condition
    ) => T
  ): [T, (ASLGraph.SubState | ASLGraph.NodeState)[]] {
    const states: (ASLGraph.SubState | ASLGraph.NodeState)[] = [];
    const evalExpr = (expr: Expr) => {
      const state = this.eval(expr);
      const output = ASLGraph.getAslStateOutput(state);
      ASLGraph.isOutputStateOrSubState(state) && states.push(state);
      return output;
    };
    const evalCondition = (expr: Expr) => {
      const [cond, subState] = this.toCondition(expr);
      subState && states.push(subState);
      return cond;
    };

    return [handler(evalExpr, evalCondition), states];
  }

  /**
   * Evaluate an {@link Expr} to a single {@link State}.
   *
   * Method is private. External consumers should use use {@link evalContext} or {@link evalExpr}.
   *
   * @param expr the {@link Expr} to evaluate.
   * @param allowUndefined - when true, does not fail on undefined values. The resulting output literal may contain `value: undefined`.
   * @returns the {@link ASLGraph.Output} generated by an expression or an {@link ASLGraph.OutputSubState} with additional states and outputs.
   */
  private eval(
    expr: Expr | SuperKeyword,
    allowUndefined: boolean = false
  ): ASLGraph.NodeResults {
    if (isSuperKeyword(expr)) {
      throw new SynthError(
        ErrorCodes.Unsupported_Feature,
        "Step Functions does not support super."
      );
    }
    // first check to see if the expression can be turned into a constant.
    const constant = evalToConstant(expr);
    if (constant !== undefined) {
      const value = constant.constant;
      if (!allowUndefined && value === undefined) {
        throw new SynthError(
          ErrorCodes.Step_Functions_does_not_support_undefined,
          "Undefined literal is not supported"
        );
      }
      // manufacturing null can be difficult, just use our magic constant
      return value === null
        ? { jsonPath: this.context.null }
        : {
            value: value as any,
            containsJsonPath: false,
          };
    }

    if (isTemplateExpr(expr)) {
      return this.evalContext(expr, (evalExpr) => {
        const elementOutputs = [
          {
            value: expr.head.text,
            containsJsonPath: false,
          },
          ...expr.spans.flatMap((span) => [
            evalExpr(span.expr),
            {
              value: span.literal.text,
              containsJsonPath: false,
            },
          ]),
        ];

        /**
         * Step Functions `States.Format` has a bug which fails when a jsonPath does not start with a
         * alpha character.
         * https://twitter.com/sussmansa/status/1542777348616990720?s=20&t=2PepSKvzPhojs_x01WoQVQ
         *
         * For this edge case, we re-assign each json path to a heap variable and use the heap location
         * in the States.Format call to ensure we don't fail to deploy.
         */
        const jsonPaths = elementOutputs
          .filter(ASLGraph.isJsonPath)
          .map(({ jsonPath }) => jsonPath)
          .map((jp) =>
            jp.match(/\$\.[^a-zA-Z]/g) ? [jp, this.newHeapVariable()] : [jp, jp]
          );

        // generate any pass states to rewrite variables as needed
        // we expect this to only happen rarely
        const rewriteStates: Pass[] = jsonPaths
          .filter(([original, updated]) => original !== updated)
          .map(([original, updated]) => ({
            Type: "Pass",
            InputPath: original,
            ResultPath: updated,
            Next: ASLGraph.DeferNext,
          }));

        const tempHeap = this.newHeapVariable();

        return {
          ...ASLGraph.joinSubStates(expr, ...rewriteStates, {
            Type: "Pass",
            Parameters: {
              "string.$": `States.Format('${elementOutputs
                .map((output) =>
                  ASLGraph.isLiteralValue(output) ? output.value : "{}"
                )
                .join("")}',${jsonPaths.map(([, jp]) => jp)})`,
            },
            ResultPath: tempHeap,
            Next: ASLGraph.DeferNext,
          })!,
          output: {
            jsonPath: `${tempHeap}.string`,
          },
        };
      });
    } else if (isCallExpr(expr)) {
      const integration = tryFindIntegration(expr.expr);
      if (integration) {
        const serviceCall = new IntegrationImpl(integration);
        const integStates = serviceCall.asl(expr, this);

        if (
          ASLGraph.isLiteralValue(integStates) ||
          ASLGraph.isJsonPath(integStates)
        ) {
          return integStates;
        }

        const updateState = (state: ASLGraph.NodeState): ASLGraph.NodeState => {
          const throwOrPass = this.throw(expr);
          if (
            throwOrPass?.Next &&
            (isTaskState(state) ||
              isMapTaskState(state) ||
              isParallelTaskState(state))
          ) {
            return {
              ...state,
              Catch: [
                {
                  ErrorEquals: ["States.ALL"],
                  Next: throwOrPass.Next,
                  ResultPath: throwOrPass.ResultPath,
                },
              ],
            };
          } else {
            return state;
          }
        };

        const updateStates = (
          states: ASLGraph.NodeState | ASLGraph.SubState
        ): ASLGraph.NodeState | ASLGraph.SubState => {
          return ASLGraph.isSubState(states)
            ? {
                ...states,
                states: Object.fromEntries(
                  Object.entries(states.states ?? {}).map(
                    ([stateName, state]) => {
                      if (ASLGraph.isSubState(state)) {
                        return [stateName, updateStates(state)];
                      } else {
                        return [stateName, updateState(state)];
                      }
                    }
                  )
                ),
              }
            : updateState(states);
        };
        return {
          node: integStates.node,
          output: integStates.output,
          ...updateStates(integStates),
        };
      } else if (isMap(expr)) {
        return this.mapToStateOutput(expr);
      } else if (isForEach(expr)) {
        return this.forEachToStateOutput(expr);
      } else if (isSlice(expr)) {
        return this.sliceToStateOutput(expr);
      } else if (isFilter(expr)) {
        return this.filterToStateOutput(expr);
      } else if (isJoin(expr)) {
        return this.joinToStateOutput(expr);
      } else if (isPromiseAll(expr)) {
        const values = expr.args[0]?.expr;
        if (values) {
          return this.eval(values);
        }
        throw new SynthError(ErrorCodes.Unsupported_Use_of_Promises);
      } else if (
        isPropAccessExpr(expr.expr) &&
        isIdentifier(expr.expr.name) &&
        ((isIdentifier(expr.expr.expr) && expr.expr.expr.name === "JSON") ||
          (isReferenceExpr(expr.expr.expr) && expr.expr.expr.ref() === JSON)) &&
        (expr.expr.name.name === "stringify" || expr.expr.name.name === "parse")
      ) {
        const heap = this.newHeapVariable();

        const objParamExpr = expr.args[0]?.expr;
        if (!objParamExpr || isUndefinedLiteralExpr(objParamExpr)) {
          if (expr.expr.name.name === "stringify") {
            // return an undefined variable
            return {
              jsonPath: heap,
            };
          } else {
            throw new SynthError(
              ErrorCodes.Invalid_Input,
              "JSON.parse in a StepFunction must have a single, defined parameter."
            );
          }
        }

        return this.evalExpr(
          objParamExpr,
          (_, { normalizeOutputToJsonPath }) => {
            const objectPath = normalizeOutputToJsonPath().jsonPath;

            return {
              Type: "Pass",
              Parameters: {
                // intrinsic functions cannot be used in InputPath and some other json path locations.
                // We compute the value and place it on the heap.
                "string.$":
                  isPropAccessExpr(expr.expr) &&
                  isIdentifier(expr.expr.name) &&
                  expr.expr.name.name === "stringify"
                    ? `States.JsonToString(${objectPath})`
                    : `States.StringToJson(${objectPath})`,
              },
              ResultPath: heap,
              Next: ASLGraph.DeferNext,
              output: {
                jsonPath: `${heap}.string`,
              },
            };
          }
        );
      }
      throw new Error(
        `call must be a service call or list .slice, .map, .forEach or .filter: ${nodeToString(
          expr
        )}`
      );
    } else if (isVariableReference(expr)) {
      if (isIdentifier(expr)) {
        const ref = expr.lookup();
        /**
         * Support the optional second parameter context reference.
         * async (input, context) => return context;
         *
         * context -> '$$'
         */
        if (
          ref &&
          isParameterDecl(ref) &&
          isFunctionLike(ref.parent) &&
          ref.parent === this.decl &&
          ref.parent.parameters[1] === ref
        ) {
          return { jsonPath: `$$` };
        }
        return { jsonPath: `$.${this.getIdentifierName(expr)}` };
      } else if (isPropAccessExpr(expr)) {
        if (isSuperKeyword(expr.expr)) {
          throw new SynthError(
            ErrorCodes.Unsupported_Feature,
            "Step Functions does not support super."
          );
        }
        if (isIdentifier(expr.name)) {
          return this.evalExpr(expr.expr, (output) => {
            return this.accessConstant(output, expr.name.name, false);
          });
        } else {
          throw new SynthError(ErrorCodes.Classes_are_not_supported);
        }
      } else if (isElementAccessExpr(expr)) {
        return this.elementAccessExprToJsonPath(expr);
      }
      assertNever(expr);
    } else if (isObjectLiteralExpr(expr)) {
      return this.evalContext(expr, (evalExpr) => {
        return expr.properties.reduce(
          (obj: ASLGraph.LiteralValue, prop) => {
            if (!isPropAssignExpr(prop)) {
              throw new Error(
                `${prop.kindName} is not supported in Amazon States Language`
              );
            }
            if (
              (isComputedPropertyNameExpr(prop.name) &&
                isStringLiteralExpr(prop.name.expr)) ||
              isIdentifier(prop.name) ||
              isStringLiteralExpr(prop.name)
            ) {
              const name = isIdentifier(prop.name)
                ? prop.name.name
                : isStringLiteralExpr(prop.name)
                ? prop.name.value
                : isStringLiteralExpr(prop.name.expr)
                ? prop.name.expr.value
                : undefined;
              if (!name) {
                throw new SynthError(
                  ErrorCodes.StepFunctions_property_names_must_be_constant
                );
              }
              const valueOutput = evalExpr(prop.expr);
              return {
                value: {
                  ...(obj.value as Record<string, any>),
                  ...this.toJsonAssignment(name, valueOutput),
                },
                containsJsonPath:
                  obj.containsJsonPath ||
                  ASLGraph.isJsonPath(valueOutput) ||
                  valueOutput.containsJsonPath,
              };
            } else {
              throw new SynthError(
                ErrorCodes.StepFunctions_property_names_must_be_constant
              );
            }
          },
          {
            value: {},
            containsJsonPath: false,
          }
        );
      });
    } else if (isArrayLiteralExpr(expr)) {
      return this.evalContext(expr, (evalExpr) => {
        // evaluate each item
        const items = expr.items.map((item) => {
          if (isOmittedExpr(item)) {
            throw new SynthError(
              ErrorCodes.Step_Functions_does_not_support_undefined,
              `omitted expressions in an array create an undefined value which cannot be represented in Step Functions`
            );
          }
          return evalExpr(item);
        });
        const heapLocation = this.newHeapVariable();

        return {
          Type: "Pass",
          Parameters: {
            "arr.$": `States.Array(${items
              .map((item) =>
                ASLGraph.isJsonPath(item)
                  ? item.jsonPath
                  : typeof item.value === "string"
                  ? `'${item.value}'`
                  : item.value
              )
              .join(", ")})`,
          },
          ResultPath: heapLocation,
          Next: ASLGraph.DeferNext,
          node: expr,
          output: {
            jsonPath: `${heapLocation}.arr`,
          },
        };
      });
    } else if (isLiteralExpr(expr)) {
      return {
        value: expr.value ?? null,
        containsJsonPath: false,
      };
    } else if (isUnaryExpr(expr) || isPostfixUnaryExpr(expr)) {
      if (expr.op === "!") {
        const constant = evalToConstant(expr);
        if (constant !== undefined) {
          return {
            value: constant,
            containsJsonPath: false,
          };
        } else {
          return this.evalContext(expr, (_, evalCondition) => {
            const cond = evalCondition(expr);
            return this.conditionState(cond);
          });
        }
      } else if (
        expr.op === "-" ||
        expr.op === "++" ||
        expr.op === "--" ||
        expr.op === "~" ||
        expr.op === "+"
      ) {
        throw new SynthError(
          ErrorCodes.Cannot_perform_arithmetic_or_bitwise_computations_on_variables_in_Step_Function,
          `Step Function does not support operator ${expr.op}`
        );
      }
      assertNever(expr.op);
    } else if (isBinaryExpr(expr)) {
      const constant = evalToConstant(expr);
      if (constant !== undefined) {
        return {
          value: constant,
          containsJsonPath: false,
        };
      } else if (
        expr.op === "&&" ||
        expr.op === "||" ||
        expr.op === "===" ||
        expr.op === "==" ||
        expr.op == "!=" ||
        expr.op == "!==" ||
        expr.op == ">" ||
        expr.op == "<" ||
        expr.op == ">=" ||
        expr.op == "<=" ||
        expr.op == "in"
      ) {
        return this.evalContext(expr, (_, evalCondition) => {
          const cond = evalCondition(expr);
          return this.conditionState(cond);
        });
      } else if (expr.op === "??") {
        return this.evalContext(expr, (evalExpr) => {
          const left = evalExpr(expr.left);
          const right = evalExpr(expr.right);
          // literal ?? anything
          if (ASLGraph.isLiteralValue(left)) {
            if (!left.value) {
              return left;
            } else {
              return right;
            }
          }
          const tempHeap = this.newHeapVariable();
          return {
            startState: "default",
            node: expr,
            states: {
              default: {
                Type: "Choice",
                Choices: [
                  {
                    ...ASL.and(
                      ASL.isPresent(left.jsonPath),
                      ASL.isNotNull(left.jsonPath)
                    ),
                    Next: "takeLeft",
                  },
                ],
                Default: "takeRight",
              },
              takeLeft: {
                Type: "Pass",
                InputPath: left.jsonPath,
                ResultPath: tempHeap,
                Next: ASLGraph.DeferNext,
              },
              takeRight: ASLGraph.passWithInput(
                {
                  Type: "Pass",
                  ResultPath: tempHeap,
                  Next: ASLGraph.DeferNext,
                },
                right
              ),
            },
            output: {
              jsonPath: tempHeap,
            },
          };
        });
      } else if (expr.op === "=") {
        if (!isVariableReference(expr.left)) {
          throw new SynthError(
            ErrorCodes.Unexpected_Error,
            "Expected left side of assignment to be a variable."
          );
        }
        return this.evalContext(expr, (evalExpr) => {
          const right = evalExpr(expr.right);
          const left = evalExpr(expr.left);

          if (!ASLGraph.isJsonPath(left)) {
            throw new SynthError(
              ErrorCodes.Unexpected_Error,
              `Expected assignment to target a variable, found: ${left.value}`
            );
          }

          return {
            ...ASLGraph.passWithInput(
              {
                Type: "Pass",
                ResultPath: left.jsonPath,
                Next: ASLGraph.DeferNext,
              },
              right
            ),
            output: left,
          };
        });
      } else if (expr.op === ",") {
        return this.evalContext(expr, (evalExpr) => {
          // eval left and discard the result
          evalExpr(expr.left);
          // eval right and return the result
          return evalExpr(expr.right);
        });
      } else if (
        expr.op === "+" ||
        expr.op === "-" ||
        expr.op === "*" ||
        expr.op === "/" ||
        expr.op === "%" ||
        expr.op === "+=" ||
        expr.op === "-=" ||
        expr.op === "*=" ||
        expr.op === "/=" ||
        expr.op === "%=" ||
        expr.op === "&" ||
        expr.op === "&&=" ||
        expr.op === "&=" ||
        expr.op === "**" ||
        expr.op === "**=" ||
        expr.op === "<<" ||
        expr.op === "<<=" ||
        expr.op === ">>" ||
        expr.op === ">>=" ||
        expr.op === ">>>" ||
        expr.op === ">>>=" ||
        expr.op === "^" ||
        expr.op === "^=" ||
        expr.op === "|" ||
        expr.op === "|="
      ) {
        // TODO: support string concat - https://github.com/functionless/functionless/issues/330
        throw new SynthError(
          ErrorCodes.Cannot_perform_arithmetic_or_bitwise_computations_on_variables_in_Step_Function,
          `Step Function does not support operator ${expr.op}`
        );
      } else if (
        expr.op === "instanceof" ||
        // https://github.com/functionless/functionless/issues/393
        expr.op === "??=" ||
        expr.op === "||="
      ) {
        throw new SynthError(
          ErrorCodes.Unsupported_Feature,
          `Step Function does not support ${expr.op} operator`
        );
      }
      assertNever(expr.op);
    } else if (isAwaitExpr(expr)) {
      return this.eval(expr.expr);
    } else if (isTypeOfExpr(expr)) {
      return this.evalExpr(expr.expr, (exprOutput) => {
        if (ASLGraph.isLiteralValue(exprOutput)) {
          return {
            value: typeof exprOutput.value,
            containsJsonPath: false,
          };
        }

        const tempHeap = this.newHeapVariable();

        return {
          startState: "choose",
          states: {
            choose: {
              Type: "Choice",
              Choices: [
                {
                  ...ASL.and(
                    ASL.isPresent(exprOutput.jsonPath),
                    ASL.isString(exprOutput.jsonPath)
                  ),
                  Next: "string",
                },
                {
                  ...ASL.and(
                    ASL.isPresent(exprOutput.jsonPath),
                    ASL.isBoolean(exprOutput.jsonPath)
                  ),
                  Next: "boolean",
                },
                {
                  ...ASL.and(
                    ASL.isPresent(exprOutput.jsonPath),
                    ASL.isNumeric(exprOutput.jsonPath)
                  ),
                  Next: "number",
                },
                {
                  ...ASL.isPresent(exprOutput.jsonPath),
                  Next: "object",
                },
              ],
              Default: "undefined",
            },
            string: {
              Type: "Pass",
              Result: "string",
              ResultPath: tempHeap,
              Next: ASLGraph.DeferNext,
            },
            boolean: {
              Type: "Pass",
              Result: "boolean",
              ResultPath: tempHeap,
              Next: ASLGraph.DeferNext,
            },
            number: {
              Type: "Pass",
              Result: "number",
              ResultPath: tempHeap,
              Next: ASLGraph.DeferNext,
            },
            object: {
              Type: "Pass",
              Result: "object",
              ResultPath: tempHeap,
              Next: ASLGraph.DeferNext,
            },
            undefined: {
              Type: "Pass",
              Result: "undefined",
              ResultPath: tempHeap,
              Next: ASLGraph.DeferNext,
            },
          },
          output: {
            jsonPath: tempHeap,
          },
        };
      });
    } else if (isConditionExpr(expr)) {
      return this.evalContext(expr, (_, evalCondition) => {
        const cond = evalCondition(expr.when);

        /* use `this.eval` instead of the evalContext's evalExpr so that the states for left and right are not hoisted before the condition is evaluated
           statesForCondition
           Choice(cond)
              true ->
                states for left
                left
              false ->
                states for false
                right
            return output of left or right
        */
        const left = this.eval(expr.then);
        const right = this.eval(expr._else);
        const outputVar = this.newHeapVariable();

        const computeAndAssign = (
          result: ASLGraph.NodeResults
        ): ASLGraph.NodeState | ASLGraph.SubState => {
          return ASLGraph.isJsonPath(result) || ASLGraph.isLiteralValue(result)
            ? // if there is only an output and no additional states, just assign and continue
              ASLGraph.passWithInput(
                {
                  Type: "Pass",
                  ResultPath: outputVar,
                  Next: ASLGraph.DeferNext,
                },
                result
              )
            : // if there are some returned states with the output reference, run the states and then assign the output value
              {
                startState: "compute",
                states: {
                  compute: ASLGraph.updateDeferredNextStates(
                    { Next: "assign" },
                    result
                  ),
                  assign: ASLGraph.passWithInput(
                    {
                      Type: "Pass",
                      ResultPath: outputVar,
                      Next: ASLGraph.DeferNext,
                    },
                    ASLGraph.getAslStateOutput(result)
                  ),
                },
              };
        };

        return {
          startState: "default",
          states: {
            default: {
              Type: "Choice",
              Choices: [{ ...cond, Next: "doTrue" }],
              Default: "doFalse",
            },
            doTrue: computeAndAssign(left),
            doFalse: computeAndAssign(right),
          },
          output: {
            jsonPath: outputVar,
          },
        };
      });
    } else if (isParenthesizedExpr(expr)) {
      return this.eval(expr.expr);
    }
    throw new Error(`cannot eval expression kind '${expr.kindName}'`);
  }

  /**
   * Returns an object containing Pass/Task parameters values to clone the current lexical scope into
   * another scope, like a Map state.
   *
   * ```ts
   * {
   *    'a.$': '$.a'
   * }
   * ```
   */
  public cloneLexicalScopeParameters(
    node: FunctionlessNode
  ): Record<string, string> {
    const parentStmt = isStmt(node) ? node : node.findParent(isStmt);
    const variableReferences =
      (parentStmt?.prev ?? parentStmt?.parent)?.getLexicalScope() ??
      new Map<string, BindingDecl>();
    return {
      [`${FUNCTIONLESS_CONTEXT_NAME}.$`]: FUNCTIONLESS_CONTEXT_JSON_PATH,
      ...Object.fromEntries(
        Array.from(variableReferences.values())
          .map((decl) =>
            // assume there is an identifier name if it is in the lexical scope
            this.getDeclarationName(decl as BindingDecl & { name: Identifier })
          )
          .map((name) => [`${name}.$`, `$.${name}`])
      ),
    };
  }

  /**
   * @param element - when true (or field is a number) the output json path will prefer to use the square bracket format.
   *                  `$.obj[field]`. When false will prefer the dot format `$.obj.field`.
   */
  private accessConstant(
    value: ASLGraph.Output,
    field: string | number,
    element: boolean
  ): ASLGraph.Output {
    if (ASLGraph.isJsonPath(value)) {
      return typeof field === "number"
        ? { jsonPath: `${value.jsonPath}[${field}]` }
        : element
        ? { jsonPath: `${value.jsonPath}['${field}']` }
        : { jsonPath: `${value.jsonPath}.${field}` };
    }

    if (value.value) {
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

  /**
   * Helper that generates an {@link ASLGraph.OutputState} which returns null.
   */
  public stateWithVoidOutput(
    state: State | ASLGraph.SubState
  ): ASLGraph.OutputSubState | ASLGraph.OutputState {
    return {
      ...state,
      output: {
        jsonPath: this.context.null,
      },
    };
  }

  /**
   * Helper that generates an {@link ASLGraph.OutputState} which returns a value to a temporary location.
   *
   * Updates (immutably) a {@link ASLGraph.NodeState} to contain a new heap location result path.
   * The new heap location is returned an a {@link ASLGraph.JsonPath} output.
   */
  public stateWithHeapOutput(
    state: Exclude<ASLGraph.NodeState, Choice | Fail | Succeed | Wait>,
    node?: FunctionlessNode
  ): ASLGraph.NodeState & { output: ASLGraph.JsonPath } {
    const tempHeap = this.newHeapVariable();
    return {
      ...state,
      node,
      ResultPath: tempHeap,
      output: {
        jsonPath: tempHeap,
      },
    };
  }

  public conditionState(cond: Condition): ASLGraph.OutputSubState {
    const tempHeap = this.newHeapVariable();
    return {
      startState: "default",
      states: {
        default: {
          Type: "Choice",
          Choices: [{ ...cond, Next: "assignTrue" }],
          Default: "assignFalse",
        },
        assignTrue: {
          Type: "Pass",
          Result: true,
          ResultPath: tempHeap,
          Next: ASLGraph.DeferNext,
        },
        assignFalse: {
          Type: "Pass",
          Result: false,
          ResultPath: tempHeap,
          Next: ASLGraph.DeferNext,
        },
      },
      output: {
        jsonPath: tempHeap,
      },
    };
  }

  /**
   * Mutable heap counter.
   */
  private heapCounter = 0;

  /**
   * returns an in order unique memory location in the form `$.heap[id]`
   * TODO: make this contextual - https://github.com/functionless/functionless/issues/321
   */
  public newHeapVariable() {
    return `$.${this.newHeapVariableName()}`;
  }

  /**
   * returns an in order unique memory location in the form `heap[id]`
   * TODO: make this contextual - https://github.com/functionless/functionless/issues/321
   */
  public newHeapVariableName() {
    return `heap${this.heapCounter++}`;
  }

  /**
   * Find the transition edge from this {@link node} to the State which will handle
   * the error.
   *
   * @param node
   * @returns `undefined` if the error is terminal, otherwise a Next, ResultPath
   */
  public throw(node: FunctionlessNode):
    | {
        /**
         * Name of the state to transition to.
         */
        Next: string;
        /**
         * JSON Path to store the the error payload.
         */
        ResultPath: string | null;
      }
    | undefined {
    // detect the immediate for-loop closure surrounding this throw statement
    // because of how step function's Catch feature works, we need to check if the try
    // is inside or outside the closure
    const mapOrParallelClosure = node.findParent(isFunctionLike);

    // catchClause or finallyBlock that will run upon throwing this error
    const catchOrFinally = node.throw();
    if (catchOrFinally === undefined) {
      // error is terminal
      return undefined;
    } else if (
      mapOrParallelClosure === undefined ||
      // TODO: this implementation is specific to the current state. Try/Catch/Finally needs to be generalize based on the generated ASL, not the AST.
      // https://github.com/functionless/functionless/issues/385
      (isArgument(mapOrParallelClosure.parent) &&
        isCallExpr(mapOrParallelClosure.parent.parent) &&
        isPropAccessExpr(mapOrParallelClosure.parent.parent.expr) &&
        (mapOrParallelClosure.parent.parent.expr.name.name === "map" ||
          mapOrParallelClosure.parent.parent.expr.name.name === "filter" ||
          mapOrParallelClosure.parent.parent.expr.name.name === "forEach") &&
        !isReferenceExpr(mapOrParallelClosure.parent.parent.expr.expr)) ||
      mapOrParallelClosure.contains(catchOrFinally)
    ) {
      // the catch/finally handler is nearer than the surrounding Map/Parallel State
      return {
        Next: ASL.CatchState,
        ResultPath: (() => {
          if (
            (isCatchClause(catchOrFinally) && catchOrFinally.variableDecl) ||
            (isBlockStmt(catchOrFinally) &&
              catchOrFinally.isFinallyBlock() &&
              catchOrFinally.parent.catchClause &&
              canThrow(catchOrFinally.parent.catchClause) &&
              // we only store the error thrown from the catchClause if the finallyBlock is not terminal
              // by terminal, we mean that every branch returns a value - meaning that the re-throw
              // behavior of a finally will never be triggered - the return within the finally intercepts it
              !catchOrFinally.isTerminal())
          ) {
            return `$.${this.generatedNames.generateOrGet(catchOrFinally)}`;
          } else {
            return null;
          }
        })(),
      };
    } else {
      // the Map/Parallel tasks are closer than the catch/finally, so we use a Fail State
      // to terminate the Map/Parallel and delegate the propagation of the error to the
      // Map/Parallel state
      return undefined;
    }
  }

  /**
   * Process a `array.slice()` expression and output the jsonPath or constant value.
   */
  private sliceToStateOutput(
    expr: CallExpr & { expr: PropAccessExpr }
  ): ASLGraph.NodeResults {
    const startArg = expr.args[0]?.expr;
    const endArg = expr.args[1]?.expr;

    const value = this.eval(expr.expr.expr);
    const valueOutput = ASLGraph.getAslStateOutput(value);
    if (startArg === undefined && endArg === undefined) {
      // .slice()
      return value;
    } else if (startArg !== undefined) {
      const startConst = evalToConstant(startArg)?.constant;
      if (startConst === undefined || typeof startConst !== "number") {
        throw new Error(
          "the 'start' argument of slice must be a literal number"
        );
      }
      const endConst = endArg ? evalToConstant(endArg) : undefined;
      if (
        endConst?.constant !== undefined &&
        typeof endConst.constant !== "number"
      ) {
        throw new Error("the 'end' argument of slice must be a literal number");
      }

      if (ASLGraph.isJsonPath(valueOutput)) {
        if (!endConst || typeof endConst.constant === "undefined") {
          return ASLGraph.updateAslStateOutput(value, {
            jsonPath: `${valueOutput.jsonPath}[${startConst}:]`,
          });
        } else {
          return ASLGraph.updateAslStateOutput(value, {
            jsonPath: `${valueOutput.jsonPath}[${startConst}:${endConst.constant}]`,
          });
        }
      } else if (Array.isArray(valueOutput.value)) {
        return ASLGraph.updateAslStateOutput(value, {
          ...valueOutput,
          value: valueOutput.value.slice(startConst, endConst?.constant),
        });
      }
      throw new SynthError(
        ErrorCodes.Unexpected_Error,
        "Expected slice to be performed on a variable or array constant"
      );
    } else if (endArg !== undefined) {
      throw new Error(
        `impossible expression, slice called with end defined without startArg`
      );
    } else {
      throw new Error(
        `impossible expression, slice called with unknown arguments`
      );
    }
  }

  /**
   * Turns a call to `.join` on an array into a {@link ASLGraph.SubState}.
   *
   * If both the array and the separator argument are constant, just run .join and return the results.
   *
   * Otherwise, create a state machine that iterates over all elements of the array at runtime and creates a new
   * string with the separator between elements.
   */
  private joinToStateOutput(
    expr: CallExpr & { expr: PropAccessExpr }
  ): ASLGraph.NodeResults {
    return this.evalContext(expr, (evalExpr) => {
      if (isSuperKeyword(expr.expr.expr)) {
        throw new SynthError(
          ErrorCodes.Unsupported_Feature,
          "Step Functions does not support super."
        );
      }
      const separatorArg = expr.args[0]?.expr;
      const valueOutput = evalExpr(expr.expr.expr);
      const separatorOutput = separatorArg ? evalExpr(separatorArg) : undefined;
      const separator =
        separatorOutput &&
        (ASLGraph.isJsonPath(separatorOutput) ||
          separatorOutput.value !== undefined)
          ? separatorOutput
          : // default to `,`
            { value: ",", containsJsonPath: false };

      if (
        ASLGraph.isLiteralValue(valueOutput) &&
        !Array.isArray(valueOutput.value)
      ) {
        throw new SynthError(
          ErrorCodes.Unexpected_Error,
          "Expected join to be performed on a variable or array constant"
        );
      }

      if (
        ASLGraph.isLiteralValue(separator) &&
        typeof separator.value !== "string"
      ) {
        throw new SynthError(
          ErrorCodes.Unexpected_Error,
          "Expected join separator to be missing, undefined, a string, or a variable"
        );
      }

      // both are constants, evaluate them here.
      if (
        ASLGraph.isLiteralValue(valueOutput) &&
        ASLGraph.isLiteralValue(separator)
      ) {
        return {
          value: (<any[]>valueOutput.value).join(<string>separator.value),
          containsJsonPath: false,
        };
      }

      const arrayPath = this.newHeapVariable();
      const resultVariable = this.newHeapVariable();

      return {
        startState: "initArray",
        states: {
          // put the constant or variable array in a new temp json path
          initArray: ASLGraph.passWithInput(
            {
              Type: "Pass",
              ResultPath: arrayPath,
              Next: "hasNext",
            },
            valueOutput
          ),
          hasNext: {
            Type: "Choice",
            Choices: [
              // not initialized and has next: init as first element
              {
                ...ASL.and(
                  ASL.isPresent(`${arrayPath}[0]`),
                  ASL.not(ASL.isPresent(resultVariable))
                ),
                Next: "initValue",
              },
              // not initialized, but the array is empty
              {
                ...ASL.and(
                  ASL.not(ASL.isPresent(`${arrayPath}[0]`)),
                  ASL.not(ASL.isPresent(resultVariable))
                ),
                Next: "returnEmpty",
              },
              // already initialized, there are items left
              { ...ASL.isPresent(`${arrayPath}[0]`), Next: "append" },
            ],
            // nothing left to do, return the accumulated string
            Default: "done",
          },
          // place the first value on the output
          initValue: {
            Type: "Pass",
            InputPath: `${arrayPath}[0]`,
            ResultPath: `${resultVariable}.string`,
            // update the temp array
            Next: "tail",
          },
          // append the current string to the separator and the head of the array
          append: {
            Type: "Pass",
            Parameters: {
              "string.$": ASLGraph.isJsonPath(separator)
                ? `States.Format('{}{}{}', ${resultVariable}.string, ${separator.jsonPath}, ${arrayPath}[0])`
                : `States.Format('{}${separator.value}{}', ${resultVariable}.string, ${arrayPath}[0])`,
            },
            ResultPath: resultVariable,
            // update the temp array
            Next: "tail",
          },
          // update the temp array and then check to see if there is more to do
          tail: {
            Type: "Pass",
            InputPath: `${arrayPath}[1:]`,
            ResultPath: arrayPath,
            Next: "hasNext", // restart by checking for items after tail
          },
          // empty array, return `''`
          returnEmpty: {
            Type: "Pass",
            Result: "",
            ResultPath: `${resultVariable}.string`,
            Next: ASLGraph.DeferNext,
          },
          // nothing left to do, this state will likely get optimized out, but it gives us a target
          done: {
            Type: "Pass",
            Next: ASLGraph.DeferNext,
          },
        },
        output: {
          jsonPath: `${resultVariable}.string`,
        },
      };
    });
  }

  /**
   * Returns a object with the key formatted based on the contents of the value.
   * in ASL, object keys that reference json path values must have a suffix of ".$"
   * { "input.$": "$.value" }
   */
  public toJsonAssignment(
    key: string,
    output: ASLGraph.Output
  ): Record<string, any> {
    return {
      [ASLGraph.isJsonPath(output) ? `${key}.$` : key]: ASLGraph.isLiteralValue(
        output
      )
        ? output.value
        : output.jsonPath,
    };
  }

  private filterToStateOutput(
    expr: CallExpr & { expr: PropAccessExpr }
  ): ASLGraph.NodeResults {
    const predicate = expr.args[0]?.expr;
    if (!isFunctionLike(predicate)) {
      throw new SynthError(
        ErrorCodes.Invalid_Input,
        `the 'predicate' argument of filter must be a function or arrow expression, found: ${predicate?.kindName}`
      );
    }
    if (isSuperKeyword(expr.expr.expr)) {
      throw new SynthError(
        ErrorCodes.Unsupported_Feature,
        "Step Functions does not support super."
      );
    }

    return this.evalExpr(
      expr.expr.expr,
      (leftOutput, { normalizeOutputToJsonPath }) => {
        if (
          !ASLGraph.isJsonPath(leftOutput) &&
          !Array.isArray(leftOutput.value)
        ) {
          throw new SynthError(
            ErrorCodes.Unexpected_Error,
            "Expected filter to be called on a literal array or reference to one."
          );
        }

        const varRef = normalizeOutputToJsonPath();

        return (
          this.filterToJsonPath(varRef, predicate) ?? {
            node: expr,
            ...this.filterToASLGraph(varRef, predicate),
          }
        );
      }
    );
  }

  /**
   * Attempt to compile filter to JSONPath. If possible, this is the most efficient way to filter.
   *
   * When not possible, undefined is returned.
   */
  private filterToJsonPath(
    valueJsonPath: ASLGraph.JsonPath,
    predicate: FunctionExpr | ArrowFunctionExpr
  ): ASLGraph.JsonPath | undefined {
    const stmt = predicate.body.statements[0];
    if (
      stmt === undefined ||
      !isReturnStmt(stmt) ||
      predicate.body.statements.length !== 1
    ) {
      return undefined;
    }

    const toFilterCondition = (expr: Expr): string | undefined => {
      const constant = evalToConstant(expr);
      if (constant) {
        if (typeof constant.constant === "string") {
          // strings are wrapped with '' in the filter expression.
          // Escape existing quotes to avoid issues.
          return `'${constant.constant.replace(/'/g, "\\'")}'`;
        }
        if (
          typeof constant.constant === "object" &&
          constant.constant !== null
        ) {
          // try to compile with ASLGraph instead
          return undefined;
        } else {
          return `${constant.constant}`;
        }
      } else if (isBinaryExpr(expr)) {
        const left = toFilterCondition(expr.left);
        const right = toFilterCondition(expr.right);
        return left && right
          ? `${left}${
              expr.op === "===" ? "==" : expr.op === "!==" ? "!=" : expr.op
            }${right}`
          : undefined;
      } else if (isUnaryExpr(expr)) {
        const right = toFilterCondition(expr.expr);
        return right ? `${expr.op}${right}` : undefined;
      } else if (isIdentifier(expr)) {
        const ref = expr.lookup();
        if (ref === undefined) {
          // try to compile with ASLGraph instead
          return undefined;
        }
        if (
          (isParameterDecl(ref) || isBindingElem(ref)) &&
          ref.findParent(
            (parent): parent is typeof predicate => parent === predicate
          )
        ) {
          return resolveRef(ref);
        } else {
          return `$.${(<Identifier>expr).name}`;
        }
        function resolveRef(
          ref: ParameterDecl | BindingElem
        ): string | undefined {
          if (isParameterDecl(ref)) {
            if (ref === predicate.parameters[0]) {
              return "@";
            }
            return undefined;
          } else {
            const value = resolveRef(
              ref.parent.parent as unknown as ParameterDecl | BindingElem
            );

            // if undefined, try to compile with ASL Graph
            if (!value) {
              return value;
            }

            if (isArrayBinding(ref.parent)) {
              return `${value}[${ref.parent.bindings.indexOf(ref)}]`;
            }

            const propName = ref.propertyName
              ? isIdentifier(ref.propertyName)
                ? ref.propertyName.name
                : isStringLiteralExpr(ref.propertyName)
                ? ref.propertyName.value
                : evalToConstant(ref.propertyName)?.constant
              : isIdentifier(ref.name)
              ? ref.name.name
              : undefined;

            if (!propName) {
              // step function does not support variable property accessors
              // this will probably fail in the filter to ASLGraph implementation too
              // however, lets let ASLGraph try and fail if needed.
              return undefined;
            }

            return `${value}['${propName}']`;
          }
        }
      } else if (isPropAccessExpr(expr)) {
        if (isSuperKeyword(expr.expr)) {
          throw new SynthError(
            ErrorCodes.Unsupported_Feature,
            "Step Functions does not support super."
          );
        }
        const value = toFilterCondition(expr.expr);
        return value ? `${value}.${expr.name.name}` : undefined;
      } else if (isElementAccessExpr(expr)) {
        const field = this.assertElementAccessConstant(
          ASLGraph.getAslStateOutput(this.eval(expr.element))
        );

        const value = toFilterCondition(expr.expr);

        return value
          ? `${value}[${typeof field === "number" ? field : `'${field}'`}]`
          : undefined;
      }

      // try to compile with ASLGraph instead
      return undefined;
    };

    const expression = toFilterCondition(
      stmt.expr ?? stmt.fork(new NullLiteralExpr(stmt.span))
    );
    return expression
      ? {
          jsonPath: `${valueJsonPath.jsonPath}[?(${expression})]`,
        }
      : undefined;
  }

  /**
   * filter an array using ASLGraph. Should support any logic that returns a boolean already supported by Functionless Step Functions.
   *
   * Note: If possible, try to use {@link filterToJsonPath} as it introduces no new state transitions.
   */
  private filterToASLGraph(
    valueJsonPath: ASLGraph.JsonPath,
    predicate: FunctionExpr | ArrowFunctionExpr
  ): ASLGraph.OutputSubState {
    return this.iterateArrayMethod(
      predicate,
      valueJsonPath.jsonPath,
      false,
      // initialize the arrStr to [null
      {
        arrStr: "[null",
      },
      // customize the default result handling logic by:
      // 1. check the returned predicate (iterationResult)
      // 2. if true, append the original item (itemJsonPath) to the `arrStr` initialized above.
      // 3. return over the `resultPath`
      ({
        iterationResult,
        itemJsonPath,
        tailStateName,
        tailJsonPath,
        tailTarget,
        workingSpaceJsonPath,
      }) => {
        return {
          startState: "checkPredicate",
          states: {
            checkPredicate: {
              Type: "Choice",
              Choices: [
                { ...ASL.isTruthy(iterationResult), Next: "predicateTrue" },
              ],
              Default: tailStateName,
            },
            // tail and append
            predicateTrue: {
              Type: "Pass",
              Parameters: {
                // tail
                [`${tailTarget}.$`]: tailJsonPath,
                // const arrStr = `${arrStr},${JSON.stringify(arr[0])}`;
                "arrStr.$": `States.Format('{},{}', ${workingSpaceJsonPath}.arrStr, States.JsonToString(${itemJsonPath}))`,
              },
              // write over the current working space
              ResultPath: workingSpaceJsonPath,
              Next: ASLGraph.DeferNext,
            },
          },
        };
      },
      // handle the end of the iteration.
      // 1. turn the array string into an array
      // 2. assign to the working variable json path (which is also the return value)
      (workingJsonPath) => {
        return {
          startState: "format",
          states: {
            format: {
              Type: "Pass",
              // filterResult = { result: JSON.parse(filterResult.arrStr + "]") }
              Parameters: {
                // cannot use intrinsic functions in InputPath or Result
                "result.$": `States.StringToJson(States.Format('{}]', ${workingJsonPath}.arrStr))`,
              },
              ResultPath: workingJsonPath,
              Next: "set",
            },
            // filterResult = filterResult.result
            set: {
              Type: "Pass",
              // the original array is initialized with a leading null to simplify the adding of new values to the array string "[null"+",{new item}"+"]"
              InputPath: `${workingJsonPath}.result[1:]`,
              ResultPath: workingJsonPath,
              Next: ASLGraph.DeferNext,
            },
          },
        };
      }
    );
  }

  private mapToStateOutput(
    expr: CallExpr & {
      expr: PropAccessExpr;
    }
  ) {
    const callbackfn = expr.args[0]?.expr;
    if (!isFunctionLike(callbackfn)) {
      throw new SynthError(
        ErrorCodes.Invalid_Input,
        `the 'callback' argument of map must be a function or arrow expression, found: ${callbackfn?.kindName}`
      );
    }
    if (isSuperKeyword(expr.expr.expr)) {
      throw new SynthError(
        ErrorCodes.Unsupported_Feature,
        "Step Functions does not support super."
      );
    }
    return this.evalExpr(
      expr.expr.expr,
      (listOutput, { normalizeOutputToJsonPath }) => {
        // we assume that an array literal or a call would return a variable.
        if (
          ASLGraph.isLiteralValue(listOutput) &&
          !Array.isArray(listOutput.value)
        ) {
          throw new SynthError(
            ErrorCodes.Unexpected_Error,
            "Expected input to map to be a variable reference or array"
          );
        }

        return this.iterateArrayMethod(
          callbackfn,
          normalizeOutputToJsonPath().jsonPath,
          true,
          {
            arrStr: "[null",
          },
          ({
            tailJsonPath,
            tailTarget,
            iterationResult,
            workingSpaceJsonPath,
          }) => {
            return {
              Type: "Pass",
              Parameters: {
                [`${tailTarget}.$`]: `${tailJsonPath}`,
                // const arrStr = `${arrStr},${JSON.stringify(arr[0])}`;
                "arrStr.$": `States.Format('{},{}', ${workingSpaceJsonPath}.arrStr, States.JsonToString(${iterationResult}))`,
              },
              ResultPath: workingSpaceJsonPath,
              Next: ASLGraph.DeferNext,
            };
          },
          (workingSpaceJsonPath) => {
            return {
              startState: "format",
              states: {
                format: {
                  Type: "Pass",
                  // filterResult = { result: JSON.parse(filterResult.arrStr + "]") }
                  Parameters: {
                    // cannot use intrinsic functions in InputPath or Result
                    "result.$": `States.StringToJson(States.Format('{}]', ${workingSpaceJsonPath}.arrStr))`,
                  },
                  ResultPath: workingSpaceJsonPath,
                  Next: "set",
                },
                // filterResult = filterResult.result
                set: {
                  Type: "Pass",
                  // the original array is initialized with a leading null to simplify the adding of new values to the array string "[null"+",{new item}"+"]"
                  InputPath: `${workingSpaceJsonPath}.result[1:]`,
                  ResultPath: workingSpaceJsonPath,
                  Next: ASLGraph.DeferNext,
                },
              },
            };
          }
        );
      }
    );
  }

  private forEachToStateOutput(
    expr: CallExpr & {
      expr: PropAccessExpr;
    }
  ) {
    const callbackfn = expr.args[0]?.expr;
    if (!isFunctionLike(callbackfn)) {
      throw new SynthError(
        ErrorCodes.Invalid_Input,
        `the 'callback' argument of forEach must be a function or arrow expression, found: ${callbackfn?.kindName}`
      );
    }
    if (isSuperKeyword(expr.expr.expr)) {
      throw new SynthError(
        ErrorCodes.Unsupported_Feature,
        "Step Functions does not support super."
      );
    }
    return this.evalExpr(
      expr.expr.expr,
      (listOutput, { normalizeOutputToJsonPath }) => {
        // we assume that an array literal or a call would return a variable.
        if (
          ASLGraph.isLiteralValue(listOutput) &&
          !Array.isArray(listOutput.value)
        ) {
          throw new SynthError(
            ErrorCodes.Unexpected_Error,
            "Expected input to map to be a variable reference or array"
          );
        }

        return this.iterateArrayMethod(
          callbackfn,
          normalizeOutputToJsonPath().jsonPath,
          true,
          {},
          undefined,
          (workingSpaceJsonPath) => ({
            Type: "Pass",
            Result: this.context.null,
            ResultPath: workingSpaceJsonPath,
            Next: ASLGraph.DeferNext,
          })
        );
      }
    );
  }

  /**
   * Generic, plugable helper for array methods likes map, forEach, and filter.
   *
   * Expects a function in the form arr.(item, index, array) => {};
   *
   * `workingSpace` - a state location used by the array method machine. We'll write over this location with the result after.
   *
   * 1. init - initializes a working copy of the array, used to tail the array in the `workingSpace` (workingSpace.arr)
   *    1. [optional] - user provided parameter values to initialize the `workingSpace`
   * 2. check - check if the tailed array (`workingSpace.arr`) has more items.
   *    1. If yes, go to next, else go to `end` state.
   * 3. assignParameters - setup the current item, index, and array parameters, including handling any binding. Only if the parameter is defined by the program.
   * 4. body - execute the body of the function, with any return values going to the `iterationResultJsonPath`
   * 5. handle result - optional - optionally handle the result and customize the tail operation. Often the tail and handle logic can be joined together into one state.
   * 6. tail - if tail was not bypassed in the handle result step, update the `workingSpace.arr` to the tail of the array `workingSpace.arr[1:]`.
   * 7. check - return to the check state
   * 8. end - once the array is empty, execute the end state provided by the caller. Generally writing the result to the `workingSpace` location.
   */
  private iterateArrayMethod(
    func: FunctionLike,
    /**
     * The array to iterate on as a json path.
     */
    arrayJsonPath: string,
    /**
     * When true, the current array location will be re-used to store the function result.
     *
     * `workingSpace.arr[0]`
     *
     * This option saves creating a new memory location for result, but means the original item is not available during handleResult.
     *
     * The `tail` step will erase this value. `workingSpace.arr[0] = workingSpace.arr[1:]`
     */
    overwriteIterationItemResult: boolean,
    /**
     * Additional values to be initialized in the first state of the iteration.
     *
     * Note: This should not make use of json path values from the state.
     *       ResultSelector is used on the Map state which only references the result and not
     *       the greater state.
     */
    initValues: Record<string, Parameters>,
    /**
     * Generate states to handle the output of the iteration function.
     *
     * iterationFunction -> handler (?) -> tail -> check
     *
     * if {@link ASLGraph.DeferNext} is given as the NEXT the "check" step will be wired. To navigate to the default "tail" state use the given `tailStateName`.
     *
     * if undefined, the body will go directly to the `tail` step and any output of the iteration method will be lost.
     */
    handleIterationResult:
      | ((context: {
          /**
           * The location where the result of the function is stored.
           */
          iterationResult: string;
          itemJsonPath: string;
          tailStateName: string;
          tailJsonPath: string;
          /**
           * The object key to assign the tail to.
           *
           * Example
           * {
           *    Type: "Pass",
           *    Parameters: {
           *       `${tailTarget}.$`: tailJsonPath
           *    },
           *    ResultPath: ResultPath
           * }
           */
          tailTarget: string;
          /**
           * The position to update with the tailed array and any other data.
           *
           * [workingSpaceJsonPath]: {
           *    [tailTarget]: [tailJsonPath],
           *    ... anything else ...
           * }
           * =>
           * [workingSpaceJsonPath]: {
           *    arr.$: resultPath.arr[1:],
           *    ... anything else ...
           * }
           */
          workingSpaceJsonPath: string;
        }) => ASLGraph.NodeState | ASLGraph.SubState)
      | undefined,
    /**
     * A callback to return the end states(s).
     *
     * End should write over the working variable with the return value.
     *
     * return a special variable created during `init` and `handleIteration` as the method result.
     *
     * ex:
     * {
     *    Type: "Pass",
     *    InputPath: `${workingVariable}.someAccValue`,
     *    ResultPath: workingVariable
     * }
     */
    getEndState: (
      workingVariable: string
    ) => ASLGraph.NodeState | ASLGraph.SubState
  ): ASLGraph.OutputSubState {
    const workingSpaceJsonPath = this.newHeapVariable();

    const [itemParameter, indexParameter, arrayParameter] = func.parameters;

    const workingArrayName = "arr";
    const workingArray = `${workingSpaceJsonPath}.${workingArrayName}`; // { arr: [items] }
    const headJsonPath = `${workingArray}[0]`;
    const tailJsonPath = `${workingArray}[1:]`;
    // when the index parameter is given, we zip the index and item into a new array. The item will actually be at arr[pos].item.
    const itemJsonPath = indexParameter ? `${headJsonPath}.item` : headJsonPath;
    // this path is only used when the index parameter is provided.
    const indexJsonPath = `${headJsonPath}.index`;

    const functionResult = overwriteIterationItemResult
      ? headJsonPath
      : this.newHeapVariable();

    const assignParameters = ASLGraph.joinSubStates(
      func,
      itemParameter
        ? this.evalDecl(itemParameter, { jsonPath: itemJsonPath })
        : undefined,
      indexParameter
        ? this.evalDecl(indexParameter, {
            jsonPath: indexJsonPath,
          })
        : undefined,
      arrayParameter
        ? this.evalDecl(arrayParameter, {
            jsonPath: arrayJsonPath,
          })
        : undefined
    );

    /**
     * Provide a globally unique state name to return from in the iteration body.
     */
    const uniqueReturnName = this.generatedNames.generateOrGet(func);

    const functionBody = this.evalStmt(func.body, {
      End: undefined,
      ResultPath: functionResult,
      Next: uniqueReturnName,
    });

    /**
     * Get the caller provided handle state if provided.
     */
    const handleResult = handleIterationResult?.({
      iterationResult: functionResult,
      itemJsonPath,
      tailStateName: "tail",
      tailJsonPath,
      tailTarget: workingArrayName,
      workingSpaceJsonPath: workingSpaceJsonPath,
    });

    /**
     * Get the caller provided end state, if provided.
     */
    const endState = getEndState(workingSpaceJsonPath);

    return {
      startState: "init",
      states: {
        init: indexParameter
          ? {
              ...this.zipArray(arrayJsonPath),
              ResultSelector: {
                // copy array to tail it
                [`${workingArrayName}.$`]: "$",
                ...initValues,
              },
              ResultPath: workingSpaceJsonPath,
              Next: "check",
            }
          : {
              Type: "Pass",
              Parameters: {
                // copy array to tail it
                [`${workingArrayName}.$`]: arrayJsonPath,
                ...initValues,
              },
              // use the eventual result location as a temp working space
              ResultPath: workingSpaceJsonPath,
              Next: "check",
            },
        check: {
          Type: "Choice",
          Choices: [{ ...ASL.isPresent(headJsonPath), Next: "assign" }],
          Default: "end",
        },
        // unique return name used by deep returns
        [uniqueReturnName]: {
          Type: "Pass",
          Next: handleResult ? "handleResult" : "tail",
        },
        // assign the item parameter the head of the temp array
        assign: ASLGraph.updateDeferredNextStates(
          { Next: "body" },
          assignParameters ?? { Type: "Pass", Next: ASLGraph.DeferNext }
        ),
        // run the predicate function logic
        body: ASLGraph.updateDeferredNextStates(
          { Next: handleResult ? "handleResult" : "tail" },
          functionBody ?? { Type: "Pass", Next: ASLGraph.DeferNext }
        ),
        ...(handleResult
          ? {
              handleResult: ASLGraph.updateDeferredNextStates(
                { Next: "check" },
                handleResult
              ),
            }
          : {}),
        // tail
        tail: {
          Type: "Pass",
          InputPath: tailJsonPath,
          ResultPath: workingArray,
          Next: "check",
        },
        // parse the arrStr back to json and assign over the filter result value.
        end: endState,
      },
      output: { jsonPath: workingSpaceJsonPath },
    };
  }

  /**
   * We're indexing the array we're iterating over with the key. For this special case, we know that
   * the value points to `$$.Map.Item.Value`.
   *
   * In the below example:
   * 1. the value of `$$.Map.Item.Index` is stashed in `$.i` (as expected)
   * 2. the value of `$$.Map.Item.Value` is stashed in `$.0_i`. Special `0_` prefix is impossible
   *    to produce with TypeScript syntax and is therefore safe to use a prefix to store the hidden value.
   *
   * ```ts
   * for (const i in items) {
   *   const a = items[i]
   *   {
   *     Type: Pass
   *     ResultPath: $.a
   *     InputPath: "$.0_i"
   *   }
   * }
   * ```
   */
  private elementAccessExprToJsonPath(
    access: ElementAccessExpr
  ): ASLGraph.NodeResults {
    // special case when in a for-in loop
    if (isIdentifier(access.element)) {
      const element = access.element.lookup();
      if (
        isVariableDecl(element) &&
        access.findParent((parent): parent is ForInStmt => {
          if (isForInStmt(parent)) {
            if (isIdentifier(parent.initializer)) {
              // let i;
              // for (i in ..)
              return element === parent.initializer.lookup();
            } else if (isVariableDecl(parent.initializer)) {
              // for (let i in ..)
              return parent.initializer === element;
            }
          }
          return false;
        })
      ) {
        // the array element is assigned to $.0__[name]
        return { jsonPath: `$.0__${this.getIdentifierName(access.element)}` };
      }
    }

    return this.evalExpr(access.element, (elementOutput) => {
      // use explicit `eval` because we update the resulting state object output before returning
      const expr = this.eval(access.expr);
      const exprOutput = ASLGraph.getAslStateOutput(expr);

      const updatedOutput = this.accessConstant(
        exprOutput,
        this.assertElementAccessConstant(elementOutput),
        true
      );

      return ASLGraph.updateAslStateOutput(expr, updatedOutput);
    });
  }

  /**
   * Asserts that an {@link ASLGraph.Output} is a constant and is a number or string.
   *
   * Element access in StepFunctions must be constant because dynamic object is not supported.
   */
  private assertElementAccessConstant(value: ASLGraph.Output): string | number {
    if (!ASLGraph.isJsonPath(value) && !value.containsJsonPath) {
      if (typeof value.value === "string" || typeof value.value === "number") {
        return value.value;
      }
    }

    throw new SynthError(
      ErrorCodes.StepFunctions_Invalid_collection_access,
      "Collection element accessor must be a constant string or number"
    );
  }

  /**
   * In some cases, variable can be batch declared as state parameters.
   * This method is an alternative to {@link evalDecl} which can evaluate multiple {@link ParameterDecl}s
   * with initial values into a parameter object and any state to be run after (which setup any bound variables.)
   *
   * Parameter with identifier names become State Parameter keys
   *
   * `(input) => {}`
   * ->
   * ```ts
   * {
   *    Type: "Pass", // or Task, Name, etc
   *    Parameters: {
   *       "input.$": jsonPath
   *    }
   * }
   * ```
   *
   * `({ value }) => {}`
   * ->
   * ```ts
   * {
   *    Type: "Pass",
   *    InputPath: jsonPath,
   *    ResultPath: "$.value"
   * }
   * ```
   *
   * A Parameter object will be more efficient as multiple values can be bound in a single State rather than multiple passes.
   *
   * However:
   * 1. a State Parameter object can only override the entire state, it cannot update or add a subset of all variable names.
   * 2. a State Parameter object only supports json path computation. Complex situations like invoking an {@link Integration} or
   *    default value support for binding patterns would not be supported.
   *
   * @returns a tuple of
   *          1. a {@link Parameters} object intended to be used in the Parameters or ResultSelector of a state.
   *             Contains the initialized parameter names. Could be empty.
   *          2. a state or sub-state used to generate the bound names. May be undefined.
   */
  public evalParameterDeclForStateParameter(
    node: FunctionlessNode,
    ...parameters: [
      parameter: ParameterDecl | undefined,
      valuePath: ASLGraph.JsonPath
    ][]
  ): [
    Record<string, Parameters>,
    ASLGraph.NodeState | ASLGraph.SubState | undefined
  ] {
    // Parameter with identifier names become State Parameter keys
    const params = Object.fromEntries(
      parameters
        .filter(
          (
            parameter
          ): parameter is [
            ParameterDecl & { name: Identifier },
            ASLGraph.JsonPath
          ] => isIdentifier(parameter[0]?.name)
        )
        .map(([decl, { jsonPath }]) => [
          [`${this.getIdentifierName(decl.name)}.$`],
          jsonPath,
        ])
    );

    // Parameters with binding names because variable assignments.
    const states = parameters
      .filter(
        (
          parameter
        ): parameter is [
          ParameterDecl & { name: BindingPattern },
          ASLGraph.JsonPath
        ] => isBindingPattern(parameter[0]?.name)
      )
      .map(([decl, jsonPath]) => this.evalAssignment(decl.name, jsonPath));

    return [params, ASLGraph.joinSubStates(node, ...states)];
  }

  public evalDecl(
    decl: VariableDecl | ParameterDecl,
    initialValue?: ASLGraph.Output
  ): ASLGraph.SubState | ASLGraph.NodeState | undefined {
    const state = (() => {
      if (initialValue) {
        return this.evalAssignment(decl.name, initialValue);
      } else if (decl.initializer === undefined) {
        return undefined;
      }

      return this.evalExprToSubState(decl.initializer, (exprOutput) => {
        return this.evalAssignment(decl.name, exprOutput);
      });
    })();
    return state ? { node: decl, ...state } : undefined;
  }

  /**
   * Generic handler for any type of assignment with either an identifier or a binding pattern (deconstruction).
   *
   * Nested BindPatterns are handled recursively.
   *
   * const x = 1;
   * =>
   * const x = 1;
   *
   * const { x } = y;
   * =>
   * const x = y.x;
   *
   * const { x } = { x: 1 };
   * =>
   * const x = 1;
   *
   * const { x = 1 } = y;
   * =>
   * const x = y.x === undefined ? 1 : y.x;
   *
   * const { x = 1 } = {};
   * =>
   * const x = 1;
   *
   * const { x: { z } } = y;
   * =>
   * const z = y.x.z;
   *
   * const { x, ...rest } = y;
   * =>
   * INVALID - rest is unsupported in objects because ASL doesn't support object manipulation (ex: delete) or field enumeration (ex: keySet).
   *
   * const [x] = arr;
   * =>
   * const x = arr[0];
   *
   * const [,x] = arr;
   * =>
   * const x = arr[1];
   *
   * const [x,...rest] = arr;
   * =>
   * const x = arr[0];
   * const rest = arr.slice(1);
   */
  private evalAssignment(
    pattern: BindingName,
    value: ASLGraph.Output
  ): ASLGraph.SubState | ASLGraph.NodeState | undefined {
    // assign an identifier the current value
    if (isIdentifier(pattern)) {
      return ASLGraph.passWithInput(
        {
          Type: "Pass",
          node: pattern,
          ResultPath: `$.${this.getIdentifierName(pattern)}`,
          Next: ASLGraph.DeferNext,
        },
        value
      );
    } else {
      const rest = pattern.bindings.find(
        (binding) => isBindingElem(binding) && binding?.rest
      ) as BindingElem | undefined;
      if (rest && isObjectBinding(pattern)) {
        // TODO: validator
        throw new SynthError(
          ErrorCodes.StepFunctions_does_not_support_destructuring_object_with_rest
        );
      }

      // run each of the assignments as a sequence of states, they should not rely on each other.
      const assignments = pattern.bindings.map((binding, i) => {
        if (isOmittedExpr(binding) || binding.rest) {
          return undefined;
        }

        const updatedValue: ASLGraph.Output = (() => {
          if (isArrayBinding(pattern)) {
            // const [a] = arr;
            if (ASLGraph.isJsonPath(value)) {
              return {
                jsonPath: `${value.jsonPath}[${i}]`,
              };
            } else {
              // const [a] = [1,2,3];
              if (!Array.isArray(value.value)) {
                throw new SynthError(
                  ErrorCodes.Invalid_Input,
                  "Expected array binding pattern to be on a reference path or array literal."
                );
              }
              return {
                value: value.value[i],
                containsJsonPath: value.containsJsonPath,
              };
            }
          } else {
            // when `name` is a bindingPattern, propertyName should always be present.
            const propertyNameExpr = binding.propertyName ?? binding.name;
            const propertyName = isComputedPropertyNameExpr(propertyNameExpr)
              ? evalToConstant(propertyNameExpr.expr)?.constant
              : isIdentifier(propertyNameExpr)
              ? propertyNameExpr.name
              : isStringLiteralExpr(propertyNameExpr)
              ? propertyNameExpr.value
              : undefined;

            if (!propertyName || typeof propertyName !== "string") {
              throw new SynthError(
                ErrorCodes.StepFunctions_property_names_must_be_constant
              );
            }

            if (ASLGraph.isJsonPath(value)) {
              return {
                jsonPath: `${value.jsonPath}['${propertyName}']`,
              };
            } else if (value.value && typeof value.value === "object") {
              return {
                value: value.value[propertyName as keyof typeof value.value],
                containsJsonPath: value.containsJsonPath,
              };
            } else {
              throw new SynthError(
                ErrorCodes.Invalid_Input,
                "Expected object binding pattern to be on a reference path or object literal"
              );
            }
          }
        })();

        // when there is a default value
        if (binding.initializer) {
          // if there is a default value, update the output to reflect it
          const valueStatesWithDefault = this.applyDefaultValue(
            updatedValue,
            binding.initializer
          );

          // recursively assign, with the new value (original value or default value)
          const assignStates = this.evalAssignment(
            binding.name,
            ASLGraph.getAslStateOutput(valueStatesWithDefault)
          );

          // run the value states first and then the assignment which uses it
          return ASLGraph.joinSubStates(
            binding,
            valueStatesWithDefault,
            assignStates
          )!;
        }
        // if there is no default value, just continue finding assignments with the updated value.
        return this.evalAssignment(binding.name, updatedValue);
      });

      // rest is only value for arrays
      const restState = rest
        ? this.evalAssignment(
            rest.name,
            (() => {
              if (ASLGraph.isJsonPath(value)) {
                return {
                  jsonPath: `${value.jsonPath}[${
                    pattern.bindings.length - 1
                  }:]`,
                };
              } else if (Array.isArray(value.value)) {
                return {
                  ...value,
                  value: value.value.slice(pattern.bindings.length - 1),
                };
              } else {
                throw new SynthError(
                  ErrorCodes.Invalid_Input,
                  "Expected array binding pattern to be on a reference path or array literal."
                );
              }
            })()
          )
        : undefined;

      return ASLGraph.joinSubStates(pattern, ...assignments, restState);
    }
  }

  /**
   * Given an output value (json path or literal) and an expression to compute a default value,
   * return a possibly updated output value which will contain the default value if the initial value is undefined.
   *
   * `return value === undefined ? defaultValue : value;`
   */
  private applyDefaultValue(
    value: ASLGraph.Output,
    defaultValueExpression: Expr
  ): ASLGraph.NodeResults {
    // the states to execute to compute the default value, if needed.
    const defaultValueState = this.eval(defaultValueExpression);
    const defaultValue = ASLGraph.getAslStateOutput(defaultValueState);

    // attempt to optimize the assignment of the default value.
    // if the original value is known to be undefined at runtime, we can directly return the default value
    // or fail if both will be undefined
    const updatedValue =
      ASLGraph.isLiteralValue(value) && value.value === undefined
        ? defaultValueState
        : value;
    // if the value was undefined and there is no default or the default value was also undefined, fail
    if (
      !updatedValue ||
      (ASLGraph.isLiteralValue(updatedValue) && updatedValue === undefined)
    ) {
      throw new SynthError(
        ErrorCodes.Step_Functions_does_not_support_undefined,
        "Undefined literal is not supported"
      );
    }

    if (
      // if the updated value is the default value, there is no default, or the value is a constant (and defined)
      // then just output a simple assignment
      updatedValue === defaultValueState ||
      ASLGraph.isLiteralValue(value)
    ) {
      return updatedValue;
    } else {
      const temp = this.newHeapVariable();
      // runtime determination of default values
      return {
        startState: "check",
        states: {
          check: {
            Type: "Choice",
            // in javascript, the default value is applied only for `undefined` or missing values.
            // in ASL that is the same as NOT(ISPRESENT(jsonPath))
            Choices: [{ ...ASL.isPresent(value.jsonPath), Next: "value" }],
            Default: "default",
          },
          value: ASLGraph.passWithInput(
            {
              Type: "Pass",
              ResultPath: temp,
              Next: ASLGraph.DeferNext,
            },
            value
          ),
          // default will first execute any states to compute the default value and then assign the output to the temp variable.
          default: ASLGraph.joinSubStates(
            defaultValueExpression,
            defaultValueState,
            ASLGraph.passWithInput(
              {
                Type: "Pass",
                ResultPath: temp,
                Next: ASLGraph.DeferNext,
              },
              defaultValue
            )
          )!,
        },
        output: {
          jsonPath: temp,
        },
      };
    }
  }

  /**
   * Transform an {@link Expr} into a ASL {@link Condition}.
   *
   * @returns a {@link Condition} and an optional {@link ASLGraph.SubState} or {@link ASLGraph.NodeState}.
   *          the states are returned when the condition needs annotation states to generate the conditional.
   */
  public toCondition(
    expr: Expr
  ): [Condition, ASLGraph.SubState | ASLGraph.NodeState | undefined] {
    const subStates: (ASLGraph.SubState | ASLGraph.NodeState)[] = [];
    const localEval = (expr: Expr): ASLGraph.Output => {
      // for condition, allow undefined values.
      const e = this.eval(expr, true);
      ASLGraph.isStateOrSubState(e) && subStates.push(e);
      return ASLGraph.getAslStateOutput(e);
    };
    const localToCondition = (expr: Expr): Condition => {
      const [cond, subState] = this.toCondition(expr);
      subState && subStates.push(subState);
      return cond;
    };
    const internal = (expr: Expr): Condition => {
      if (isParenthesizedExpr(expr)) {
        return internal(expr.expr);
      } else if (isBooleanLiteralExpr(expr)) {
        return expr.value ? ASL.trueCondition() : ASL.falseCondition();
      } else if (isUnaryExpr(expr) || isPostfixUnaryExpr(expr)) {
        // TODO: more than just unary not... - https://github.com/functionless/functionless/issues/232
        if (expr.op === "!") {
          return {
            Not: localToCondition(expr.expr),
          };
        } else if (
          expr.op === "++" ||
          expr.op === "--" ||
          expr.op === "-" ||
          expr.op === "~" ||
          // https://github.com/functionless/functionless/issues/395
          expr.op === "+"
        ) {
          throw new SynthError(
            ErrorCodes.Cannot_perform_arithmetic_or_bitwise_computations_on_variables_in_Step_Function,
            `Step Function does not support operator ${expr.op}`
          );
        }
        assertNever(expr.op);
      } else if (isBinaryExpr(expr)) {
        if (expr.op === "&&") {
          return {
            And: [localToCondition(expr.left), localToCondition(expr.right)],
          };
        } else if (expr.op === "||") {
          return {
            Or: [localToCondition(expr.left), localToCondition(expr.right)],
          };
        } else if (expr.op === "??" || expr.op === "=") {
          // FIXME: the potentially circular reference here (eval -> toCondition -> eval -> toCondition) is not good. Should toCondition and eval also be merged?
          const res = localEval(expr);
          if (ASLGraph.isJsonPath(res)) {
            return ASL.isTruthy(res.jsonPath);
          } else {
            // if a value is returned, assign it into a variable and check if it is truthy.
            const temp = this.newHeapVariable();
            subStates.push(
              ASLGraph.passWithInput(
                {
                  Type: "Pass",
                  ResultPath: temp,
                  Next: ASLGraph.DeferNext,
                },
                res
              )
            );
            return ASL.isTruthy(temp);
          }
        } else {
          const leftOutput = localEval(expr.left);
          const rightOutput = localEval(expr.right);

          if (
            expr.op === "!=" ||
            expr.op === "!==" ||
            expr.op === "==" ||
            expr.op === "===" ||
            expr.op === ">" ||
            expr.op === "<" ||
            expr.op === ">=" ||
            expr.op === "<="
          ) {
            if (
              ASLGraph.isLiteralValue(leftOutput) &&
              ASLGraph.isLiteralValue(rightOutput)
            ) {
              return ((expr.op === "==" || expr.op === "===") &&
                leftOutput.value === rightOutput.value) ||
                ((expr.op === "!=" || expr.op === "!==") &&
                  leftOutput.value !== rightOutput.value) ||
                (leftOutput.value !== null &&
                  rightOutput.value !== null &&
                  ((expr.op === ">" && leftOutput.value > rightOutput.value) ||
                    (expr.op === "<" && leftOutput.value < rightOutput.value) ||
                    (expr.op === "<=" &&
                      leftOutput.value <= rightOutput.value) ||
                    (expr.op === ">=" &&
                      leftOutput.value >= rightOutput.value)))
                ? ASL.trueCondition()
                : ASL.falseCondition();
            }

            const [left, right] = ASLGraph.isJsonPath(leftOutput)
              ? [leftOutput, rightOutput]
              : [rightOutput as ASLGraph.JsonPath, leftOutput];
            // if the right is a variable and the left isn't, invert the operator
            // 1 >= a -> a <= 1
            // a >= b -> a >= b
            // a >= 1 -> a >= 1
            const operator =
              leftOutput === left ? expr.op : invertBinaryOperator(expr.op);

            return ASL.compare(left, right, operator as any);
          } else if (expr.op === "in") {
            const elm = this.assertElementAccessConstant(leftOutput);

            const accessed = this.accessConstant(rightOutput, elm, true);

            if (ASLGraph.isLiteralValue(accessed)) {
              return accessed.value === undefined
                ? ASL.falseCondition()
                : ASL.trueCondition();
            } else {
              return ASL.isPresent(accessed.jsonPath);
            }
          } else if (expr.op === ",") {
            // eval left and discard the result
            localEval(expr.left);
            // eval right to a condition and return
            return localToCondition(expr.right);
          } else if (
            expr.op === "+" ||
            expr.op === "-" ||
            expr.op === "*" ||
            expr.op === "/" ||
            expr.op === "%" ||
            expr.op === "+=" ||
            expr.op === "-=" ||
            expr.op === "*=" ||
            expr.op === "/=" ||
            expr.op === "%=" ||
            expr.op === "&" ||
            expr.op === "&&=" ||
            expr.op === "&=" ||
            expr.op === "**" ||
            expr.op === "**=" ||
            expr.op === "<<" ||
            expr.op === "<<=" ||
            expr.op === ">>" ||
            expr.op === ">>=" ||
            expr.op === ">>>" ||
            expr.op === ">>>=" ||
            expr.op === "^" ||
            expr.op === "^=" ||
            expr.op === "|" ||
            expr.op === "|="
          ) {
            throw new SynthError(
              ErrorCodes.Cannot_perform_arithmetic_or_bitwise_computations_on_variables_in_Step_Function,
              `Step Function does not support operator ${expr.op}`
            );
          } else if (
            expr.op === "instanceof" ||
            // https://github.com/functionless/functionless/issues/393
            expr.op === "??=" ||
            expr.op === "||="
          ) {
            throw new SynthError(
              ErrorCodes.Unsupported_Feature,
              `Step Function does not support ${expr.op} operator`
            );
          }

          assertNever(expr.op);
        }
      } else if (isVariableReference(expr) || isCallExpr(expr)) {
        const variableOutput = localEval(expr);
        if (!ASLGraph.isJsonPath(variableOutput)) {
          throw new SynthError(
            ErrorCodes.Unexpected_Error,
            "Expected VariableReference and CallExpr to return variables."
          );
        }
        // if(expr) { ... }
        return ASL.isTruthy(variableOutput.jsonPath);
      } else if (isAwaitExpr(expr)) {
        return localToCondition(expr.expr);
      }
      throw new Error(`cannot evaluate expression: '${expr.kindName}`);
    };

    return [internal(expr), ASLGraph.joinSubStates(expr, ...subStates)];
  }

  /**
   * Zip an array with it's index.
   *
   * In ASL, it is not possible to do arithmetic or get the length of an array, but
   * the map state does give us the index.
   *
   * @param formatIndex allows the optional formatting of the index number, for example, turning it into a string.
   * @returns a partial map state that results in an array of { index: number, item: arrayElement[index] }.
   */
  private zipArray(
    arrayJsonPath: string,
    formatIndex: (indexJsonPath: string) => string = (index) => index
  ): Pick<MapTask, "Type" | "ItemsPath" | "Parameters" | "Iterator"> {
    return {
      Type: "Map" as const,
      ItemsPath: arrayJsonPath,
      Parameters: {
        "index.$": formatIndex("$$.Map.Item.Index"),
        "item.$": "$$.Map.Item.Value",
      },
      Iterator: this.aslGraphToStates({
        Type: "Pass",
        ResultPath: "$",
        Next: ASLGraph.DeferNext,
      }),
    };
  }
}

export function isForEach(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr;
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "forEach"
  );
}

export function isMap(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr;
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "map"
  );
}

function isSlice(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "slice";
  };
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "slice"
  );
}

function isJoin(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "join";
  };
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "join"
  );
}

function isFilter(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "filter";
  };
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "filter"
  );
}

function canThrow(node: FunctionlessNode): boolean {
  const flow = analyzeFlow(node);
  return (flow.hasTask || flow.hasThrow) ?? false;
}

interface FlowResult {
  hasTask?: true;
  hasThrow?: true;
}

/**
 * Analyze the flow contained within a section of the AST and determine if it has any tasks or throw statements.
 */
function analyzeFlow(node: FunctionlessNode): FlowResult {
  return node.children
    .map(analyzeFlow)
    .reduce(
      (a, b) => ({ ...a, ...b }),
      isCallExpr(node) &&
        isReferenceExpr(node.expr) &&
        isIntegration(node.expr.ref())
        ? { hasTask: true }
        : isThrowStmt(node)
        ? { hasThrow: true }
        : {}
    );
}

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

  export const isSubState = (
    state: ASLGraph.NodeState | ASLGraph.SubState | ASLGraph.NodeResults
  ): state is ASLGraph.SubState => {
    return "startState" in state;
  };

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

  export const isOutputStateOrSubState = (
    state: any
  ): state is ASLGraph.OutputSubState | ASLGraph.OutputState => {
    return "output" in state;
  };

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

  export type Output = ASLGraph.LiteralValue | ASLGraph.JsonPath;

  export const isLiteralValue = (
    state: any
  ): state is ASLGraph.LiteralValue => {
    return "value" in state;
  };

  export const isJsonPath = (state: any): state is ASLGraph.JsonPath => {
    return "jsonPath" in state;
  };

  /**
   * Wires together an array of {@link State} or {@link ASLGraph.SubState} nodes in the order given.
   * Any state which is missing Next/End will be given a Next value of the next state with the final state
   * either being left as is.
   */
  export const joinSubStates = (
    node: FunctionlessNode,
    ...subStates: (
      | ASLGraph.NodeState
      | ASLGraph.SubState
      | ASLGraph.NodeResults
      | undefined
    )[]
  ): ASLGraph.SubState | ASLGraph.NodeState | undefined => {
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
  };

  /**
   * Used to lazily provide the next step to a provided state or nested set of states.
   *
   * Recursively traverse sub-states down to regular states, replacing any
   * nodes with `Next: ASLGraph.DeferNext` or `Next: undefined` with the given props.
   *
   * Note: States without `Next` are ignored and {@link Map} states replace Default and `Choices[].Next` instead.
   */
  export const updateDeferredNextStates = <T extends State | ASLGraph.SubState>(
    props:
      | {
          End: true;
        }
      | {
          Next: string;
        },
    state: T
  ): T => {
    return ASLGraph.isSubState(state)
      ? updateDeferredNextSubStates<Extract<typeof state, T>>(props, state)
      : (updateDeferredNextState<any>(props, state) as T);
  };

  /**
   * Updates DeferNext states for an entire sub-state.
   */
  const updateDeferredNextSubStates = <T extends ASLGraph.SubState>(
    props:
      | {
          End: true;
        }
      | {
          Next: string;
        },
    subState: T
  ): T => {
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
  };

  /**
   * Step functions can fail to deploy when extraneous properties are left on state nodes.
   * Only inject the properties the state type can handle.
   *
   * For example: https://github.com/functionless/functionless/issues/308
   * A Wait state with `ResultPath: null` was failing to deploy.
   */
  const updateDeferredNextState = <T extends State>(
    props:
      | {
          End: true;
        }
      | {
          Next: string;
        },
    state: T
  ): T => {
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
  };

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
  export const updateAslStateOutput = (
    state: ASLGraph.NodeResults,
    newOutput: ASLGraph.Output
  ) => {
    if (ASLGraph.isOutputStateOrSubState(state)) {
      return {
        ...state,
        output: newOutput,
      };
    }
    return newOutput;
  };

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
  export const toStates = (
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
  ): States => {
    // Utilize the rewrite transition logic to collect all state transitions in the graph.
    // Later this is used to remove all unreachable states from the flattened machine.
    const transitionMap: Record<string, Set<string>> = {};
    const registerTransition = (from: string, to: string) => {
      if (!(from in transitionMap)) {
        transitionMap[from] = new Set();
      }
      transitionMap[from]!.add(to);
    };
    const internal = (
      parentName: string,
      states:
        | ASLGraph.NodeState
        | ASLGraph.SubState
        | ASLGraph.OutputState
        | ASLGraph.OutputSubState,
      stateNameMap: NameMap
    ): [string, State][] => {
      if (!states) {
        return [];
      } else if (!ASLGraph.isSubState(states)) {
        // strip output and node off of the state object.
        const { node, output, ...updated } = <ASLGraph.OutputState>(
          rewriteStateTransitions(states, stateNameMap, (to: string) =>
            registerTransition(parentName, to)
          )
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
    };

    const namedStates = internal(startState, states, { localNames: {} });
    const reachableStateNames = findReachableStates(startState, transitionMap);

    /**
     * Remove any states with no effect (Pass, generally)
     * The incoming states to the empty states are re-wired to the outgoing transition of the empty state.
     */
    const updatedStates = removeEmptyStates(
      startState,
      namedStates.filter(([name]) => reachableStateNames.has(name))
    );

    // only take the reachable states
    return Object.fromEntries(updatedStates);
  };

  /**
   * Given a directed adjacency matrix, return a `Set` of all reachable states from the start state.
   */
  const findReachableStates = (
    startState: string,
    matrix: Record<string, Set<string>>
  ) => {
    const visited = new Set<string>();

    const depthFirst = (state: string) => {
      if (visited.has(state)) return;
      visited.add(state);
      if (state in matrix) {
        matrix[state]?.forEach(depthFirst);
      }
    };

    // starting from the start state, find all reachable states
    depthFirst(startState);

    return visited;
  };

  const removeEmptyStates = (
    startState: string,
    stateEntries: [string, State][]
  ): [string, State][] => {
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
  };

  /**
   * Visit each transition in each state.
   * Use the callback to update the transition name.
   */
  const visitTransition = (
    state: State,
    cb: (next: string) => string
  ): State => {
    if ("End" in state && state.End !== undefined) {
      return state;
    }
    if (isChoiceState(state)) {
      return {
        ...state,
        Choices: state.Choices.map((choice) => ({
          ...choice,
          Next: cb(choice.Next),
        })),
        Default: state.Default ? cb(state.Default) : undefined,
      };
    } else if ("Catch" in state) {
      return {
        ...state,
        Catch: state.Catch?.map((_catch) => ({
          ..._catch,
          Next: _catch.Next ? cb(_catch.Next) : _catch.Next,
        })),
        Next: state.Next ? cb(state.Next) : state.Next,
      };
    } else if (!("Next" in state)) {
      return state;
    }
    return {
      ...state,
      Next: state.Next ? cb(state.Next) : state.Next,
    };
  };

  /**
   * Finds the local state name in the nameMap.
   *
   * If the name contains the prefix `../` the search will start up a level.
   *
   * If a name is not found at the current level, the parent names will be searched.
   *
   * If no local name is found, the next value is returned as is.
   */
  const rewriteStateTransitions = (
    state: ASLGraph.NodeState,
    substateNameMap: NameMap,
    registerTransition: (transition: string) => void
  ) => {
    const updateTransition = (next: string, nameMap: NameMap): string => {
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
    };
    return visitTransition(state, (next) => {
      const name = updateTransition(next, substateNameMap);
      registerTransition(name);
      return name;
    });
  };

  /**
   * Normalized an ASL state to just the output (constant or variable).
   */
  export const getAslStateOutput = (
    state: ASLGraph.NodeResults
  ): ASLGraph.Output => {
    return ASLGraph.isLiteralValue(state)
      ? state
      : ASLGraph.isJsonPath(state)
      ? state
      : state.output;
  };

  /**
   * Applies an {@link ASLGraph.Output} to a partial {@link Pass}
   */
  export const passWithInput = (
    pass: Omit<NodeState<Pass>, "Parameters" | "InputPath" | "Result"> &
      CommonFields,
    value: ASLGraph.Output
  ): Pass => {
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
  };

  /**
   * Applies an {@link ASLGraph.Output} to a partial {@link Task}
   */
  export const taskWithInput = (
    task: Omit<Task, "Parameters" | "InputPath"> & CommonFields,
    value: ASLGraph.Output
  ): Task => {
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
  };
}

export namespace ASL {
  export const isTruthy = (v: string): Condition =>
    and(
      isPresent(v),
      isNotNull(v),
      or(
        and(isString(v), not(stringEquals(v, ""))),
        and(isNumeric(v), not(numericEquals(v, 0))),
        and(isBoolean(v), booleanEquals(v, true))
      )
    );

  export const and = (...cond: (Condition | undefined)[]): Condition => {
    const conds = cond.filter((c): c is Condition => !!c);
    return conds.length > 1
      ? {
          And: conds,
        }
      : conds.length === 0
      ? ASL.trueCondition()
      : conds[0]!;
  };

  export const or = (...cond: (Condition | undefined)[]): Condition => {
    const conds = cond.filter((c): c is Condition => !!c);
    return conds.length > 1
      ? {
          Or: conds,
        }
      : conds.length === 0
      ? ASL.trueCondition()
      : conds[0]!;
  };

  export const not = (cond: Condition): Condition => ({
    Not: cond,
  });

  export const isPresent = (Variable: string): Condition => ({
    IsPresent: true,
    Variable,
  });

  export const isNull = (Variable: string): Condition => ({
    IsNull: true,
    Variable,
  });

  export const isNotNull = (Variable: string): Condition => ({
    IsNull: false,
    Variable,
  });

  export const isBoolean = (Variable: string): Condition => ({
    IsBoolean: true,
    Variable,
  });

  export const isString = (Variable: string): Condition => ({
    IsString: true,
    Variable,
  });

  export const isNumeric = (Variable: string): Condition => ({
    IsNumeric: true,
    Variable,
  });

  export const stringEqualsPath = (
    Variable: string,
    path: string
  ): Condition => ({
    And: [
      isString(Variable),
      {
        StringEqualsPath: path,
        Variable,
      },
    ],
  });

  export const stringEquals = (
    Variable: string,
    string: string
  ): Condition => ({
    And: [
      isString(Variable),
      {
        StringEquals: string,
        Variable,
      },
    ],
  });

  export const numericEqualsPath = (
    Variable: string,
    path: string
  ): Condition => ({
    And: [
      isNumeric(Variable),
      {
        NumericEqualsPath: path,
        Variable,
      },
    ],
  });

  export const numericEquals = (
    Variable: string,
    number: number
  ): Condition => ({
    And: [
      isNumeric(Variable),
      {
        NumericEquals: number,
        Variable,
      },
    ],
  });

  export const booleanEqualsPath = (
    Variable: string,
    path: string
  ): Condition => ({
    BooleanEqualsPath: path,
    Variable,
  });

  export const booleanEquals = (
    Variable: string,
    value: boolean
  ): Condition => ({
    BooleanEquals: value,
    Variable,
  });

  // for != use not(equals())
  export const VALUE_COMPARISONS: Record<
    "===" | "==" | ">" | ">=" | "<=" | "<",
    Record<"string" | "boolean" | "number", keyof Condition | undefined>
  > = {
    "==": {
      string: "StringEquals",
      boolean: "BooleanEquals",
      number: "NumericEquals",
    },
    "===": {
      string: "StringEquals",
      boolean: "BooleanEquals",
      number: "NumericEquals",
    },
    "<": {
      string: "StringLessThan",
      boolean: undefined,
      number: "NumericLessThan",
    },
    "<=": {
      string: "StringLessThanEquals",
      boolean: undefined,
      number: "NumericLessThanEquals",
    },
    ">": {
      string: "StringGreaterThan",
      boolean: undefined,
      number: "NumericGreaterThan",
    },
    ">=": {
      string: "StringGreaterThanEquals",
      boolean: undefined,
      number: "NumericGreaterThanEquals",
    },
  };

  export const compareValueOfType = (
    Variable: string,
    operation: keyof typeof VALUE_COMPARISONS,
    value: string | number | boolean
  ): Condition => {
    const comparison =
      VALUE_COMPARISONS[operation][
        typeof value as "string" | "number" | "boolean"
      ];

    if (!comparison) {
      return ASL.falseCondition();
    }

    return {
      Variable,
      [comparison]: value,
    };
  };

  export const comparePathOfType = (
    Variable: string,
    operation: keyof typeof VALUE_COMPARISONS,
    path: string,
    type: "string" | "number" | "boolean"
  ): Condition => {
    const comparison = VALUE_COMPARISONS[operation][type];

    if (!comparison) {
      return ASL.falseCondition();
    }

    return {
      Variable,
      [`${comparison}Path`]: path,
    };
  };

  export const compare = (
    left: ASLGraph.JsonPath,
    right: ASLGraph.Output,
    operator: keyof typeof VALUE_COMPARISONS | "!=" | "!=="
  ): Condition => {
    if (
      operator === "==" ||
      operator === "===" ||
      operator === ">" ||
      operator === "<" ||
      operator === ">=" ||
      operator === "<="
    ) {
      const condition = ASL.or(
        ASL.nullCompare(left, right, operator),
        ASL.stringCompare(left, right, operator),
        ASL.booleanCompare(left, right, operator),
        ASL.numberCompare(left, right, operator)
      );

      if (ASLGraph.isJsonPath(right)) {
        ASL.or(
          // a === b while a and b are both not defined
          ASL.not(
            ASL.and(ASL.isPresent(left.jsonPath), ASL.isPresent(right.jsonPath))
          ),
          // a !== undefined && b !== undefined
          ASL.and(
            ASL.isPresent(left.jsonPath),
            ASL.isPresent(right.jsonPath),
            // && a [op] b
            condition
          )
        );
      }
      return ASL.and(ASL.isPresent(left.jsonPath), condition);
    } else if (operator === "!=" || operator === "!==") {
      return ASL.not(ASL.compare(left, right, "=="));
    }

    assertNever(operator);
  };

  // Assumes the variable(s) are present and not null
  export const stringCompare = (
    left: ASLGraph.JsonPath,
    right: ASLGraph.Output,
    operator: "===" | "==" | ">" | "<" | "<=" | ">="
  ) => {
    if (ASLGraph.isJsonPath(right) || typeof right.value === "string") {
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
  };

  export const numberCompare = (
    left: ASLGraph.JsonPath,
    right: ASLGraph.Output,
    operator: "===" | "==" | ">" | "<" | "<=" | ">="
  ) => {
    if (ASLGraph.isJsonPath(right) || typeof right.value === "number") {
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
  };

  export const booleanCompare = (
    left: ASLGraph.JsonPath,
    right: ASLGraph.Output,
    operator: "===" | "==" | ">" | "<" | "<=" | ">="
  ) => {
    if (ASLGraph.isJsonPath(right) || typeof right.value === "boolean") {
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
    return undefined;
  };

  export const nullCompare = (
    left: ASLGraph.JsonPath,
    right: ASLGraph.Output,
    operator: "===" | "==" | ">" | "<" | "<=" | ">="
  ) => {
    if (operator === "==" || operator === "===") {
      if (ASLGraph.isJsonPath(right)) {
        return ASL.and(ASL.isNull(left.jsonPath), ASL.isNull(right.jsonPath));
      } else if (right.value === null) {
        return ASL.isNull(left.jsonPath);
      }
    }
    return undefined;
  };

  export const falseCondition = () => ASL.isNull("$$.Execution.Id");
  export const trueCondition = () => ASL.isNotNull("$$.Execution.Id");
}

/**
 * Formats a stateName given a statement.
 *
 * If a different node is used to supply the name (ex: a block uses it's first statement) then that node is returned.
 *
 * @returns [state name, optionally updated cache key (node)]
 */
function toStateName(node: FunctionlessNode): string {
  /**
   * Special case that updates the statement used (cache key)
   */
  if (isBlockStmt(node)) {
    if (node.isFinallyBlock()) {
      return "finally";
    } else {
      const step = node.step();
      return step ? toStateName(step) : "<block>";
    }
  }
  function inner(node: Exclude<FunctionlessNode, BlockStmt>): string {
    if (isExpr(node)) {
      return nodeToString(node);
    } else if (isIfStmt(node)) {
      return `if(${nodeToString(node.when)})`;
    } else if (isExprStmt(node)) {
      return nodeToString(node.expr);
    } else if (isBreakStmt(node)) {
      return "break";
    } else if (isContinueStmt(node)) {
      return "continue";
    } else if (isCatchClause(node)) {
      return `catch${
        node.variableDecl ? `(${nodeToString(node.variableDecl)})` : ""
      }`;
    } else if (isDoStmt(node)) {
      return `while (${nodeToString(node.condition)})`;
    } else if (isForInStmt(node)) {
      return `for(${
        isIdentifier(node.initializer)
          ? nodeToString(node.initializer)
          : nodeToString(node.initializer.name)
      } in ${nodeToString(node.expr)})`;
    } else if (isForOfStmt(node)) {
      return `for(${nodeToString(node.initializer)} of ${nodeToString(
        node.expr
      )})`;
    } else if (isForStmt(node)) {
      // for(;;)
      return `for(${
        node.initializer && isVariableDeclList(node.initializer)
          ? inner(node.initializer)
          : nodeToString(node.initializer)
      };${nodeToString(node.condition)};${nodeToString(node.incrementor)})`;
    } else if (isReturnStmt(node)) {
      if (node.expr) {
        return `return ${nodeToString(node.expr)}`;
      } else {
        return "return";
      }
    } else if (isThrowStmt(node)) {
      return `throw ${nodeToString(node.expr)}`;
    } else if (isTryStmt(node)) {
      return "try";
    } else if (isVariableStmt(node)) {
      return inner(node.declList);
    } else if (isVariableDeclList(node)) {
      return `${node.decls.map((v) => inner(v)).join(",")}`;
    } else if (isVariableDecl(node)) {
      return node.initializer
        ? `${nodeToString(node.name)} = ${nodeToString(node.initializer)}`
        : nodeToString(node.name);
    } else if (isWhileStmt(node)) {
      return `while (${nodeToString(node.condition)})`;
    } else if (isBindingElem(node)) {
      const binding = node.propertyName
        ? `${inner(node.propertyName)}: ${inner(node.name)}`
        : `${inner(node.name)}`;
      return node.initializer
        ? `${binding} = ${nodeToString(node.initializer)}`
        : binding;
    } else if (isObjectBinding(node)) {
      return `{ ${node.bindings.map(inner).join(", ")} }`;
    } else if (isArrayBinding(node)) {
      return `[ ${node.bindings.map((b) => (!b ? "" : inner(b))).join(", ")} ]`;
    } else if (isFunctionLike(node)) {
      return `function (${node.parameters.map(inner).join(",")})`;
    } else if (isParameterDecl(node)) {
      return inner(node.name);
    } else if (isErr(node)) {
      throw node.error;
    } else if (isEmptyStmt(node)) {
      return ";";
    } else if (
      isCaseClause(node) ||
      isClassDecl(node) ||
      isClassStaticBlockDecl(node) ||
      isConstructorDecl(node) ||
      isDebuggerStmt(node) ||
      isDefaultClause(node) ||
      isGetAccessorDecl(node) ||
      isImportKeyword(node) ||
      isLabelledStmt(node) ||
      isMethodDecl(node) ||
      isPropDecl(node) ||
      isSetAccessorDecl(node) ||
      isSuperKeyword(node) ||
      isSuperKeyword(node) ||
      isSwitchStmt(node) ||
      isWithStmt(node) ||
      isYieldExpr(node) ||
      isTemplateHead(node) ||
      isTemplateMiddle(node) ||
      isTemplateTail(node) ||
      isTemplateSpan(node)
    ) {
      throw new SynthError(
        ErrorCodes.Unsupported_Feature,
        `Unsupported kind: ${node.kindName}`
      );
    } else {
      return assertNever(node);
    }
  }

  return inner(node);
}

function nodeToString(
  expr?:
    | Expr
    | ParameterDecl
    | BindingName
    | BindingElem
    | VariableDecl
    | VariableDeclList
    | SuperKeyword
): string {
  if (!expr) {
    return "";
  } else if (isArgument(expr)) {
    return nodeToString(expr.expr);
  } else if (isArrayLiteralExpr(expr)) {
    return `[${expr.items
      .map((item) => (item ? nodeToString(item) : "null"))
      .join(", ")}]`;
  } else if (isBigIntExpr(expr)) {
    return expr.value.toString(10);
  } else if (isBinaryExpr(expr)) {
    return `${nodeToString(expr.left)} ${expr.op} ${nodeToString(expr.right)}`;
  } else if (isBooleanLiteralExpr(expr)) {
    return `${expr.value}`;
  } else if (isCallExpr(expr) || isNewExpr(expr)) {
    if (isSuperKeyword(expr.expr) || isImportKeyword(expr.expr)) {
      throw new Error(`calling ${expr.expr.kindName} is unsupported in ASL`);
    }
    return `${isNewExpr(expr) ? "new " : ""}${nodeToString(
      expr.expr
    )}(${expr.args
      // Assume that undefined args are in order.
      .filter((arg) => arg && !isUndefinedLiteralExpr(arg))
      .map(nodeToString)
      .join(", ")})`;
  } else if (isConditionExpr(expr)) {
    return `if(${nodeToString(expr.when)})`;
  } else if (isComputedPropertyNameExpr(expr)) {
    return `[${nodeToString(expr.expr)}]`;
  } else if (isElementAccessExpr(expr)) {
    return `${nodeToString(expr.expr)}[${nodeToString(expr.element)}]`;
  } else if (isFunctionLike(expr)) {
    return `function(${expr.parameters.map(nodeToString).join(", ")})`;
  } else if (isIdentifier(expr)) {
    return expr.name;
  } else if (isNullLiteralExpr(expr)) {
    return "null";
  } else if (isNumberLiteralExpr(expr)) {
    return `${expr.value}`;
  } else if (isObjectLiteralExpr(expr)) {
    return `{${expr.properties
      .map((prop) => {
        if (
          isSetAccessorDecl(prop) ||
          isGetAccessorDecl(prop) ||
          isMethodDecl(prop)
        ) {
          throw new SynthError(
            ErrorCodes.Unsupported_Feature,
            `${prop.kindName} is not supported by Step Functions`
          );
        }

        return nodeToString(prop);
      })
      .join(", ")}}`;
  } else if (isPropAccessExpr(expr)) {
    return `${nodeToString(expr.expr)}.${expr.name.name}`;
  } else if (isPropAssignExpr(expr)) {
    return `${
      isIdentifier(expr.name) || isPrivateIdentifier(expr.name)
        ? expr.name.name
        : isStringLiteralExpr(expr.name)
        ? expr.name.value
        : isNumberLiteralExpr(expr.name)
        ? expr.name.value
        : isComputedPropertyNameExpr(expr.name)
        ? isStringLiteralExpr(expr.name.expr)
          ? expr.name.expr.value
          : nodeToString(expr.name.expr)
        : assertNever(expr.name)
    }: ${nodeToString(expr.expr)}`;
  } else if (isReferenceExpr(expr)) {
    return expr.name;
  } else if (isSpreadAssignExpr(expr)) {
    return `...${nodeToString(expr.expr)}`;
  } else if (isSpreadElementExpr(expr)) {
    return `...${nodeToString(expr.expr)}`;
  } else if (isStringLiteralExpr(expr)) {
    return `"${expr.value}"`;
  } else if (isTemplateExpr(expr)) {
    return `${expr.head.text}${expr.spans
      .map((span) => `\${${nodeToString(span.expr)}}${span.literal.text}`)
      .join("")}`;
  } else if (isNoSubstitutionTemplateLiteral(expr)) {
    return `\`${expr.text}\``;
  } else if (isTypeOfExpr(expr)) {
    return `typeof ${nodeToString(expr.expr)}`;
  } else if (isUnaryExpr(expr)) {
    return `${expr.op}${nodeToString(expr.expr)}`;
  } else if (isPostfixUnaryExpr(expr)) {
    return `${nodeToString(expr.expr)}${expr.op}`;
  } else if (isUndefinedLiteralExpr(expr)) {
    return "undefined";
  } else if (isAwaitExpr(expr)) {
    return `await ${nodeToString(expr.expr)}`;
  } else if (isThisExpr(expr)) {
    return "this";
  } else if (isClassExpr(expr)) {
    throw new SynthError(
      ErrorCodes.Unsupported_Feature,
      `ClassDecl is not supported in StepFunctions`
    );
  } else if (isPrivateIdentifier(expr)) {
    return expr.name;
  } else if (isYieldExpr(expr)) {
    return `yield${expr.delegate ? "*" : ""} ${nodeToString(expr.expr)}`;
  } else if (isRegexExpr(expr)) {
    return expr.regex.source;
  } else if (isDeleteExpr(expr)) {
    return `delete ${nodeToString(expr.expr)}`;
  } else if (isVoidExpr(expr)) {
    return `void ${nodeToString(expr.expr)}`;
  } else if (isParenthesizedExpr(expr)) {
    return nodeToString(expr.expr);
  } else if (isObjectBinding(expr)) {
    return `{${expr.bindings.map(nodeToString).join(",")}}`;
  } else if (isArrayBinding(expr)) {
    return `[${expr.bindings.map(nodeToString).join(",")}]`;
  } else if (isBindingElem(expr)) {
    return `${expr.rest ? "..." : ""}${
      expr.propertyName
        ? `${nodeToString(expr.propertyName)}:${nodeToString(expr.name)}`
        : `${nodeToString(expr.name)}`
    }`;
  } else if (isVariableDecl(expr)) {
    return `${nodeToString(expr.name)}${
      expr.initializer ? ` = ${nodeToString(expr.initializer)}` : ""
    }`;
  } else if (isVariableDeclList(expr)) {
    return expr.decls.map(nodeToString).join(", ");
  } else if (isParameterDecl(expr)) {
    return nodeToString(expr.name);
  } else if (isTaggedTemplateExpr(expr)) {
    throw new SynthError(
      ErrorCodes.Unsupported_Feature,
      `${expr.kindName} is not supported by Step Functions`
    );
  } else if (isOmittedExpr(expr)) {
    return "undefined";
  } else if (isSuperKeyword(expr)) {
    return "super";
  } else {
    return assertNever(expr);
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
