import { aws_iam } from "aws-cdk-lib";
import { Construct } from "constructs";
import { assertNever } from "./assert";
import { FunctionDecl } from "./declaration";
import { ErrorCodes, SynthError } from "./error-code";
import {
  Argument,
  AwaitExpr,
  CallExpr,
  ElementAccessExpr,
  Expr,
  NullLiteralExpr,
  ObjectLiteralExpr,
  PromiseExpr,
  PropAccessExpr,
} from "./expression";
import { isFunction } from "./function";
import {
  isBlockStmt,
  isFunctionExpr,
  isFunctionDecl,
  isExprStmt,
  isVariableStmt,
  isReturnStmt,
  isCallExpr,
  isBreakStmt,
  isForInStmt,
  isDoStmt,
  isContinueStmt,
  isIfStmt,
  isNullLiteralExpr,
  isUndefinedLiteralExpr,
  isThrowStmt,
  isNewExpr,
  isTryStmt,
  isPropAccessExpr,
  isLiteralExpr,
  isObjectLiteralExpr,
  isBinaryExpr,
  isUnaryExpr,
  isArgument,
  isElementAccessExpr,
  isArrayLiteralExpr,
  isPropAssignExpr,
  isComputedPropertyNameExpr,
  isStringLiteralExpr,
  isTemplateExpr,
  isParameterDecl,
  isBooleanLiteralExpr,
  isNumberLiteralExpr,
  isTypeOfExpr,
  isConditionExpr,
  isSpreadAssignExpr,
  isSpreadElementExpr,
  isCatchClause,
  isIdentifier,
  isAwaitExpr,
  isForOfStmt,
  isPromiseArrayExpr,
  isPromiseExpr,
  isWhileStmt,
  isReferenceExpr,
  isStmt,
  isPostfixUnaryExpr,
  isVariableReference,
  isBindingPattern,
  isExpr,
  isBindingElem,
  isObjectBinding,
  isArrayBinding,
  isErr,
} from "./guards";
import {
  getIntegrationExprFromIntegrationCallPattern,
  Integration,
  IntegrationImpl,
  isIntegration,
  isIntegrationCallPattern,
} from "./integration";
import { FunctionlessNode } from "./node";
import {
  BlockStmt,
  DoStmt,
  FinallyBlock,
  ForInStmt,
  ForOfStmt,
  ReturnStmt,
  Stmt,
  WhileStmt,
} from "./statement";
import { isStepFunction } from "./step-function";
import { isTable } from "./table";
import {
  anyOf,
  DeterministicNameGenerator,
  evalToConstant,
  isPromiseAll,
} from "./util";
import { visitBlock, visitEachChild, visitSpecificChildren } from "./visit";

export function isASL(a: any): a is ASL {
  return (a as ASL | undefined)?.kind === ASL.ContextName;
}

export interface StateMachine<S extends States> {
  Version?: "1.0";
  Comment?: string;
  TimeoutSeconds?: number;
  StartAt: keyof S;
  States: S;
}

type AslStateType = CompoundState | Variable | AslConstant;

export interface States {
  [stateName: string]: State;
}

/**
 * A Sub-State is a collection of possible return values.
 * A start state is the first state in the result. It will take on the name of the parent statement node.
 * States are zero to many named states or sub-stages that will take on the name of the parent statement node.
 */
export interface SubState {
  startState: string;
  node: FunctionlessNode;
  states?: { [stateName: string]: State | SubState };
}

/**
 * A compound state is a state node that may contain a simple Constant or Variable output instead of
 * built states or sub-states.
 *
 * Compound states are designed to be incorporated into existing states or turned into
 * states before they are returned up.
 *
 * Compound states cannot be nested in sub-states.
 */
export interface CompoundState extends SubState {
  output: Variable | AslConstant;
}

export interface AslConstant {
  /**
   * Whether there is json path in the constant.
   *
   * Helps determine where this constant can go for validation and
   * when false use Result in a Pass State instead of Parameters
   */
  containsJsonPath: boolean;
  value: string | number | null | boolean | Record<string, any>;
}

export interface Variable {
  jsonPath: string;
}

export const isState = (state: any): state is State => {
  return "Type" in state;
};

export const isSubState = (
  state: State | SubState | AslStateType
): state is SubState => {
  return "startState" in state;
};

const isStateOrSubState = anyOf(isState, isSubState);

export const isCompoundState = (state: any): state is CompoundState => {
  return "output" in state;
};

export const isAslConstant = (state: any): state is AslConstant => {
  return "value" in state;
};

