import { aws_iam, aws_stepfunctions } from "aws-cdk-lib";
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
  NewExpr,
  NullLiteralExpr,
  PromiseExpr,
  PropAccessExpr,
  StringLiteralExpr,
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
export interface States {
  [stateName: string]: State;
}
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
 * Amazon States Language (ASL) Generator.
 */
export class ASL {
  /**
   * A friendly name to identify the Functionless Context.
   */
  static readonly ContextName = "Amazon States Language";
  /**
   * Tag this instance with its Functionless Context ({@link ASL.ContextName})
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
  private readonly stateNames = new Map<Stmt, string>();
  private readonly stateNamesCount = new Map<string, number>();
  private readonly generatedNames = new DeterministicNameGenerator();

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
        } else if (isBinaryExpr(node)) {
          const updated = visitEachChild(node, (expr) =>
            normalizeAST(expr, hoist)
          );
          return hoist && self.doHoist(node) ? hoist(updated) : updated;
        } else if (
          isArrayLiteralExpr(node) &&
          !node.items.some((i) => isFunctionExpr(i))
        ) {
          // if the array contains functions, just leave it, it is probably for Parallel.
          // This is short sighted, but should work now
          const updated = visitEachChild(node, (expr) =>
            normalizeAST(expr, hoist)
          );

          return hoist && self.doHoist(node) ? hoist(updated) : updated;
        }
        return visitEachChild(node, (expr) => normalizeAST(expr, hoist));
      }
    );

    const states = this.evalStmt(this.decl.body);

    const start = this.transition(this.decl.body);
    if (start === undefined) {
      throw new Error("State Machine has no States");
    }

    /**
     * Add some hard to manufacture constants to the machine.
     *
     * TODO: only add this when used?
     */
    const __fnl_context: Pass = {
      Type: "Pass",
      Parameters: {
        null: null,
        "input.$": "$",
      },
      ResultPath: "$.__fnl",
      Next: start,
    };

    this.definition = {
      StartAt: "__fnl_context",
      States: { __fnl_context: __fnl_context, ...states },
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
   * Gets a unique State name for the Stmt. This function always returns the same
   * name for the same {@link stmt} instance.
   *
   * The AST is stringified, truncated to < 75 characters and a monotonically incrementing
   * number is added as a suffix in the case where to {@link Stmt}s produce the same text.
   */
  public getStateName(stmt: Stmt): string {
    if (!this.stateNames.has(stmt)) {
      let [stateName, updatedStatement] = toStateName(stmt);
      if (updatedStatement && this.stateNames.has(updatedStatement)) {
        return this.stateNames.get(updatedStatement)!;
      }
      if (stateName === undefined) {
        throw new Error(`cannot transition to ${stmt.kind}`);
      }
      if (stateName.length > 75) {
        stateName = stateName.slice(0, 75);
      }
      if (this.stateNamesCount.has(stateName)) {
        const count = this.stateNamesCount.get(stateName)!;
        this.stateNamesCount.set(stateName, count + 1);
        stateName = `${stateName} ${count}`;
      } else {
        this.stateNamesCount.set(stateName, 1);
      }
      this.stateNames.set(updatedStatement ?? stmt, stateName);
    }
    return this.stateNames.get(stmt)!;
  }

  private rewriteNext(
    state: State,
    scope: string,
    scopeNames: Set<string>
  ): State {
    const updateIfInScopeNames = (next: string) =>
      scopeNames.has(next) ? this.scopedStateName(scope, next) : next;
    if (state.Type === "Choice") {
      return {
        ...state,
        Choices: state.Choices.map((choice) => ({
          ...choice,
          Next: updateIfInScopeNames(choice.Next),
        })),
        Default: state.Default
          ? updateIfInScopeNames(state.Default)
          : undefined,
      };
    } else if (!("Next" in state)) {
      return state;
    }
    return {
      ...state,
      Next: state.Next ? updateIfInScopeNames(state.Next) : state.Next,
    };
  }

  private scopedStateName(scope: string, localName: string) {
    if (localName === "default") {
      return scope;
    }
    return `${localName}__${scope}`;
  }

  private normalizeStates(name: string, states: State | States) {
    if ("Type" in states) {
      return {
        [name]: states as State,
      };
    } else {
      const localKeys = new Set(Object.keys(states));
      return Object.fromEntries(
        Object.entries(states).map(([key, state]) => {
          // re-write any Next states to reflect the updated state names.
          const updated = this.rewriteNext(state, name, localKeys);
          return [this.scopedStateName(name, key), updated];
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
      const expr = this.eval(stmt.expr, {
        Next: this.next(stmt),
        ResultPath: null,
      });

      return this.normalizeStates(name, expr);
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

      return {
        [this.getStateName(stmt)]: {
          Type: "Map",
          ...(Catch.length > 0 ? { Catch } : {}),
          ResultPath: null,
          ItemsPath: ASL.toJsonPath(stmt.expr),
          Next: this.next(stmt),
          MaxConcurrency: 1,
          Parameters: {
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
        },
      };
    } else if (isIfStmt(stmt)) {
      const states: States = {};
      const choices: Branch[] = [];

      let curr: Stmt | undefined = stmt;
      while (isIfStmt(curr)) {
        Object.assign(states, this.evalStmt(curr.then));

        choices.push({
          Next: this.getStateName(curr.then),
          ...ASL.toCondition(curr.when),
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

      return {
        [this.getStateName(stmt)]: {
          Type: "Choice",
          Choices: choices,
          Default: next ?? `0_empty_else_${this.getStateName(stmt)}`,
        },
        ...(next === undefined
          ? {
              [`0_empty_else_${this.getStateName(stmt)}`]: {
                Type: "Pass",
                End: true,
              },
            }
          : {}),
        ...states,
      };
    } else if (isReturnStmt(stmt)) {
      const parent = stmt.findParent(
        anyOf(isFunctionExpr, isForInStmt, isForOfStmt)
      );
      if (isForInStmt(parent) || isForOfStmt(parent)) {
        throw new Error(
          "a 'return' statement is not allowed within a for loop"
        );
      }

      if (isNullLiteralExpr(stmt.expr) || isUndefinedLiteralExpr(stmt.expr)) {
        return {
          [this.getStateName(stmt)]: {
            Type: "Pass",
            End: true,
            Parameters: {
              null: null,
            },
            OutputPath: "$.null",
          },
        };
      } else if (isVariableReference(stmt.expr)) {
        return {
          [this.getStateName(stmt)]: {
            Type: "Pass",
            End: true,
            OutputPath: ASL.toJsonPath(stmt.expr),
          },
        };
      }
      const name = this.getStateName(stmt);
      const expr = this.eval(stmt.expr, {
        ResultPath: "$",
        End: true,
      });

      return this.normalizeStates(name, expr);
    } else if (isVariableStmt(stmt)) {
      if (stmt.expr === undefined) {
        return {};
      }

      const name = this.getStateName(stmt);
      const expr = this.eval(stmt.expr, {
        ResultPath: `$.${stmt.name}`,
        Next: this.next(stmt),
      });

      return this.normalizeStates(name, expr);
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

      const error = updated.args
        .filter((arg): arg is Argument & { expr: Expr } => !!arg.expr)
        .reduce(
          (args: any, arg) => ({
            ...args,
            [arg.name!]: ASL.toJson(arg.expr),
          }),
          {}
        );

      const throwTransition = this.throw(stmt);
      if (throwTransition === undefined) {
        return {
          [this.getStateName(stmt)]: {
            Type: "Fail",
            Error: exprToString((stmt.expr as NewExpr).expr),
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
        throw new Error(`a ${stmt.kind} block must have at least one Stmt`);
      }
      const whenFalse = this.next(stmt);
      return {
        [this.getStateName(stmt)]: {
          Type: "Choice",
          Choices: [
            {
              ...ASL.toCondition(stmt.condition),
              Next: whenTrue,
            },
          ],
          Default: whenFalse,
        },
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
  public eval(
    expr: Expr,
    props: {
      ResultPath: string | null;
      End?: true;
      Next?: string;
    }
  ): State | States {
    if (props.End === undefined && props.Next === undefined) {
      // Hack: delete props.Next when End is true to clean up test cases
      // TODO: make this cleaner somehow?
      delete props.Next;
      props.End = true;
    }
    if (isPromiseExpr(expr)) {
      // if we find a promise, ensure it is wrapped in Await or returned then unwrap it
      if (isAwaitExpr(expr.parent) || isReturnStmt(expr.parent)) {
        return this.eval(expr.expr, props);
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
        return this.eval(expr.expr, props);
      }
      throw new SynthError(
        ErrorCodes.Arrays_of_Integration_must_be_immediately_wrapped_in_Promise_all
      );
    } else if (isCallExpr(expr)) {
      if (isReferenceExpr(expr.expr)) {
        const ref = expr.expr.ref();
        if (isIntegration<Integration>(ref)) {
          const serviceCall = new IntegrationImpl(ref);
          const partialTask = serviceCall.asl(expr, this);

          const { End, Next } = props;

          /**
           * Step functions can fail to deploy when extraneous properties are left on state nodes.
           * Only inject the properties the state type can handle.
           *
           * For example: https://github.com/functionless/functionless/issues/308
           * A Wait state with `ResultPath: null` was failing to deploy.
           */
          const taskState = ((): State => {
            const partialState = partialTask as State;
            if (partialState.Type === "Wait") {
              return {
                ...(partialState as Omit<Wait, "Next">),
                ...{ End, Next },
              };
            } else if (partialState.Type === "Choice") {
              return {
                ...partialState,
                Choices: partialState.Choices.map((choice) => ({
                  ...choice,
                  // TODO: inject a default end node
                  Next: Next!,
                })),
                // do we always want to inject a default?
                Default: Next,
              };
            } else if (
              partialState.Type === "Fail" ||
              partialState.Type === "Succeed"
            ) {
              return partialState as Choice | Fail | Succeed;
            } else if (
              partialState.Type === "Task" ||
              partialState.Type === "Parallel" ||
              partialState.Type === "Pass" ||
              partialState.Type === "Map"
            ) {
              return {
                ...partialState,
                ...props,
              } as Task | ParallelTask | Pass | MapTask;
            }
            assertNever(partialState);
          })();

          const throwOrPass = this.throw(expr);
          if (throwOrPass?.Next) {
            return <State>{
              ...taskState,
              Catch: [
                {
                  ErrorEquals: ["States.ALL"],
                  Next: throwOrPass.Next,
                  ResultPath: throwOrPass.ResultPath,
                },
              ],
            };
          } else {
            return taskState;
          }
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

          const listPath = ASL.toJsonPath(expr.expr.expr);
          return {
            Type: "Map",
            MaxConcurrency: 1,
            Iterator: {
              States: callbackStates,
              StartAt: callbackStart,
            },
            ...props,
            ItemsPath: listPath,
            Parameters: Object.fromEntries(
              callbackfn.parameters.map((param, i) => [
                `${param.name}.$`,
                i === 0
                  ? "$$.Map.Item.Value"
                  : i == 1
                  ? "$$.Map.Item.Index"
                  : listPath,
              ])
            ),
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
          };
        }
      } else if (isSlice(expr)) {
        return {
          Type: "Pass",
          ...props,
          InputPath: ASL.toJsonPath(expr),
        };
      } else if (isFilter(expr)) {
        const predicate = expr.getArgument("predicate")?.expr;
        if (predicate !== undefined && isFunctionExpr(predicate)) {
          try {
            // first try to implement filter optimally with JSON Path
            return {
              Type: "Pass",
              ...props,
              InputPath: ASL.toJsonPath(expr),
            };
          } catch {
            throw new Error(".filter with sub-tasks are not yet supported");
          }
        }
      } else if (isPromiseAll(expr)) {
        const values = expr.getArgument("values");
        // just validate Promise.all and continue, will validate the PromiseArray later.
        if (values?.expr && isPromiseArrayExpr(values?.expr)) {
          return this.eval(values.expr, props);
        }
        throw new SynthError(ErrorCodes.Unsupported_Use_of_Promises);
      }
      throw new Error(
        `call must be a service call or list .slice, .map, .forEach or .filter, ${expr}`
      );
    } else if (isVariableReference(expr)) {
      return {
        Type: "Pass",
        Parameters: {
          [`result${isLiteralExpr(expr) ? "" : ".$"}`]: ASL.toJsonPath(expr),
        },
        OutputPath: "$.result",
        ...props,
      };
    } else if (isObjectLiteralExpr(expr)) {
      return {
        Type: "Pass",
        Parameters: ASL.toJson(expr),
        ...props,
      };
    } else if (isLiteralExpr(expr)) {
      return {
        Type: "Pass",
        Result: ASL.toJson(expr),
        ...props,
      };
    } else if (
      isBinaryExpr(expr) &&
      expr.op === "=" &&
      (isVariableReference(expr.left) || isIdentifier(expr.left))
    ) {
      if (isNullLiteralExpr(expr.right)) {
        return {
          Type: "Pass",
          ...props,
          Parameters: {
            ...Object.fromEntries(
              expr.getVisibleNames().map((name) => [`${name}.$`, `$.${name}`])
            ),
            [ASL.toJsonPath(expr.left)]: null,
          },
        };
      } else if (isVariableReference(expr.right)) {
        return {
          Type: "Pass",
          ...props,
          InputPath: ASL.toJsonPath(expr.right),
          ResultPath: ASL.toJsonPath(expr.left),
        };
      } else if (
        isLiteralExpr(expr.right) ||
        isUnaryExpr(expr.right) ||
        isBinaryExpr(expr.right)
      ) {
        return {
          Type: "Pass",
          ...props,
          Parameters: ASL.toJson(expr.right),
          ResultPath: ASL.toJsonPath(expr.left),
        };
      } else if (isAwaitExpr(expr.right) || isCallExpr(expr.right)) {
        return this.eval(expr.right, {
          ...props,
          ResultPath: ASL.toJsonPath(expr.left),
        });
      }
    } else if (isBinaryExpr(expr)) {
      if (expr.op === "&&" || expr.op === "||") {
        return {
          default: {
            Type: "Choice",
            Choices: [{ ...ASL.toCondition(expr), Next: "assignTrue" }],
            Default: "assignFalse",
          },
          assignTrue: {
            Type: "Pass",
            Result: true,
            ...props,
          },
          assignFalse: {
            Type: "Pass",
            Result: false,
            ...props,
          },
        };
      } else if (expr.op === "??") {
        // literal ?? anything
        if (isLiteralExpr(expr.left)) {
          if (
            isNullLiteralExpr(expr.left) ||
            isUndefinedLiteralExpr(expr.left)
          ) {
            return {
              Type: "Pass",
              ...ASL.toTaskInput(expr.right),
              ...props,
            };
          } else {
            return {
              Type: "Pass",
              ...ASL.toTaskInput(expr.left),
              ...props,
            };
          }
        }
        const left = ASL.toJsonPath(expr.left);
        return {
          default: {
            Type: "Choice",
            Choices: [
              {
                ...ASL.and(ASL.isPresent(left), ASL.isNotNull(left)),
                Next: "takeLeft",
              },
            ],
            Default: "takeRight",
          },
          takeLeft: {
            Type: "Pass",
            InputPath: left,
            ...props,
          },
          takeRight: {
            Type: "Pass",
            ...ASL.toTaskInput(expr.right),
            ...props,
          },
        };
      }

      // TODO: assert never
      throw new SynthError(
        ErrorCodes.Unsupported_Feature,
        `Step Function does not support operator ${expr.op}`
      );
    } else if (isAwaitExpr(expr)) {
      return this.eval(expr.expr, props);
    }
    throw new Error(`cannot eval expression kind '${expr.kind}'`);
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
  export function toJson(expr?: Expr): any {
    if (expr === undefined) {
      return undefined;
    }

    // check if the value resolves to a constant
    const constant = evalToConstant(expr);
    if (constant !== undefined) {
      if (isFunction(constant.constant)) {
        return constant.constant.resource.functionArn;
      } else if (isStepFunction(constant.constant)) {
        return constant.constant.resource.stateMachineArn;
      } else if (isTable(constant.constant)) {
        return constant.constant.resource.tableName;
      }
      return constant.constant;
    } else if (isArgument(expr)) {
      return toJson(expr.expr);
    } else if (isBinaryExpr(expr)) {
    } else if (isCallExpr(expr)) {
      if (isSlice(expr)) {
        return sliceToJsonPath(expr);
      } else if (isFilter(expr)) {
        return filterToJsonPath(expr);
      }
    } else if (isIdentifier(expr)) {
      return toJsonPath(expr);
    } else if (isPropAccessExpr(expr)) {
      return `${toJson(expr.expr)}.${expr.name}`;
    } else if (isElementAccessExpr(expr)) {
      return toJsonPath(expr);
    } else if (isArrayLiteralExpr(expr)) {
      if (expr.items.find(isVariableReference) !== undefined) {
        return `States.Array(${expr.items
          .map((item) => toJsonPath(item))
          .join(", ")})`;
      }
      return expr.items.map((item) => toJson(item));
    } else if (isObjectLiteralExpr(expr)) {
      const payload: any = {};
      for (const prop of expr.properties) {
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
          payload[
            `${
              isIdentifier(prop.name)
                ? prop.name.name
                : isStringLiteralExpr(prop.name)
                ? prop.name.value
                : (prop.name.expr as StringLiteralExpr).value
            }${
              isLiteralExpr(prop.expr) || isReferenceExpr(prop.expr) ? "" : ".$"
            }`
          ] = toJson(prop.expr);
        } else {
          throw new Error(
            "computed name of PropAssignExpr is not supported in Amazon States Language"
          );
        }
      }
      return payload;
    } else if (isLiteralExpr(expr)) {
      return expr.value ?? null;
    } else if (isTemplateExpr(expr)) {
      return `States.Format('${expr.exprs
        .map((e) => (isLiteralExpr(e) ? toJson(e) : "{}"))
        .join("")}',${expr.exprs
        .filter((e) => !isLiteralExpr(e))
        .map((e) => toJsonPath(e))})`;
    }
    throw new Error(`cannot evaluate ${expr.kind} to JSON`);
  }

  export function toJsonPath(expr: Expr): string {
    if (isArrayLiteralExpr(expr)) {
      return aws_stepfunctions.JsonPath.array(
        ...expr.items.map((item) => toJsonPath(item))
      );
    } else if (isCallExpr(expr)) {
      if (isSlice(expr)) {
        return sliceToJsonPath(expr);
      } else if (isFilter(expr)) {
        return filterToJsonPath(expr);
      }
    } else if (isIdentifier(expr)) {
      const ref = expr.lookup();
      // If the identifier references a parameter expression and that parameter expression
      // is in a FunctionDecl and that Function is at the top (no parent).
      // This logic needs to be updated to support destructured inputs: https://github.com/functionless/functionless/issues/68
      if (ref && isParameterDecl(ref) && isFunctionDecl(ref.parent)) {
        return "$.__fnl.input";
      }
      return `$.${expr.name}`;
    } else if (isPropAccessExpr(expr)) {
      return `${toJsonPath(expr.expr)}.${expr.name}`;
    } else if (isElementAccessExpr(expr)) {
      return elementAccessExprToJsonPath(expr);
    }

    throw new Error(
      `expression kind '${expr.kind}' cannot be evaluated to a JSON Path expression.`
    );
  }

  /**
   * Retrieves a partial {@link Task} which can set the value as the input to a Task.
   *
   * Works with Task, Pass, possibly other states.
   *
   * ex: func("someString")
   * {
   *    Type: "Task",
   *    Parameters: "someString"
   * }
   *
   * ex: func(someVariable)
   * {
   *    Type: "Task",
   *    InputPath: "$.someVariable"
   * }
   */
  export function toTaskInput(
    expr?: Expr
  ): Pick<Task, "Parameters" | "InputPath"> {
    if (!expr) {
      return {
        Parameters: undefined,
      };
    } else if (isUndefinedLiteralExpr(expr)) {
      throw new SynthError(
        ErrorCodes.Step_Functions_does_not_support_undefined_assignment
      );
    } else if (isArrayLiteralExpr(expr)) {
      throw new SynthError(
        ErrorCodes.Unexpected_Error,
        "Array literals should be hoisted to their own variable before assignment or passing"
      );
    }
    return isVariableReference(expr)
      ? {
          InputPath: ASL.toJsonPath(expr),
        }
      : isLiteralExpr(expr)
      ? isStringLiteralExpr(expr) ||
        isNumberLiteralExpr(expr) ||
        isBooleanLiteralExpr(expr)
        ? {
            Parameters: expr.value,
          }
        : isNullLiteralExpr(expr)
        ? { InputPath: "$.__fnl.null" }
        : isObjectLiteralExpr(expr)
        ? { Parameters: ASL.toJson(expr) }
        : assertNever(expr)
      : {
          Parameters: ASL.toJson(expr),
        };
  }

  function sliceToJsonPath(expr: CallExpr & { expr: PropAccessExpr }) {
    const startArg = expr.getArgument("start")?.expr;
    const endArg = expr.getArgument("end")?.expr;
    if (startArg === undefined && endArg === undefined) {
      // .slice()
      return toJsonPath(expr.expr.expr);
    } else if (startArg !== undefined) {
      const startConst = evalToConstant(startArg)?.constant;
      if (startConst === undefined) {
        throw new Error(
          "the 'start' argument of slice must be a literal number"
        );
      }
      if (endArg === undefined) {
        // slice(x)
        return `${toJsonPath(expr.expr.expr)}[${startConst}:]`;
      } else {
        const endConst = evalToConstant(endArg);
        if (
          endConst === undefined ||
          (endConst.constant !== undefined &&
            typeof endConst.constant !== "number")
        ) {
          throw new Error(
            "the 'end' argument of slice must be a literal number"
          );
        }
        if (endConst.constant === undefined) {
          // explicit undefined passed to slice should be treated the same as not provided
          return `${toJsonPath(expr.expr.expr)}[${startConst}:]`;
        } else {
          return `${toJsonPath(expr.expr.expr)}[${startConst}:${
            endConst.constant
          }]`;
        }
      }
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
  export function toJsonAssignment(
    key: string,
    expr: Expr
  ): Record<string, any> {
    const value = ASL.toJson(expr);

    return {
      [isVariableReference(expr) ? `${key}.$` : key]: value,
    };
  }

  function filterToJsonPath(expr: CallExpr & { expr: PropAccessExpr }): string {
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

    return `${toJsonPath(expr.expr.expr)}[?(${toFilterCondition(stmt.expr)})]`;

    function toFilterCondition(expr: Expr): string {
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
        return `${toFilterCondition(expr.expr)}[${elementToJsonPath(
          expr.element
        )}]`;
      }

      throw new Error(
        `JSONPath's filter expression does not support '${exprToString(expr)}'`
      );
    }
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
  function elementAccessExprToJsonPath(expr: ElementAccessExpr): string {
    if (isIdentifier(expr.element) && isIdentifier(expr.expr)) {
      const element = expr.element.lookup();
      if (
        isVariableStmt(element) &&
        isForInStmt(element.parent) &&
        expr.findParent(isForInStmt) === element.parent
      ) {
        return `$.0_${element.name}`;
      } else {
        throw new Error(
          "cannot use an Identifier to index an Array or Object except for an array in a for-in statement"
        );
      }
    }
    return `${toJsonPath(expr.expr)}[${elementToJsonPath(expr.element)}]`;
  }

  function elementToJsonPath(expr: Expr): string {
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

  export function toCondition(expr: Expr): Condition {
    if (isBooleanLiteralExpr(expr)) {
      return {
        IsPresent: !expr.value,
        Variable: `$.0_${expr.value}`,
      };
    } else if (isUnaryExpr(expr)) {
      return {
        Not: toCondition(expr.expr),
      };
    } else if (isBinaryExpr(expr)) {
      if (expr.op === "&&") {
        return {
          And: [toCondition(expr.left), toCondition(expr.right)],
        };
      } else if (expr.op === "||") {
        return {
          Or: [toCondition(expr.left), toCondition(expr.right)],
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

            if (!isStringLiteralExpr(literalExpr)) {
              throw new Error(
                'typeof expression can only be compared against a string literal, such as typeof x === "string"'
              );
            }

            const type = literalExpr.value as typeof supportedTypeNames[number];
            if (!supportedTypeNames.includes(type)) {
              throw new Error(`unsupported typeof comparison: "${type}"`);
            }
            const Variable = toJsonPath(val.expr);
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
            if (expr.op === "!=") {
              return {
                And: [
                  {
                    Variable: toJsonPath(val),
                    IsPresent: true,
                  },
                  {
                    Variable: toJsonPath(val),
                    IsNull: false,
                  },
                ],
              };
            } else if (expr.op === "==") {
              return {
                Or: [
                  {
                    Variable: toJsonPath(val),
                    IsPresent: false,
                  },
                  {
                    Variable: toJsonPath(val),
                    IsNull: true,
                  },
                ],
              };
            }
          } else if (isStringLiteralExpr(literalExpr)) {
            const [variable, value] = [
              toJsonPath(val),
              literalExpr.value,
            ] as const;
            if (expr.op === "==") {
              return {
                Variable: variable,
                StringEquals: value,
              };
            } else if (expr.op === "!=") {
              return {
                Not: {
                  Variable: variable,
                  StringEquals: value,
                },
              };
            } else if (expr.op === "<") {
              return {
                Variable: variable,
                StringLessThan: value,
              };
            } else if (expr.op === "<=") {
              return {
                Variable: variable,
                StringLessThanEquals: value,
              };
            } else if (expr.op === ">") {
              return {
                Variable: variable,
                StringGreaterThan: value,
              };
            } else if (expr.op === ">=") {
              return {
                Variable: variable,
                StringGreaterThanEquals: value,
              };
            }
          } else if (isNumberLiteralExpr(literalExpr)) {
            const [variable, value] = [
              toJsonPath(val),
              literalExpr.value,
            ] as const;
            if (expr.op === "==") {
              return {
                Variable: variable,
                NumericEquals: value,
              };
            } else if (expr.op === "!=") {
              return {
                Not: {
                  Variable: variable,
                  NumericEquals: value,
                },
              };
            } else if (expr.op === "<") {
              return {
                Variable: variable,
                NumericLessThan: value,
              };
            } else if (expr.op === "<=") {
              return {
                Variable: variable,
                NumericLessThanEquals: value,
              };
            } else if (expr.op === ">") {
              return {
                Variable: variable,
                NumericGreaterThan: value,
              };
            } else if (expr.op === ">=") {
              return {
                Variable: variable,
                NumericGreaterThanEquals: value,
              };
            }
          }
        }
        if (isStringLiteralExpr(expr.left) || isStringLiteralExpr(expr.right)) {
        }
        // need typing information
        // return aws_stepfunctions.Condition.str
      }
    } else if (isVariableReference(expr)) {
      // if(expr) { ... }
      return isTruthy(ASL.toJsonPath(expr));
    }
    throw new Error(`cannot evaluate expression: '${expr.kind}`);
  }
}

/**
 * Formats a stateName given a statement.
 *
 * If a different node is used to supply the name (ex: a block uses it's first statement) then that node is returned.
 *
 * @returns [state name, optionally updated cache key (node)]
 */
function toStateName(stmt: Stmt): [string | undefined, Stmt | undefined] {
  /**
   * Special case that updates the statement used (cache key)
   */
  if (isBlockStmt(stmt)) {
    if (stmt.isFinallyBlock()) {
      return ["finally", undefined];
    } else {
      return stmt.statements.length > 0
        ? [toStateName(stmt.statements[0])[0], stmt.statements[0]]
        : [undefined, undefined];
    }
  }
  const name = (() => {
    if (isIfStmt(stmt)) {
      return `if(${exprToString(stmt.when)})`;
    } else if (isExprStmt(stmt)) {
      return exprToString(stmt.expr);
    } else if (isBreakStmt(stmt)) {
      return "break";
    } else if (isContinueStmt(stmt)) {
      return "continue";
    } else if (isCatchClause(stmt)) {
      return `catch${
        stmt.variableDecl?.name ? `(${stmt.variableDecl?.name})` : ""
      }`;
    } else if (isDoStmt(stmt)) {
      return `while (${exprToString(stmt.condition)})`;
    } else if (isForInStmt(stmt)) {
      return `for(${stmt.variableDecl.name} in ${exprToString(stmt.expr)})`;
    } else if (isForOfStmt(stmt)) {
      return `for(${stmt.variableDecl.name} of ${exprToString(stmt.expr)})`;
    } else if (isReturnStmt(stmt)) {
      if (stmt.expr) {
        return `return ${exprToString(stmt.expr)}`;
      } else {
        return "return";
      }
    } else if (isThrowStmt(stmt)) {
      return `throw ${exprToString(stmt.expr)}`;
    } else if (isTryStmt(stmt)) {
      return "try";
    } else if (isVariableStmt(stmt)) {
      if (isCatchClause(stmt.parent)) {
        return `catch(${stmt.name})`;
      } else {
        return `${stmt.name} = ${
          stmt.expr ? exprToString(stmt.expr) : "undefined"
        }`;
      }
    } else if (isWhileStmt(stmt)) {
      return `while (${exprToString(stmt.condition)})`;
    } else {
      return assertNever(stmt);
    }
  })();

  return [name, undefined];
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