export const isVariable = (state: any): state is Variable => {
  return "jsonPath" in state;
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
export interface CommonFields {
  /**
   * The name of the next state that is run when the current state finishes. Some state types, such as Choice, allow multiple transition states.
   */
  Next?: string;
  /**
   * Designates this state as a terminal state (ends the execution) if set to true. There can be any number of terminal states per state machine. Only one of Next or End can be used in a state. Some state types, such as Choice, don't support or use the End field.
   */
  End?: boolean;
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
}

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
export interface Wait extends CommonFields {
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
}

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
export interface Pass extends CommonFields {
  Comment?: string;
  Type: "Pass";
  Result?: any;
  ResultPath?: string | null;
  Parameters?: Parameters;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-task-state.html
 */
export interface CommonTaskFields extends CommonFields {
  Comment?: string;
  Parameters?: Parameters;
  ResultSelector?: string;
  ResultPath?: string | null;
  Retry?: Retry[];
  Catch?: Catch[];
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-task-state.html
 */
export interface Task extends CommonTaskFields {
  Type: "Task";
  Resource: string;
}

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
export interface MapTask extends CommonTaskFields {
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
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-parallel-state.html
 */
export interface ParallelTask extends CommonTaskFields {
  Type: "Parallel";
  Branches: StateMachine<States>[];
}

/**
 * Key map for re-writing relative state names to absolute
 */
interface NameMap {
  parent?: NameMap;
  localNames: Record<string, string>;
}

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
   * The {@link FunctionDecl} AST representation of the State Machine.
   */
  readonly decl: FunctionDecl;
  /**
   * Maps a {@link Stmt} to a unique State name. This is generated by passing over
   * the AST and assigning each state a unique name. These names are then used to
   * resolve state transitions.
   */
  private readonly stateNames = new Map<FunctionlessNode, string>();
  private readonly stateNamesCount = new Map<string, number>();
  private readonly generatedNames = new DeterministicNameGenerator();

  /**
   * When true, adds an extra state to the beginning of the machine that assigns the input
   * to a state variable and adds some additional constants.
   *
   * Example - this json path will contain the inputs to the machine.
   *
   * `$__fnl_context.input`
   *
   * This flag is set to when when accessing the {@link context} getting in this class.
   */
  private needsFunctionlessContext: boolean = false;

  constructor(
    readonly scope: Construct,
    readonly role: aws_iam.IRole,
    decl: FunctionDecl
  ) {
    const self = this;
    this.decl = visitEachChild(
      decl,
      function normalizeAST(
        node,
        hoist?: (expr: Expr) => Expr
      ): FunctionlessNode | FunctionlessNode[] {
        if (isBlockStmt(node)) {
          return new BlockStmt([
            // for each block statement
            ...visitBlock(
              node,
              function normalizeBlock(stmt, hoist) {
                return visitEachChild(stmt, (expr) =>
                  normalizeAST(expr, hoist)
                );
              },
              self.generatedNames
            ).statements,
            // re-write the AST to include explicit `ReturnStmt(NullLiteral())` statements
            // this simplifies the interpreter code by always having a node to chain onto, even when
            // the AST has no final `ReturnStmt` (i.e. when the function is a void function)
            // without this, chains that should return null will actually include the entire state as their output
            ...((isFunctionDecl(node.parent) || isFunctionExpr(node.parent)) &&
            (!node.lastStmt || !node.lastStmt.isTerminal())
              ? [new ReturnStmt(new NullLiteralExpr())]
              : []),
          ]);
        } else if (isIntegrationCallPattern(node)) {
          // we find the range of nodes to hoist so that we avoid visiting the middle nodes.
          // The start node is the first node in the integration pattern (integ, await, or promise)
          // The end is always the integration.
          const end = getIntegrationExprFromIntegrationCallPattern(node);

          const updatedChild = visitSpecificChildren(node, [end], (expr) =>
            normalizeAST(expr, hoist)
          );
          // when we find an integration call,
          // if it is nested, hoist it up (create variable, add above, replace expr with variable)
          return hoist && self.doHoist(node)
            ? hoist(updatedChild)
            : updatedChild;
        }
        return visitEachChild(node, (expr) => normalizeAST(expr, hoist));
      }
    );

    const states = this.evalStmt(this.decl.body);

    const start = this.transition(this.decl.body);
    if (start === undefined) {
      throw new Error("State Machine has no States");
    }

    if (this.needsFunctionlessContext) {
      const functionlessContext: Pass = {
        Type: "Pass",
        Parameters: {
          "input.$": "$",
          null: null,
        },
        ResultPath: FUNCTIONLESS_CONTEXT_JSON_PATH,
        OutputPath: "$",
        Next: start,
      };

      this.definition = {
        StartAt: "Initialize Functionless Context",
        States: {
          "Initialize Functionless Context": functionlessContext,
          ...states,
        },
      };
    } else {
      this.definition = {
        StartAt: start,
        States: states,
      };
    }
  }

  /**
   * Access Functionless context variables in the machine state like the input to the machine.
   *
   * The Functionless context is only added to the machine when needed.
   * Using this property anywhere in a machine will add the context Pass state to the start of the machine.
   */
  public get context() {
    this.needsFunctionlessContext = true;
    return {
      null: `${FUNCTIONLESS_CONTEXT_JSON_PATH}.null`,
      input: `${FUNCTIONLESS_CONTEXT_JSON_PATH}.input`,
    };
  }

  /**
   * Determines of an expression should be hoisted
   * Hoisted - Add new variable to the current block above the
   */
  private doHoist(
    node: FunctionlessNode
  ): node is CallExpr | AwaitExpr | PromiseExpr {
    const parent = node.parent;

    return (
      // const v = task()
      (!isStmt(parent) ||
        // for(const i in task())
        isForInStmt(parent) ||
        isForOfStmt(parent)) &&
      // v = task()
      !(isBinaryExpr(parent) && parent.op === "=")
    );
  }

  /**
   * Gets a unique State name for the {@link FunctionlessNode}. This function always returns the same
   * name for the same {@link FunctionlessNode} instance.
   *
   * The AST is stringified, truncated to < 75 characters and a monotonically incrementing
   * number is added as a suffix in the case where to {@link FunctionlessNode}s produce the same text.
   */
  public getStateName(node: FunctionlessNode): string {
    if (!this.stateNames.has(node)) {
      let [stateName, updatedStatement] = toStateName(node);
      if (updatedStatement && this.stateNames.has(updatedStatement)) {
        return this.stateNames.get(updatedStatement)!;
      }
      if (stateName === undefined) {
        throw new Error(`cannot transition to ${node.kind}`);
      }
      const updatedStateName = this.uniqueStateName(stateName);
      this.stateNames.set(updatedStatement ?? node, updatedStateName);
    }
    return this.stateNames.get(node)!;
  }

  public uniqueStateName(stateName: string): string {
    const truncatedStateName =
      stateName.length > 75 ? stateName.slice(0, 75) : stateName;
    if (this.stateNamesCount.has(truncatedStateName)) {
      const count = this.stateNamesCount.get(truncatedStateName)!;
      this.stateNamesCount.set(truncatedStateName, count + 1);
      this.stateNamesCount.set(`${truncatedStateName} ${count}`, 1);
      return `${truncatedStateName} ${count}`;
    }
    this.stateNamesCount.set(truncatedStateName, 1);
    return truncatedStateName;
  }

  /**
   * When executing {@link flattenSubStates}, need to replace the next property.
   *
   * A few states like Choice have deep Next properties to update.
   */
  private rewriteNext(subState: State, cb: (next: string) => string): State {
    if (subState.Type === "Choice") {
      return {
        ...subState,
        Choices: subState.Choices.map((choice) => ({
          ...choice,
          Next: cb(choice.Next),
        })),
        Default: subState.Default ? cb(subState.Default) : undefined,
      };
    } else if (!("Next" in subState)) {
      return subState;
    }
    return {
      ...subState,
      Next: subState.Next ? cb(subState.Next) : subState.Next,
    };
  }

  private rewriteSubStateNext(state: State, substateNameMap: NameMap) {
    const updateSubstateName = (next: string, nameMap: NameMap): string => {
      if (next.startsWith("../")) {
        if (nameMap.parent) {
          return updateSubstateName(next.substring(3), nameMap.parent);
        }
        return next.substring(3);
      } else {
        if (next in nameMap.localNames) {
          return nameMap.localNames[next];
        }
        return next;
      }
    };
    return this.rewriteNext(state, (next) =>
      updateSubstateName(next, substateNameMap)
    );
  }

  /**
   * Sub-states use "default" as their entry point.
   * Re-write default to be the parent name. For all other subStateNames,
   * suffix the subStateName with the parentState name.
   */
  private subStateName(parentState: string, subStateName: string) {
    return `${subStateName}__${parentState}`;
  }

  /**
   * When `eval` returns a sub-state with multiple states, we need to re-write the sub state names to
   * include context to their parent state and update the Next property to match.
   *
   * sub state
   * ```ts
   * {
   *    default: { Next: 'b' },
   *    b: { Next: 'c' },
   *    c: { Next: 'externalState'  }
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
   */
  private flattenSubStates(
    parentName: string,
    states: State | SubState | undefined,
    stateNameMap?: NameMap
  ): States {
    if (!states) {
      return {};
    } else if (!isSubState(states)) {
      return {
        [parentName]: states,
      };
    } else {
      // build a map of local state names to their unique flattened form
      const stateNames = {
        ...Object.fromEntries(
          Object.entries(states.states ?? {}).map(([name, state]) => [
            name,
            states.startState === name
              ? parentName
              : isSubState(state)
              ? this.getStateName(state.node)
              : this.uniqueStateName(this.subStateName(parentName, name)),
          ])
        ),
      };
      const nameMap: NameMap = {
        parent: stateNameMap,
        localNames: stateNames,
      };
      return Object.fromEntries(
        Object.entries(states.states ?? {}).flatMap(([key, state]) => {
          if (isSubState(state)) {
            return Object.entries(
              this.flattenSubStates(nameMap.localNames[key], state, nameMap)
            );
          } else {
            // re-write any Next states to reflect the updated state names.
            const updated = this.rewriteSubStateNext(state, nameMap);
            return [[nameMap.localNames[key], updated]];
          }
        })
      );
    }
  }

  public evalStmt(stmt: Stmt): States {
    if (isBlockStmt(stmt)) {
      return stmt.statements.reduce(
        (states: States, s) => ({
          ...states,
          ...this.evalStmt(s),
        }),
        {}
      );
    } else if (isBreakStmt(stmt)) {
      const loop = stmt.findParent(
        anyOf(isForOfStmt, isForInStmt, isWhileStmt, isDoStmt)
      );
      if (loop === undefined) {
        throw new Error("Stack Underflow");
      }

      return {
        [this.getStateName(stmt)]:
          isForInStmt(loop) || isForOfStmt(loop)
            ? {
                Type: "Fail",
                Error: "Break",
              }
            : {
                Type: "Pass",
                Next: this.next(loop),
              },
      };
    } else if (isContinueStmt(stmt)) {
      const loop = stmt.findParent(
        anyOf(isForOfStmt, isForInStmt, isWhileStmt, isDoStmt)
      );
      if (loop === undefined) {
        throw new Error("Stack Underflow");
      }

      return {
        [this.getStateName(stmt)]:
          isForInStmt(loop) || isForOfStmt(loop)
            ? {
                Type: "Pass",
                End: true,
                ResultPath: null,
              }
            : isWhileStmt(loop)
            ? {
                Type: "Pass",
                Next: this.getStateName(loop),
                ResultPath: null,
              }
            : {
                Type: "Pass",
                Next: this.getStateName(loop.step()!),
                ResultPath: null,
              },
      };
    } else if (isExprStmt(stmt)) {
      const name = this.getStateName(stmt);
      const expr = this.eval(stmt.expr);

      const next = this.next(stmt);

      // Expr Stmt throws away the constant or reference result of a statement.
      // Either apply the next statement to the returned sub-state
      // or create an empty pass
      // TODO: Minor optimization. Could we update references to this line to the next statement?
      //       or could we defer wiring the next states until we know which statements
      //       have outputs?
      if (isCompoundState(expr)) {
        return this.flattenSubStates(
          name,
          this.applyDeferNext(next ? { Next: next } : { End: true }, expr)
        );
      } else {
        return {
          [name]: {
            Type: "Pass",
            ResultPath: null,
            Next: this.next(stmt),
          },
        };
      }
    } else if (isForOfStmt(stmt) || isForInStmt(stmt)) {
      const throwTransition = this.throw(stmt);

      const Catch = [
        ...(hasBreak(stmt)
          ? [
              {
                ErrorEquals: ["Break"],
                Next: this.next(stmt)!,
                ResultPath: null,
              },
            ]
          : []),
        ...(throwTransition
          ? [
              {
                ErrorEquals: ["States.ALL"],
                Next: throwTransition.Next!,
                ResultPath: throwTransition.ResultPath,
              },
            ]
          : []),
      ];

      const expr = this.eval(stmt.expr);
      const output = this.getAslStateOutput(expr);

      // if we get back a constant, we'll need a location to put it
      const itemsLocation = isVariable(output)
        ? output.jsonPath
        : this.randomHeap();

      const joined = this.joinSubStates(
        stmt,
        // add any sub states generated by the expression first
        expr,
        // if the output of the expression is a constant, assign it to a variable for the map
        isVariable(output)
          ? undefined
          : this.applyConstantOrVariableToPass(
              {
                ResultPath: itemsLocation,
                Type: "Pass",
                Next: ASL.DeferNext,
              },
              output
            ),
        {
          Type: "Map",
          ...(Catch.length > 0 ? { Catch } : {}),
          ResultPath: null,
          ItemsPath: itemsLocation,
          Next: this.next(stmt),
          MaxConcurrency: 1,
          Parameters: {
            ...this.cloneLexicalScopeParameters(stmt),
            ...(isForInStmt(stmt)
              ? {
                  // use special `0_` prefix (impossible variable name in JavaScript)
                  // to store a reference to the value so that we can implement array index
                  // for (const i in items) {
                  //   items[i] // $$.Map.Item.Value
                  // }
                  [`0_${stmt.variableDecl.name}.$`]: "$$.Map.Item.Value",
                }
              : {}),
            [`${stmt.variableDecl.name}.$`]: isForOfStmt(stmt)
              ? "$$.Map.Item.Value"
              : "$$.Map.Item.Index",
          },
          Iterator: {
            StartAt: this.getStateName(stmt.body.step()!),
            States: this.evalStmt(stmt.body),
          },
        }
      );

      return this.flattenSubStates(this.getStateName(stmt), joined);
    } else if (isIfStmt(stmt)) {
      const prefixSubStates: SubState[] = [];
      const states: States = {};
      const choices: Branch[] = [];

      let curr: Stmt | undefined = stmt;
      while (isIfStmt(curr)) {
        Object.assign(states, this.evalStmt(curr.then));

        const [cond, subState] = this.toCondition(curr.when);

        subState && prefixSubStates.push(subState);

        choices.push({
          Next: this.getStateName(curr.then),
          ...cond,
        });
        curr = curr._else;
      }
      if (isBlockStmt(curr)) {
        Object.assign(states, this.evalStmt(curr));
      }
      const next =
        curr === undefined
          ? this.next(stmt)
          : // there was an else
            this.getStateName(curr);

      const name = this.getStateName(stmt);

      return {
        ...this.flattenSubStates(
          name,
          this.joinSubStates(
            stmt,
            { Next: next },
            ...prefixSubStates,
            {
              Type: "Choice",
              Choices: choices,
              Default: ASL.DeferNext,
            },
            !next
              ? {
                  Type: "Pass" as const,
                  End: true,
                }
              : undefined
          )
        ),
        ...states,
      };
    } else if (isReturnStmt(stmt)) {
      const parent = stmt.findParent(
        anyOf(isFunctionExpr, isForInStmt, isForOfStmt)
      );
      if (isForInStmt(parent) || isForOfStmt(parent)) {
        // TODO, relax this
        throw new Error(
          "a 'return' statement is not allowed within a for loop"
        );
      }

      const name = this.getStateName(stmt);
      const expr = this.eval(stmt.expr);
      const exprOutput = this.getAslStateOutput(expr);

      return this.flattenSubStates(
        name,
        this.joinSubStates(
          stmt,
          expr,
          this.applyConstantOrVariableToPass(
            {
              Type: "Pass" as const,
              ResultPath: `$`,
              End: true,
            },
            exprOutput
          )
        )
      );
    } else if (isVariableStmt(stmt)) {
      if (stmt.expr === undefined) {
        return {};
      }

      const name = this.getStateName(stmt);
      const expr = this.eval(stmt.expr);
      const exprOutput = this.getAslStateOutput(expr);
      const next = this.next(stmt);

      if (isBindingPattern(stmt.name)) {
        throw new SynthError(
          ErrorCodes.Unsupported_Feature,
          "Binding pattern assignment in StepFunctions is currently unsupported: https://github.com/functionless/functionless/issues/68"
        );
      }

      const joined = this.joinSubStates(
        stmt,
        expr,
        this.applyConstantOrVariableToPass(
          {
            Type: "Pass" as const,
            // TODO support binding pattern - https://github.com/functionless/functionless/issues/302
            ResultPath: `$.${stmt.name}`,
            Next: next,
          },
          exprOutput
        )
      );

      return this.flattenSubStates(name, joined);
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
          : isAwaitExpr(stmt.expr)
          ? isPromiseExpr(stmt.expr.expr)
            ? stmt.expr.expr.expr
            : stmt.expr.expr
          : stmt.expr.expr;

      // TODO: tests error with complex parameters
      const error = updated.args
        .filter((arg): arg is Argument & { expr: Expr } => !!arg.expr)
        .reduce((args: any, arg) => {
          const expr = this.eval(arg.expr);
          const output = this.getAslStateOutput(expr);
          // https://stackoverflow.com/questions/67794661/propogating-error-message-through-fail-state-in-aws-step-functions?answertab=trending#tab-top
          if (
            !isAslConstant(output) ||
            output.containsJsonPath ||
            typeof output.value !== "string"
          ) {
            throw new SynthError(
              ErrorCodes.StepFunctions_error_name_and_cause_must_be_constant
            );
          }
          return {
            ...args,
            [arg.name!]: output.value,
          };
        }, {});

      const throwTransition = this.throw(stmt);
      if (throwTransition === undefined) {
        if (!isIdentifier(updated.expr)) {
          throw new SynthError(
            ErrorCodes.StepFunctions_error_name_and_cause_must_be_constant
          );
        }
        return {
          [this.getStateName(stmt)]: {
            Type: "Fail",
            Error: updated.expr.name,
            Cause: JSON.stringify(error),
          } as const,
        };
      } else {
        return {
          [this.getStateName(stmt)]: {
            Type: "Pass",
            Result: error,
            ...throwTransition,
          },
        } as const;
      }
    } else if (isTryStmt(stmt)) {
      const tryFlow = analyzeFlow(stmt.tryBlock);

      const errorVariableName = stmt.catchClause.variableDecl?.name;

      return {
        ...this.evalStmt(stmt.tryBlock),
        ...(tryFlow.hasTask && stmt.catchClause.variableDecl
          ? {
              [this.getStateName(stmt.catchClause.variableDecl)]: {
                Type: "Pass",
                Next: `0_${this.getStateName(stmt.catchClause.variableDecl)}`,
                Parameters: {
                  "0_ParsedError.$": `States.StringToJson(${`$.${errorVariableName}`}.Cause)`,
                },
                ResultPath: `$.${errorVariableName}`,
              },
              [`0_${this.getStateName(stmt.catchClause.variableDecl)}`]: {
                Type: "Pass",
                InputPath: `$.${errorVariableName}.0_ParsedError`,
                ResultPath: `$.${errorVariableName}`,
                Next: this.getStateName(stmt.catchClause.block.firstStmt!),
              },
            }
          : {}),
        ...this.evalStmt(stmt.catchClause.block),
        ...(stmt.finallyBlock
          ? {
              ...this.evalStmt(stmt.finallyBlock),
              ...(canThrow(stmt.catchClause)
                ? (() => {
                    if (stmt.finallyBlock.isTerminal()) {
                      // if every branch in the finallyBlock is terminal (meaning it always throws or returns)
                      // then we don't need the exit and throw blocks of a finally - because the finally
                      // will always return
                      // this is an extreme edge case
                      // see: https://github.com/microsoft/TypeScript/issues/27454
                      return {};
                    }
                    const throwTarget = this.throw(stmt.finallyBlock);
                    return {
                      [`exit ${this.getStateName(stmt.finallyBlock)}`]: {
                        // when exiting the finally block, if we entered via an error, then we need to re-throw the error
                        Type: "Choice",
                        Choices: [
                          {
                            // errors thrown from the catch block will be directed to this special variable for the `finally` block
                            Variable: `$.${this.generatedNames.generateOrGet(
                              stmt.finallyBlock
                            )}`,
                            IsPresent: true,
                            Next: `throw ${this.getStateName(
                              stmt.finallyBlock
                            )}`,
                          },
                        ],
                        Default: this.transition(stmt.finallyBlock.exit()),
                      },
                      [`throw ${this.getStateName(stmt.finallyBlock)}`]:
                        throwTarget
                          ? {
                              Type: "Pass",
                              ...throwTarget,
                            }
                          : {
                              Type: "Fail",
                              Error: "ReThrowFromFinally",
                              Cause:
                                "an error was re-thrown from a finally block which is unsupported by Step Functions",
                            },
                    };
                  })()
                : {}),
            }
          : {}),
      };
    } else if (isCatchClause(stmt)) {
      return this.evalStmt(stmt.block);
    } else if (isWhileStmt(stmt) || isDoStmt(stmt)) {
      const whenTrue = this.transition(stmt.block);
      if (whenTrue === undefined) {
        throw new SynthError(
          ErrorCodes.Unexpected_Error,
          `a ${stmt.kind} block must have at least one Stmt`
        );
      }
      const whenFalse = this.next(stmt);
      const [cond, subState] = this.toCondition(stmt.condition);
      const joined = this.joinSubStates(stmt, subState, {
        startState: "default",
        node: stmt.condition,
        states: {
          default: {
            Type: "Choice",
            Choices: [
              {
                ...cond,
                Next: whenTrue,
              },
            ],
            Default: whenFalse,
          },
        },
      });
      return {
        ...this.flattenSubStates(this.getStateName(stmt), joined!),
        ...this.evalStmt(stmt.block),
      };
    }
    return assertNever(stmt);
  }

  /**
   * Evaluate an {@link Expr} to a single {@link State}.
   *
   * @param expr the {@link Expr} to evaluate.
   * @param props where to store the result, whether this is the end state or not, where to go to next
   * @returns the {@link State}
   */
  public eval(expr: Expr): AslStateType {
    // first check to see if the expression can be turned into a constant.
    const constant = evalToConstant(expr);
    if (constant !== undefined) {
      const value = isFunction(constant.constant)
        ? constant.constant.resource.functionArn
        : isStepFunction(constant.constant)
        ? constant.constant.resource.stateMachineArn
        : isTable(constant.constant)
        ? constant.constant.resource.tableName
        : (constant.constant as any);
      // manufacturing null can be difficult, just use our magic constant
      return value === null
        ? { jsonPath: this.context.null }
        : {
            value: value,
            containsJsonPath: false,
          };
    }

    if (isPromiseExpr(expr)) {
      // if we find a promise, ensure it is wrapped in Await or returned then unwrap it
      if (isAwaitExpr(expr.parent) || isReturnStmt(expr.parent)) {
        return this.eval(expr.expr);
      }
      throw new SynthError(
        ErrorCodes.Integration_must_be_immediately_awaited_or_returned
      );
    } else if (isPromiseArrayExpr(expr)) {
      // if we find a promise array, ensure it is wrapped in a Promise.all then unwrap it
      if (
        isArgument(expr.parent) &&
        isCallExpr(expr.parent.parent) &&
        isPromiseAll(expr.parent.parent)
      ) {
        return this.eval(expr.expr);
      }
      throw new SynthError(
        ErrorCodes.Arrays_of_Integration_must_be_immediately_wrapped_in_Promise_all
      );
    } else if (isTemplateExpr(expr)) {
      const elements = expr.exprs.map((e) => {
        const ex = this.eval(e);
        const output = this.getAslStateOutput(ex);

        return {
          output,
          state: ex,
        };
      });

      const tempHeap = this.randomHeap();

      const outputs = elements.map(({ output }) => output);
      const subStates = elements.map(({ state }) => state);

      const joinedStates = this.joinSubStates(
        expr,
        ...subStates,
        {
          Type: "Pass",
          Result: outputs
            .map((output) => (isAslConstant(output) ? output.value : "{}"))
            .join(""),
          ResultPath: tempHeap,
        },
        {
          Type: "Pass",
          Parameters: {
            "string.$": `States.Format(${tempHeap},${outputs
              .filter(isVariable)
              .map(({ jsonPath }) => jsonPath)})`,
          },
          ResultPath: tempHeap,
        }
      );

      return {
        ...joinedStates!,
        output: {
          jsonPath: `${tempHeap}.string`,
        },
      };
    } else if (isCallExpr(expr)) {
      if (isReferenceExpr(expr.expr)) {
        const ref = expr.expr.ref();
        if (isIntegration<Integration>(ref)) {
          const serviceCall = new IntegrationImpl(ref);
          const integStates = serviceCall.asl(expr, this);

          if (isAslConstant(integStates)) {
            return integStates;
          }

          const updateStates = (states: CompoundState): CompoundState => {
            return {
              ...states,
              states: Object.fromEntries(
                Object.entries(states.states ?? {}).map(
                  ([stateName, state]) => {
                    if (isSubState(state)) {
                      return [stateName, state];
                    } else {
                      const throwOrPass = this.throw(expr);
                      if (throwOrPass?.Next) {
                        return [
                          stateName,
                          <State>{
                            ...state,
                            Catch: [
                              {
                                ErrorEquals: ["States.ALL"],
                                Next: throwOrPass.Next,
                                ResultPath: throwOrPass.ResultPath,
                              },
                            ],
                          },
                        ];
                      } else {
                        return [stateName, state];
                      }
                    }
                  }
                )
              ),
            };
          };

          return updateStates(integStates);
        } else {
          throw new SynthError(
            ErrorCodes.Unexpected_Error,
            "Called references are expected to be an integration."
          );
        }
      } else if (isMapOrForEach(expr)) {
        const throwTransition = this.throw(expr);

        const callbackfn = expr.getArgument("callbackfn")?.expr;
        if (callbackfn !== undefined && isFunctionExpr(callbackfn)) {
          const callbackStates = this.evalStmt(callbackfn.body);
          const callbackStart = this.getStateName(callbackfn.body.step()!);

          const list = this.eval(expr.expr.expr);
          const listOutput = this.getAslStateOutput(list);
          // we assume that an array literal or a call would return a variable.
          if (isAslConstant(listOutput) && !Array.isArray(listOutput.value)) {
            throw new SynthError(
              ErrorCodes.Unexpected_Error,
              "Expected input to map to be a variable reference or array"
            );
          }
          const tempHeap = this.randomHeap();
          const listPath = isVariable(listOutput)
            ? listOutput.jsonPath
            : this.randomHeap();

          const joined = this.joinSubStates(
            expr,
            list,
            isAslConstant(listOutput)
              ? {
                  Type: "Pass",
                  ResultPath: listPath,
                  Result: listOutput.value,
                }
              : undefined,
            {
              Type: "Map",
              MaxConcurrency: 1,
              Iterator: {
                States: callbackStates,
                StartAt: callbackStart,
              },
              ItemsPath: listPath,
              Parameters: {
                ...this.cloneLexicalScopeParameters(expr),
                ...Object.fromEntries(
                  callbackfn.parameters.map((param, i) => [
                    `${param.name}.$`,
                    i === 0
                      ? "$$.Map.Item.Value"
                      : i == 1
                      ? "$$.Map.Item.Index"
                      : listPath,
                  ])
                ),
              },
              ...(throwTransition
                ? {
                    Catch: [
                      {
                        ErrorEquals: ["States.ALL"],
                        Next: throwTransition.Next!,
                        ResultPath: throwTransition.ResultPath,
                      },
                    ],
                  }
                : {}),
              ResultPath: tempHeap,
              Next: ASL.DeferNext,
            }
          )!;

          return {
            ...joined,
            output: {
              jsonPath: tempHeap,
            },
          };
        }
      } else if (isSlice(expr)) {
        return this.sliceToJsonPath(expr);
      } else if (isFilter(expr)) {
        const predicate = expr.getArgument("predicate")?.expr;
        if (predicate !== undefined && isFunctionExpr(predicate)) {
          try {
            // first try to implement filter optimally with JSON Path
            return this.filterToJsonPath(expr);
          } catch {
            throw new Error(".filter with sub-tasks are not yet supported");
          }
        }
      } else if (isPromiseAll(expr)) {
        const values = expr.getArgument("values");
        // just validate Promise.all and continue, will validate the PromiseArray later.
        if (values?.expr && isPromiseArrayExpr(values?.expr)) {
          return this.eval(values.expr);
        }
        throw new SynthError(ErrorCodes.Unsupported_Use_of_Promises);
      }
      throw new Error(
        `call must be a service call or list .slice, .map, .forEach or .filter, ${expr}`
      );
    } else if (isVariableReference(expr)) {
      if (isIdentifier(expr)) {
        const ref = expr.lookup();
        // If the identifier references a parameter expression and that parameter expression
        // is in a FunctionDecl and that Function is at the top (no parent).
        // This logic needs to be updated to support destructured inputs: https://github.com/functionless/functionless/issues/68
        if (ref && isParameterDecl(ref) && isFunctionDecl(ref.parent)) {
          return { jsonPath: this.context.input };
        }
        return { jsonPath: `$.${expr.name}` };
      } else if (isPropAccessExpr(expr)) {
        const elm = this.eval(expr.expr);
        const output = this.getAslStateOutput(elm);

        const updateOutput: AslConstant | Variable | undefined =
          this.accessConstant(output, expr.name, false);

        return isCompoundState(elm)
          ? {
              ...elm,
              output: updateOutput,
            }
          : updateOutput;
      } else if (isElementAccessExpr(expr)) {
        return this.elementAccessExprToJsonPath(expr);
      }
      assertNever(expr);
    } else if (isObjectLiteralExpr(expr)) {
      return this.evalObjectLiteral(expr);
    } else if (isArrayLiteralExpr(expr)) {
      // evaluate each item
      const items = expr.items.map((item) => this.eval(item));
      // extract the value to inline in the array from the additional states
      const [simpleItems, subStates] = items.reduce(
        (
          [simples, subs]: [(Variable | AslConstant)[], (State | SubState)[]],
          item
        ) => {
          const [simple, sub] = this.aslStateToVariableOrConstant(item);
          return [[...simples, simple], sub ? [...subs, sub] : subs];
        },
        [[], []]
      );

      const heapLocation = this.randomHeap();

      const subStatesMap = this.joinSubStates(expr, ...subStates, {
        Type: "Pass",
        Parameters: {
          "arr.$": `States.Array(${simpleItems
            .map((item) => (isVariable(item) ? item.jsonPath : item.value))
            .join(", ")})`,
        },
        ResultPath: heapLocation,
        Next: ASL.DeferNext,
      })!;

      return {
        ...subStatesMap,
        output: {
          jsonPath: `${heapLocation}.arr`,
        },
      };
    } else if (isLiteralExpr(expr)) {
      return {
        value: expr.value ?? null,
        containsJsonPath: false,
      };
    } else if (
      isBinaryExpr(expr) &&
      expr.op === "=" &&
      (isVariableReference(expr.left) || isIdentifier(expr.left))
    ) {
      const right = this.eval(expr.right);
      const left = this.eval(expr.left);

      if (!isVariable(left)) {
        // TODO
        throw new Error("");
      }

      const rightOutput = this.getAslStateOutput(right);

      const joined = this.joinSubStates(
        expr,
        right,
        this.applyConstantOrVariableToPass(
          {
            Type: "Pass",
            ResultPath: left.jsonPath,
            Next: ASL.DeferNext,
          },
          rightOutput
        )
      )!;

      return {
        ...joined,
        output: left,
      };
    } else if (isBinaryExpr(expr)) {
      const constant = evalToConstant(expr);
      if (constant !== undefined) {
        return {
          value: constant,
          containsJsonPath: false,
        };
      } else if (expr.op === "&&" || expr.op === "||") {
        const tempHeap = this.randomHeap();
        const [cond, subState] = this.toCondition(expr);
        const joined = this.joinSubStates(expr, subState, {
          startState: "default",
          node: expr,
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
              Next: ASL.DeferNext,
            },
            assignFalse: {
              Type: "Pass",
              Result: false,
              ResultPath: tempHeap,
              Next: ASL.DeferNext,
            },
          },
        })!;
        return {
          ...joined,
          output: {
            jsonPath: tempHeap,
          },
        };
      } else if (expr.op === "??") {
        const left = this.eval(expr.left);
        const right = this.eval(expr.right);
        const leftOutput = this.getAslStateOutput(left);
        // TODO need to return generates states
        // literal ?? anything
        if (isAslConstant(leftOutput)) {
          if (!leftOutput.value) {
            return left;
          } else {
            return right;
          }
        }
        const tempHeap = this.randomHeap();
        const rightOutput = this.getAslStateOutput(right);
        // TODO merge in left and right substates.
        return {
          startState: "default",
          node: expr,
          states: {
            default: {
              Type: "Choice",
              Choices: [
                {
                  ...ASL.and(
                    ASL.isPresent(leftOutput.jsonPath),
                    ASL.isNotNull(leftOutput.jsonPath)
                  ),
                  Next: "takeLeft",
                },
              ],
              Default: "takeRight",
            },
            takeLeft: {
              Type: "Pass",
              InputPath: leftOutput.jsonPath,
              ResultPath: tempHeap,
              Next: ASL.DeferNext,
            },
            takeRight: this.applyConstantOrVariableToPass(
              {
                Type: "Pass",
                ResultPath: tempHeap,
                Next: ASL.DeferNext,
              },
              rightOutput
            ),
          },
          output: {
            jsonPath: tempHeap,
          },
        };
      }
      throw new SynthError(
        ErrorCodes.Unsupported_Feature,
        `Step Function does not support operator ${expr.op}`
      );
    } else if (isAwaitExpr(expr)) {
      return this.eval(expr.expr);
    }
    throw new Error(`cannot eval expression kind '${expr.kind}'`);
  }

  /**
   * Returns an object containing Pass/Task parameters values to clone the current lexical scope into
   * another scope, like a Map state.
   *
   * ```ts
   * {
   *    'a.$': '$.a',
   *    'input.$': '$.fnl_context.input'
   * }
   * ```
   */
  private cloneLexicalScopeParameters(
    node: FunctionlessNode
  ): Record<string, string> {
    const parentStmt = isStmt(node) ? node : node.findParent(isStmt);
    const variableReferences = parentStmt?.prev?.getLexicalScope() ?? new Map();
    return Object.fromEntries([
      ...Array.from(variableReferences.entries())
        .filter(
          ([, decl]) => !(isParameterDecl(decl) && isFunctionDecl(decl.parent))
        )
        .map(([name]) => [`${name}.$`, `$.${name}`]),
      // if the functionless context has been used at this point, inject it in
      ...(this.needsFunctionlessContext
        ? [[`${FUNCTIONLESS_CONTEXT_NAME}.$`, FUNCTIONLESS_CONTEXT_JSON_PATH]]
        : []),
    ]);
  }

  /**
   * @param element - when true (or field is a number) the output json path will prefer to use the square bracket format.
   *                  `$.obj[field]`. When false will prefer the dot format `$.obj.field`.
   */
  private accessConstant(
    value: AslConstant | Variable,
    field: string | number,
    element: boolean
  ): AslConstant | Variable {
    if (isVariable(value)) {
      return element || typeof field === "number"
        ? { jsonPath: `${value.jsonPath}[${field}]` }
        : { jsonPath: `${value.jsonPath}.${field}` };
    }

    if (value.value) {
      const accessedValue = (() => {
        if (Array.isArray(value.value)) {
          if (typeof field === "number") {
            return value.value[field];
          }
          // TODO
          throw Error("");
        } else if (typeof value.value === "object") {
          return value.value[field];
        }
        // TODO
        throw new Error("");
      })();

      return typeof accessedValue === "string" &&
        (accessedValue.startsWith("$") ||
          value.value[field].startsWith("States."))
        ? { jsonPath: accessedValue }
        : {
            value: accessedValue,
            containsJsonPath: value.containsJsonPath,
          };
    }

    // TODO
    throw new Error("");
  }

  public voidState(
    node: FunctionlessNode,
    state: State | SubState,
    ...subStates: AslStateType[]
  ): CompoundState {
    return {
      ...this.joinSubStates(node, ...(subStates ?? []), state)!,
      output: {
        jsonPath: this.context.null,
      },
    };
  }

  public outputState(
    node: FunctionlessNode,
    state: State,
    ...subStates: (AslStateType | undefined)[]
  ): CompoundState {
    const tempHeap = this.randomHeap();
    return {
      ...this.joinSubStates(
        node,
        ...(subStates ?? []),
        this.updateStateResultPath(state, tempHeap)
      )!,
      output: {
        jsonPath: tempHeap,
      },
    };
  }

  private updateStateResultPath<S extends State>(
    state: S,
    resultPath: string
  ): S {
    if (state.Type === "Choice") {
      return state;
    } else {
      return { ...state, ResultPath: resultPath };
    }
  }

  public applyDeferNext(
    props: {
      ResultPath?: string | null;
      End?: true;
      Next?: string;
    },
    state: State | SubState
  ) {
    return isSubState(state)
      ? this.applyDeferNextSubState(props, state)
      : this.applyDeferNextState(props, state);
  }

  /**
   * Updates DeferNext states for an entire sub-state.
   */
  private applyDeferNextSubState(
    props: {
      ResultPath?: string | null;
      End?: true;
      Next?: string;
    },
    subState: SubState
  ): SubState {
    // address the next state as a level up to keep the name unique.
    const updatedProps = props.Next
      ? {
          ...props,
          Next: `../${props.Next}`,
        }
      : props;
    return {
      ...subState,
      states: Object.fromEntries(
        Object.entries(subState.states ?? {}).map(([id, state]) => {
          return [id, this.applyDeferNext(updatedProps, state)];
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
  private applyDeferNextState(
    props: {
      ResultPath?: string | null;
      End?: true;
      Next?: string;
    },
    state: State
  ): State {
    const { End, Next = undefined, ResultPath } = props;

    if (state.Type === "Choice") {
      return {
        ...state,
        Choices: state.Choices.map((choice) => ({
          ...choice,
          // TODO: inject a default end node
          Next:
            !choice.Next || choice.Next === ASL.DeferNext ? Next! : choice.Next,
        })),
        // do we always want to inject a default?
        Default:
          !state.Default || state.Default === ASL.DeferNext
            ? Next
            : state.Default,
      };
    } else if (state.Type === "Fail" || state.Type === "Succeed") {
      return state;
    } else if ((!state.End && !state.Next) || state.Next === ASL.DeferNext) {
      if (state.Type === "Wait") {
        return {
          ...(state as Omit<Wait, "Next">),
          ...{ End, Next },
        };
      } else if (
        state.Type === "Task" ||
        state.Type === "Parallel" ||
        state.Type === "Pass" ||
        state.Type === "Map"
      ) {
        return {
          ...state,
          End,
          Next,
          // alow setting the result path to null, but ignore when undefined
          ResultPath:
            typeof ResultPath === "undefined" ? state.ResultPath : ResultPath,
        } as Task | ParallelTask | Pass | MapTask;
      }
      assertNever(state);
    }
    return state;
  }

  public applyConstantOrVariableToPass(
    pass: Omit<Pass, "Parameters" | "InputPath" | "Result">,
    value: AslConstant | Variable
  ): Pass {
    return {
      ...pass,
      ...(isVariable(value)
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

  public applyConstantOrVariableToTask(
    pass: Omit<Task, "Parameters" | "InputPath">,
    value: AslConstant | Variable
  ): Task {
    return {
      ...pass,
      ...(isVariable(value)
        ? {
            InputPath: value.jsonPath,
          }
        : {
            Parameters: value.value,
          }),
    };
  }

  private heapCounter = 0;

  /**
   * returns an in order unique memory location
   * TODO: make this contextual
   */
  public randomHeap() {
    return `$.heap${this.heapCounter++}`;
  }

  /**
   * Resolves a set of states to a single constant or variable.
   */
  private aslStateToVariableOrConstant(
    state: AslStateType
  ): [AslConstant | Variable] | [AslConstant | Variable, State | SubState] {
    if (isAslConstant(state) || isVariable(state)) {
      return [state];
    } else if (isState(state)) {
      // for a single state, try to resolve the output of the state, if not return null
      return [
        {
          jsonPath:
            "ResultPath" in state && state.ResultPath
              ? state.ResultPath
              : this.context.null,
        },
        state,
      ];
    } else {
      const { output, ...subState } = state;
      return [output, subState];
    }
  }

  /**
   * Normalized an ASL state to just the output (constant or variable).
   */
  public getAslStateOutput(state: AslStateType): AslConstant | Variable {
    return isAslConstant(state)
      ? state
      : isVariable(state)
      ? state
      : state.output;
  }

  /**
   * Wires together an array of {@link State} or {@link SubState} nodes in the order given.
   * Any state which is missing Next/End will be given the Next of the next state with the final state
   * either being left as is or having the props param applied to it.
   *
   * @param props - properties used to re-write the last sub-state in the array with using {@link applyDeferNext}
   *                Leave empty to not mutate the sub-state.
   *                This option should be used when the final state could contained Deferred next.
   */
  private joinSubStates(
    node: FunctionlessNode,
    ...subStates: (State | SubState | AslStateType | undefined)[]
  ): SubState | undefined;
  private joinSubStates(
    node: FunctionlessNode,
    props: {
      ResultPath?: string | null;
      End?: true;
      Next?: string;
    },
    ...subStates: (State | SubState | AslStateType | undefined)[]
  ): SubState | undefined;
  private joinSubStates(
    node: FunctionlessNode,
    ...subStates: (
      | {
          ResultPath?: string | null;
          End?: true;
          Next?: string;
        }
      | State
      | SubState
      | AslStateType
      | undefined
    )[]
  ): SubState | undefined {
    if (subStates.length === 0) {
      return undefined;
    }
    const props =
      subStates[0] &&
      (isStateOrSubState(subStates[0]) ||
        isAslConstant(subStates[0]) ||
        isVariable(subStates[0]))
        ? undefined
        : subStates[0];
    const realStates = subStates.filter((x) => !!x).filter(isStateOrSubState);
    return realStates.length === 0
      ? undefined
      : {
          startState: "0",
          node,
          states: Object.fromEntries(
            realStates.map((subState, i) => {
              return [
                `${i}`,
                i === realStates.length - 1
                  ? props
                    ? this.applyDeferNext(props, subState)
                    : subState
                  : this.applyDeferNext({ Next: `${i + 1}` }, subState),
              ];
            })
          ),
        };
  }

  /**
   * Transition to the State that represents the beginning of the {@link stmt}.
   *
   * @param stmt the {@link Stmt} to transition to.
   * @returns the name of the State representing the beginning of this {@link next}.
   */
  private transition(stmt: Stmt | undefined): string | undefined {
    if (stmt === undefined) {
      return undefined;
    } else if (isCatchClause(stmt)) {
      // CatchClause has special logic depending on whether the tryBlock contains a Task
      const { hasTask } = analyzeFlow(stmt.parent.tryBlock);
      if (hasTask && stmt.variableDecl) {
        // if we have a Task and the variableDecl is defined, then we need to do extra
        // work to parse the Catch block into the variableDecl
        return this.getStateName(stmt.variableDecl);
      } else {
        // this is an empty catch block or a catch block where the variable is ignored
        // so just transition into the catch block
        return this.transition(stmt.block);
      }
    } else if (isBlockStmt(stmt)) {
      // a BlockStmt does not have a state representing itself, so we instead step into it
      return this.transition(stmt.step());
    } else {
      // this is a Stmt that will have a singular state representing its beginning, return its name
      return this.getStateName(stmt);
    }
  }

  /**
   * Find the next state that the {@link node} should transition to.
   *
   * We can't use `node.step` because that logic does not understand Step Function's limitations.
   *
   * TODO: can we simplify the logic here, make more use of {@link this.step} and {@link Stmt.step}?
   */
  private next(node: Stmt): string | undefined {
    if (isReturnStmt(node)) {
      return this.return(node);
    } else if (node.next) {
      return this.transition(node.next);
    } else {
      const exit = node.exit();
      if (exit === undefined) {
        return undefined;
      }

      const scope = node.findParent(
        anyOf(isForOfStmt, isForInStmt, isWhileStmt, isDoStmt)
      );

      const finallyBlock = node.findParent(
        (node): node is FinallyBlock =>
          isBlockStmt(node) && node.isFinallyBlock()
      );

      if (
        node.parent === finallyBlock &&
        canThrow(finallyBlock.parent.catchClause)
      ) {
        // if we're exiting the `finally` block and the `catch` clause can throw an error
        // we need to exit via the special exit state that re-throws
        return `exit ${this.getStateName(finallyBlock)}`;
      }

      if (scope && !scope.contains(exit)) {
        // we exited out of the loop
        if (isForInStmt(scope) || isForOfStmt(scope)) {
          // if we're exiting a for-loop, then we return undefined
          // to indicate that the State should have Next:undefined and End: true
          return undefined;
        } else {
          return this.transition(scope);
        }
      }

      return this.transition(exit);
    }
  }

  /**
   * Find the nearest state on the call stack to return the value to.
   */
  private return(node: FunctionlessNode | undefined): string {
    if (node === undefined) {
      throw new Error("Stack Underflow");
    } else if (isFunctionDecl(node) || isFunctionExpr(node)) {
      return this.getStateName(node.body.lastStmt!);
    } else if (isForInStmt(node) || isForOfStmt(node)) {
      return this.getStateName(node);
    } else {
      return this.return(node.parent);
    }
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
        Next: string | undefined;
        /**
         * JSON Path to store the the error payload.
         */
        ResultPath: string | null;
      }
    | undefined {
    // detect the immediate for-loop closure surrounding this throw statement
    // because of how step function's Catch feature works, we need to check if the try
    // is inside or outside the closure
    const mapOrParallelClosure = node.findParent(
      anyOf(isForOfStmt, isForInStmt, isFunctionExpr)
    );

    // catchClause or finallyBlock that will run upon throwing this error
    const catchOrFinally = node.throw();
    if (catchOrFinally === undefined) {
      // error is terminal
      return undefined;
    } else if (
      mapOrParallelClosure === undefined ||
      mapOrParallelClosure.contains(catchOrFinally)
    ) {
      // the catch/finally handler is nearer than the surrounding Map/Parallel State
      return {
        Next: this.transition(catchOrFinally),
        ResultPath:
          isCatchClause(catchOrFinally) && catchOrFinally.variableDecl
            ? `$.${catchOrFinally.variableDecl.name}`
            : isBlockStmt(catchOrFinally) &&
              catchOrFinally.isFinallyBlock() &&
              canThrow(catchOrFinally.parent.catchClause) &&
              // we only store the error thrown from the catchClause if the finallyBlock is not terminal
              // by terminal, we mean that every branch returns a value - meaning that the re-throw
              // behavior of a finally will never be triggered - the return within the finally intercepts it
              !catchOrFinally.isTerminal()
            ? `$.${this.generatedNames.generateOrGet(catchOrFinally)}`
            : null,
      };
    } else {
      // the Map/Parallel tasks are closer than the catch/finally, so we use a Fail State
      // to terminate the Map/Parallel and delegate the propagation of the error to the
      // Map/Parallel state
      return undefined;
    }
  }

  public evalObjectLiteral(expr: ObjectLiteralExpr): AslStateType {
    const [payload, subStates] = expr.properties.reduce(
      ([obj, subStates], prop) => {
        if (!isPropAssignExpr(prop)) {
          throw new Error(
            `${prop.kind} is not supported in Amazon States Language`
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
            // TODO
            throw Error("object property name must be constant");
          }
          const value = this.eval(prop.expr);
          const valueOutput = this.getAslStateOutput(value);
          return [
            {
              value: {
                ...(obj.value as Record<string, any>),
                ...this.toJsonAssignment(name, valueOutput),
              },
              containsJsonPath:
                obj.containsJsonPath ||
                isVariable(valueOutput) ||
                valueOutput.containsJsonPath,
            },
            isCompoundState(value) ? [...subStates, value] : subStates,
          ];
        } else {
          throw new Error(
            "computed name of PropAssignExpr is not supported in Amazon States Language"
          );
        }
      },
      [
        {
          value: {},
          containsJsonPath: false,
        },
        [],
      ] as [AslConstant, (State | SubState)[]]
    );
    const joined = this.joinSubStates(expr, ...subStates);
    return joined
      ? {
          ...joined,
          output: payload,
        }
      : payload;
  }

  // public toJsonPath(
  //   expr: Identifier | PropAccessExpr | ElementAccessExpr
  // ): string {
  //   if (isIdentifier(expr)) {
  //     const ref = expr.lookup();
  //     // If the identifier references a parameter expression and that parameter expression
  //     // is in a FunctionDecl and that Function is at the top (no parent).
  //     // This logic needs to be updated to support destructured inputs: https://github.com/functionless/functionless/issues/68
  //     if (ref && isParameterDecl(ref) && isFunctionDecl(ref.parent)) {
  //       return this.context.input;
  //     }
  //     return `$.${expr.name}`;
  //   } else if (isPropAccessExpr(expr)) {
  //     return `${this.toJsonPath(expr.expr)}.${expr.name}`;
  //   } else if (isElementAccessExpr(expr)) {
  //     return this.elementAccessExprToJsonPath(expr);
  //   }

  //   throw new Error(
  //     `expression kind '${expr.kind}' cannot be evaluated to a JSON Path expression.`
  //   );
  // }

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
  private updateAslStateOutput(
    state: AslStateType,
    newOutput: AslConstant | Variable
  ) {
    if (isCompoundState(state)) {
      return {
        ...state,
        output: newOutput,
      };
    }
    return newOutput;
  }

  private sliceToJsonPath(
    expr: CallExpr & { expr: PropAccessExpr }
  ): AslStateType {
    const startArg = expr.getArgument("start")?.expr;
    const endArg = expr.getArgument("end")?.expr;
    const value = this.eval(expr.expr.expr);
    const valueOutput = this.getAslStateOutput(value);
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

      if (isVariable(valueOutput)) {
        if (!endConst || typeof endConst.constant === "undefined") {
          return this.updateAslStateOutput(value, {
            jsonPath: `${valueOutput.jsonPath}[${startConst}:]`,
          });
        } else {
          return this.updateAslStateOutput(value, {
            jsonPath: `${valueOutput.jsonPath}[${startConst}:${endConst.constant}]`,
          });
        }
      } else if (Array.isArray(valueOutput.value)) {
        return this.updateAslStateOutput(value, {
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
   * Returns a object with the key formatted based on the contents of the value.
   * in ASL, object keys that reference json path values must have a suffix of ".$"
   * { "input.$": "$.value" }
   */
  public toJsonAssignment(
    key: string,
    output: AslConstant | Variable
  ): Record<string, any> {
    return {
      [isVariable(output) ? `${key}.$` : key]: isAslConstant(output)
        ? output.value
        : output.jsonPath,
    };
  }

  private filterToJsonPath(
    expr: CallExpr & { expr: PropAccessExpr }
  ): AslStateType {
    const predicate = expr.getArgument("predicate")?.expr;
    if (!isFunctionExpr(predicate)) {
      throw new Error(
        "the 'predicate' argument of slice must be a FunctionExpr"
      );
    }

    const stmt = predicate.body.statements[0];
    if (
      stmt === undefined ||
      !isReturnStmt(stmt) ||
      predicate.body.statements.length !== 1
    ) {
      throw new Error(
        'a JSONPath filter expression only supports a single, in-line statement, e.g. .filter(a => a == "hello" || a === "world")'
      );
    }

    const toFilterCondition = (expr: Expr): string => {
      if (isBinaryExpr(expr)) {
        return `${toFilterCondition(expr.left)}${expr.op}${toFilterCondition(
          expr.right
        )}`;
      } else if (isUnaryExpr(expr)) {
        return `${expr.op}${toFilterCondition(expr.expr)}`;
      } else if (isIdentifier(expr)) {
        const ref = expr.lookup();
        if (ref === undefined) {
          throw new Error(`unresolved identifier: ${expr.name}`);
        } else if (isParameterDecl(ref)) {
          if (ref.parent !== predicate) {
            throw new Error(
              "cannot reference a ParameterDecl other than those in .filter((item, index) =>) in a JSONPath filter expression"
            );
          }
          if (ref === ref.parent.parameters[0]) {
            return "@";
          } else if (ref === ref.parent.parameters[1]) {
            throw new Error(
              "the 'index' parameter in a .filter expression is not supported"
            );
          } else {
            throw new Error(
              "the 'array' parameter in a .filter expression is not supported"
            );
          }
        } else if (isVariableStmt(ref)) {
          throw new Error(
            "cannot reference a VariableStmt within a JSONPath .filter expression"
          );
        }
      } else if (isStringLiteralExpr(expr)) {
        return `'${expr.value.replace(/'/g, "\\'")}'`;
      } else if (
        isBooleanLiteralExpr(expr) ||
        isNumberLiteralExpr(expr) ||
        isNullLiteralExpr(expr)
      ) {
        return `${expr.value}`;
      } else if (isPropAccessExpr(expr)) {
        return `${toFilterCondition(expr.expr)}.${expr.name}`;
      } else if (isElementAccessExpr(expr)) {
        return `${toFilterCondition(expr.expr)}[${this.elementToJsonPath(
          expr.element
        )}]`;
      }

      throw new Error(
        `JSONPath's filter expression does not support '${exprToString(expr)}'`
      );
    };

    const left = this.eval(expr.expr.expr);
    const leftOutput = this.getAslStateOutput(left);

    if (!isVariable(leftOutput)) {
      throw Error("");
    }

    return this.updateAslStateOutput(left, {
      jsonPath: `${leftOutput.jsonPath}[?(${toFilterCondition(stmt.expr)})]`,
    });
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
  private elementAccessExprToJsonPath(access: ElementAccessExpr): AslStateType {
    // special case when in a for-in loop
    if (isIdentifier(access.element) && isIdentifier(access.expr)) {
      const element = access.element.lookup();
      if (
        isVariableStmt(element) &&
        isForInStmt(element.parent) &&
        access.findParent(isForInStmt) === element.parent
      ) {
        return { jsonPath: `$.0_${element.name}` };
      }
    }

    const expr = this.eval(access.expr);
    const exprOutput = this.getAslStateOutput(expr);
    const element = this.eval(access.element);
    const elementOutput = this.getAslStateOutput(element);

    if (
      isVariable(elementOutput) ||
      elementOutput.containsJsonPath ||
      !(
        typeof elementOutput.value === "string" ||
        typeof elementOutput.value === "number"
      )
    ) {
      // TODO
      throw new Error("Element access must be a constant primitive");
    }

    const updatedOutput = this.accessConstant(
      exprOutput,
      elementOutput.value,
      true
    );

    return isCompoundState(expr)
      ? {
          ...expr,
          output: updatedOutput,
        }
      : updatedOutput;
  }

  private elementToJsonPath(expr: Expr): string {
    const value = evalToConstant(expr)?.constant;
    if (typeof value === "string") {
      return `'${value}'`;
    } else if (typeof value === "number") {
      return value.toString(10);
    }

    throw new Error(
      `an element in a Step Function must be a literal string or number`
    );
  }

  public toCondition(expr: Expr): [Condition, SubState | undefined] {
    // eww mutable collections
    const subStates: SubState[] = [];
    const localEval = (expr: Expr): AslConstant | Variable => {
      const e = this.eval(expr);
      isSubState(e) && subStates.push(e);
      return this.getAslStateOutput(e);
    };
    const localToCondition = (expr: Expr): Condition => {
      const [cond, subState] = this.toCondition(expr);
      subState && subStates.push(subState);
      return cond;
    };
    const internal = (): Condition => {
      if (isBooleanLiteralExpr(expr)) {
        return {
          IsPresent: !expr.value,
          Variable: `$.0_${expr.value}`,
        };
      } else if (isUnaryExpr(expr)) {
        // TODO: more than just unary not...
        return {
          Not: localToCondition(expr),
        };
      } else if (isBinaryExpr(expr)) {
        if (expr.op === "&&") {
          return {
            And: [localToCondition(expr.left), localToCondition(expr.right)],
          };
        } else if (expr.op === "||") {
          return {
            Or: [localToCondition(expr.left), localToCondition(expr.right)],
          };
        } else if (expr.op === "+" || expr.op === "-") {
          throw new Error(
            `operation '${expr.op}' is not supported in a Condition`
          );
        } else {
          const isLiteralOrTypeOfExpr = anyOf(isLiteralExpr, isTypeOfExpr);

          if (isLiteralExpr(expr.left) && isLiteralExpr(expr.right)) {
            throw new Error("cannot compare two literal expressions");
          } else if (
            isLiteralOrTypeOfExpr(expr.left) ||
            isLiteralOrTypeOfExpr(expr.right)
          ) {
            // typeof x === "string" -> left: typeOf, right: literal
            // "string" === typeof x -> left: literal, right: typeOf
            // x === 1 -> left: identifier, right: literal
            const [literalExpr, val] = isLiteralExpr(expr.left)
              ? [expr.left, expr.right]
              : [expr.right, expr.left];

            if (isTypeOfExpr(val)) {
              const supportedTypeNames = [
                "undefined",
                "boolean",
                "number",
                "string",
                "bigint",
              ] as const;

              // relax? we can use equalsJsonPath for a
              if (!isStringLiteralExpr(literalExpr)) {
                throw new Error(
                  'typeof expression can only be compared against a string literal, such as typeof x === "string"'
                );
              }

              const type =
                literalExpr.value as typeof supportedTypeNames[number];
              if (!supportedTypeNames.includes(type)) {
                throw new Error(`unsupported typeof comparison: "${type}"`);
              }
              const variableOutput = localEval(val.expr);
              // todo support constants?
              if (!isVariable(variableOutput)) {
                throw new Error("");
              }
              const Variable = variableOutput.jsonPath;
              if (expr.op === "==" || expr.op === "!=") {
                if (type === "undefined") {
                  return {
                    Variable,
                    IsPresent: expr.op !== "==",
                  };
                } else {
                  const flag = expr.op === "==";
                  return {
                    [expr.op === "==" ? "And" : "Or"]: [
                      {
                        Variable,
                        IsPresent: flag,
                      },
                      {
                        Variable,
                        ...(type === "boolean"
                          ? { IsBoolean: flag }
                          : type === "string"
                          ? { IsString: flag }
                          : { IsNumeric: flag }),
                      },
                    ],
                  };
                }
              } else {
                throw new Error(
                  `unsupported operand '${expr.op}' with 'typeof' expression.`
                );
              }
            } else if (
              isNullLiteralExpr(literalExpr) ||
              isUndefinedLiteralExpr(literalExpr)
            ) {
              const variableOutput = localEval(val);
              // todo support constants?
              if (!isVariable(variableOutput)) {
                throw new Error("");
              }

              if (expr.op === "!=") {
                return {
                  And: [
                    {
                      Variable: variableOutput.jsonPath,
                      IsPresent: true,
                    },
                    {
                      Variable: variableOutput.jsonPath,
                      IsNull: false,
                    },
                  ],
                };
              } else if (expr.op === "==") {
                return {
                  Or: [
                    {
                      Variable: variableOutput.jsonPath,
                      IsPresent: false,
                    },
                    {
                      Variable: variableOutput.jsonPath,
                      IsNull: true,
                    },
                  ],
                };
              }
            } else if (isStringLiteralExpr(literalExpr)) {
              const variableOutput = localEval(val);
              // todo support constants?
              if (!isVariable(variableOutput)) {
                throw new Error("");
              }

              const value = literalExpr.value;
              if (expr.op === "==") {
                return {
                  Variable: variableOutput.jsonPath,
                  StringEquals: value,
                };
              } else if (expr.op === "!=") {
                return {
                  Not: {
                    Variable: variableOutput.jsonPath,
                    StringEquals: value,
                  },
                };
              } else if (expr.op === "<") {
                return {
                  Variable: variableOutput.jsonPath,
                  StringLessThan: value,
                };
              } else if (expr.op === "<=") {
                return {
                  Variable: variableOutput.jsonPath,
                  StringLessThanEquals: value,
                };
              } else if (expr.op === ">") {
                return {
                  Variable: variableOutput.jsonPath,
                  StringGreaterThan: value,
                };
              } else if (expr.op === ">=") {
                return {
                  Variable: variableOutput.jsonPath,
                  StringGreaterThanEquals: value,
                };
              }
            } else if (isNumberLiteralExpr(literalExpr)) {
              const variableOutput = localEval(val);
              // todo support constants?
              if (!isVariable(variableOutput)) {
                throw new Error("");
              }

              const value = literalExpr.value;
              if (expr.op === "==") {
                return {
                  Variable: variableOutput.jsonPath,
                  NumericEquals: value,
                };
              } else if (expr.op === "!=") {
                return {
                  Not: {
                    Variable: variableOutput.jsonPath,
                    NumericEquals: value,
                  },
                };
              } else if (expr.op === "<") {
                return {
                  Variable: variableOutput.jsonPath,
                  NumericLessThan: value,
                };
              } else if (expr.op === "<=") {
                return {
                  Variable: variableOutput.jsonPath,
                  NumericLessThanEquals: value,
                };
              } else if (expr.op === ">") {
                return {
                  Variable: variableOutput.jsonPath,
                  NumericGreaterThan: value,
                };
              } else if (expr.op === ">=") {
                return {
                  Variable: variableOutput.jsonPath,
                  NumericGreaterThanEquals: value,
                };
              }
            }
          }
          if (
            isStringLiteralExpr(expr.left) ||
            isStringLiteralExpr(expr.right)
          ) {
          }
          // need typing information
          // return aws_stepfunctions.Condition.str
        }
      } else if (isVariableReference(expr) || isCallExpr(expr)) {
        const variableOutput = localEval(expr);
        // todo support constants?
        if (!isVariable(variableOutput)) {
          throw new Error("");
        }
        // if(expr) { ... }
        return ASL.isTruthy(variableOutput.jsonPath);
      } else if (isAwaitExpr(expr)) {
        return localToCondition(expr.expr);
      } else if (isPromiseExpr(expr)) {
        // if we find a promise, ensure it is wrapped in Await then unwrap it
        if (isAwaitExpr(expr.parent)) {
          return localToCondition(expr.expr);
        }
        throw new SynthError(
          ErrorCodes.Integration_must_be_immediately_awaited_or_returned
        );
      } else if (isPromiseArrayExpr(expr)) {
        // if we find a promise array, ensure it is wrapped in a Promise.all then unwrap it
        if (
          isArgument(expr.parent) &&
          isCallExpr(expr.parent.parent) &&
          isPromiseAll(expr.parent.parent)
        ) {
          return localToCondition(expr.expr);
        }
        throw new SynthError(
          ErrorCodes.Arrays_of_Integration_must_be_immediately_wrapped_in_Promise_all
        );
      }
      throw new Error(`cannot evaluate expression: '${expr.kind}`);
    };

    return [internal(), this.joinSubStates(expr, ...subStates)];
  }
}

export function isMapOrForEach(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr;
} {
  return (
    isPropAccessExpr(expr.expr) &&
    (expr.expr.name === "map" || expr.expr.name === "forEach")
  );
}

function isSlice(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "slice";
  };
} {
  return isPropAccessExpr(expr.expr) && expr.expr.name === "slice";
}

function isFilter(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "filter";
  };
} {
  return isPropAccessExpr(expr.expr) && expr.expr.name === "filter";
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
      (isCallExpr(node) &&
        (isReferenceExpr(node.expr) || isMapOrForEach(node))) ||
        isForInStmt(node) ||
        isForOfStmt(node)
        ? { hasTask: true }
        : isThrowStmt(node)
        ? { hasThrow: true }
        : {}
    );
}

function hasBreak(loop: ForInStmt | ForOfStmt | WhileStmt | DoStmt): boolean {
  for (const child of loop.children) {
    if (hasBreak(child)) {
      return true;
    }
  }
  return false;

  function hasBreak(node: FunctionlessNode): boolean {
    if (
      isForInStmt(node) ||
      isForOfStmt(node) ||
      isWhileStmt(node) ||
      isDoStmt(node)
    ) {
      return false;
    } else if (isBreakStmt(node)) {
      return true;
    } else {
      for (const child of node.children) {
        if (hasBreak(child)) {
          return true;
        }
      }
      return false;
    }
  }
}

export namespace ASL {
  /**
   * Used by integrations as a placeholder for the "Next" property of a task.
   *
   * When task.Next is ASL.DeferNext, Functionless will replace the Next with the appropriate value.
   * It may also add End or ResultPath based on the scenario.
   */
  export const DeferNext: string = "__DeferNext";

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

  export const and = (...cond: Condition[]): Condition => ({
    And: cond,
  });

  export const or = (...cond: Condition[]): Condition => ({
    Or: cond,
  });

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

  export const booleanEquals = (
    Variable: string,
    value: boolean
  ): Condition => ({
    BooleanEquals: value,
    Variable,
  });
}

/**
 * Formats a stateName given a statement.
 *
 * If a different node is used to supply the name (ex: a block uses it's first statement) then that node is returned.
 *
 * @returns [state name, optionally updated cache key (node)]
 */
function toStateName(
  node: FunctionlessNode
): [string | undefined, FunctionlessNode | undefined] {
  /**
   * Special case that updates the statement used (cache key)
   */
  if (isBlockStmt(node)) {
    if (node.isFinallyBlock()) {
      return ["finally", undefined];
    } else {
      return node.statements.length > 0
        ? [toStateName(node.statements[0])[0], node.statements[0]]
        : [undefined, undefined];
    }
  }
  function inner(node: Exclude<FunctionlessNode, BlockStmt>): string {
    if (isExpr(node)) {
      return exprToString(node);
    } else if (isIfStmt(node)) {
      return `if(${exprToString(node.when)})`;
    } else if (isExprStmt(node)) {
      return exprToString(node.expr);
    } else if (isBreakStmt(node)) {
      return "break";
    } else if (isContinueStmt(node)) {
      return "continue";
    } else if (isCatchClause(node)) {
      return `catch${
        node.variableDecl?.name ? `(${node.variableDecl?.name})` : ""
      }`;
    } else if (isDoStmt(node)) {
      return `while (${exprToString(node.condition)})`;
    } else if (isForInStmt(node)) {
      return `for(${node.variableDecl.name} in ${exprToString(node.expr)})`;
    } else if (isForOfStmt(node)) {
      return `for(${node.variableDecl.name} of ${exprToString(node.expr)})`;
    } else if (isReturnStmt(node)) {
      if (node.expr) {
        return `return ${exprToString(node.expr)}`;
      } else {
        return "return";
      }
    } else if (isThrowStmt(node)) {
      return `throw ${exprToString(node.expr)}`;
    } else if (isTryStmt(node)) {
      return "try";
    } else if (isVariableStmt(node)) {
      if (isCatchClause(node.parent)) {
        return `catch(${node.name})`;
      } else {
        return `${node.name} = ${
          node.expr ? exprToString(node.expr) : "undefined"
        }`;
      }
    } else if (isWhileStmt(node)) {
      return `while (${exprToString(node.condition)})`;
    } else if (isBindingElem(node)) {
      const binding = node.propertyName
        ? `${inner(node.propertyName)}: ${inner(node.name)}`
        : `${inner(node.name)}`;
      return node.initializer
        ? `${binding} = ${exprToString(node.initializer)}`
        : binding;
    } else if (isObjectBinding(node)) {
      return `{ ${node.bindings.map(inner).join(", ")} }`;
    } else if (isArrayBinding(node)) {
      return `[ ${node.bindings.map((b) => (!b ? "" : inner(b))).join(", ")} ]`;
    } else if (isFunctionDecl(node)) {
      return `function (${node.parameters.map(inner).join(",")})`;
    } else if (isParameterDecl(node)) {
      return isBindingPattern(node.name) ? inner(node.name) : node.name;
    } else if (isErr(node)) {
      throw node.error;
    } else {
      return assertNever(node);
    }
  }

  return [inner(node), undefined];
}

function exprToString(expr?: Expr): string {
  if (!expr) {
    return "";
  } else if (isArgument(expr)) {
    return exprToString(expr.expr);
  } else if (isArrayLiteralExpr(expr)) {
    return `[${expr.items.map(exprToString).join(", ")}]`;
  } else if (isBinaryExpr(expr)) {
    return `${exprToString(expr.left)} ${expr.op} ${exprToString(expr.right)}`;
  } else if (isBooleanLiteralExpr(expr)) {
    return `${expr.value}`;
  } else if (isCallExpr(expr) || isNewExpr(expr)) {
    return `${isNewExpr(expr) ? "new " : ""}${exprToString(
      expr.expr
    )}(${expr.args
      // Assume that undefined args are in order.
      .filter(
        (arg) =>
          arg.expr &&
          !(arg.name === "thisArg" && isUndefinedLiteralExpr(arg.expr))
      )
      .map((arg) => exprToString(arg.expr))
      .join(", ")})`;
  } else if (isConditionExpr(expr)) {
    return `if(${exprToString(expr.when)})`;
  } else if (isComputedPropertyNameExpr(expr)) {
    return `[${exprToString(expr.expr)}]`;
  } else if (isElementAccessExpr(expr)) {
    return `${exprToString(expr.expr)}[${exprToString(expr.element)}]`;
  } else if (isFunctionExpr(expr)) {
    return `function(${expr.parameters.map((param) => param.name).join(", ")})`;
  } else if (isIdentifier(expr)) {
    return expr.name;
  } else if (isNullLiteralExpr(expr)) {
    return "null";
  } else if (isNumberLiteralExpr(expr)) {
    return `${expr.value}`;
  } else if (isObjectLiteralExpr(expr)) {
    return `{${expr.properties.map(exprToString).join(", ")}}`;
  } else if (isPropAccessExpr(expr)) {
    return `${exprToString(expr.expr)}.${expr.name}`;
  } else if (isPropAssignExpr(expr)) {
    return `${
      isIdentifier(expr.name)
        ? expr.name.name
        : isStringLiteralExpr(expr.name)
        ? expr.name.value
        : isComputedPropertyNameExpr(expr.name)
        ? isStringLiteralExpr(expr.name.expr)
          ? expr.name.expr.value
          : exprToString(expr.name.expr)
        : assertNever(expr.name)
    }: ${exprToString(expr.expr)}`;
  } else if (isReferenceExpr(expr)) {
    return expr.name;
  } else if (isSpreadAssignExpr(expr)) {
    return `...${exprToString(expr.expr)}`;
  } else if (isSpreadElementExpr(expr)) {
    return `...${exprToString(expr.expr)}`;
  } else if (isStringLiteralExpr(expr)) {
    return `"${expr.value}"`;
  } else if (isTemplateExpr(expr)) {
    return `\`${expr.exprs
      .map((e) => (isStringLiteralExpr(e) ? e.value : exprToString(e)))
      .join("")}\``;
  } else if (isTypeOfExpr(expr)) {
    return `typeof ${exprToString(expr.expr)}`;
  } else if (isUnaryExpr(expr)) {
    return `${expr.op}${exprToString(expr.expr)}`;
  } else if (isPostfixUnaryExpr(expr)) {
    return `${exprToString(expr.expr)}${expr.op}`;
  } else if (isUndefinedLiteralExpr(expr)) {
    return "undefined";
  } else if (isAwaitExpr(expr)) {
    return `await ${exprToString(expr.expr)}`;
  } else if (isPromiseExpr(expr) || isPromiseArrayExpr(expr)) {
    return exprToString(expr.expr);
  } else {
    return assertNever(expr);
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
