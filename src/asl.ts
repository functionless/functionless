import { aws_iam, aws_stepfunctions } from "aws-cdk-lib";
import { Construct } from "constructs";

import { assertNever } from "./assert";
import { FunctionDecl, isParameterDecl, isFunctionDecl } from "./declaration";
import {
  Argument,
  CallExpr,
  ElementAccessExpr,
  Expr,
  Identifier,
  isBinaryExpr,
  isCallExpr,
  isFunctionExpr,
  isLiteralExpr,
  isNullLiteralExpr,
  isReferenceExpr,
  isTypeOfExpr,
  isUnaryExpr,
  isVariableReference,
  NewExpr,
  NullLiteralExpr,
  PropAccessExpr,
  StringLiteralExpr,
} from "./expression";
import { isFunction } from "./function";
import { findIntegration } from "./integration";
import { FunctionlessNode } from "./node";
import {
  BlockStmt,
  DoStmt,
  FinallyBlock,
  ForInStmt,
  ForOfStmt,
  IfStmt,
  isBlockStmt,
  isDoStmt,
  isForInStmt,
  isForOfStmt,
  isWhileStmt,
  ReturnStmt,
  Stmt,
  VariableStmt,
  WhileStmt,
} from "./statement";
import { isStepFunction } from "./step-function";
import { isTable } from "./table";
import { anyOf, evalToConstant } from "./util";
import { visitEachChild } from "./visit";

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
  private readonly generatedNames = new Map<FunctionlessNode, string>();

  constructor(
    readonly scope: Construct,
    readonly role: aws_iam.IRole,
    decl: FunctionDecl
  ) {
    const self = this;
    this.decl = visitEachChild(decl, function normalizeAST(node):
      | FunctionlessNode
      | FunctionlessNode[] {
      if (
        node.kind === "BlockStmt" &&
        (node.parent?.kind === "FunctionExpr" ||
          node.parent?.kind === "FunctionDecl")
      ) {
        // re-write the AST to include explicit `ReturnStmt(NullLiteral())` statements
        // this simplifies the interpreter code by always having a node to chain onto, even when
        // the AST has no final `ReturnStmt` (i.e. when the function is a void function)
        // without this, chains that should return null will actually include the entire state as their output
        if (node.lastStmt === undefined) {
          return new BlockStmt([new ReturnStmt(new NullLiteralExpr())]);
        } else if (!node.lastStmt.isTerminal()) {
          return new BlockStmt([
            ...node.statements.map((stmt) =>
              visitEachChild(stmt, normalizeAST)
            ),
            new ReturnStmt(new NullLiteralExpr()),
          ]);
        }
      } else if (
        node.kind === "ExprStmt" ||
        node.kind === "VariableStmt" ||
        node.kind === "ReturnStmt"
      ) {
        const expr = node.expr;
        if (expr?.kind === "CallExpr") {
          // reduce nested Tasks to individual Statements
          const nestedTasks = expr.children.flatMap(function findTasks(
            node: FunctionlessNode
          ): CallExpr[] {
            if (isTask(node)) {
              return [node, ...node.collectChildren(findTasks)];
            } else if (node.kind === "FunctionExpr") {
              // do not recurse into FunctionExpr - they do not need to be hoisted
              return [];
            } else {
              return node.collectChildren(findTasks);
            }
          });

          function isTask(node: FunctionlessNode): node is CallExpr {
            return (
              node.kind === "CallExpr" && findIntegration(node) !== undefined
            );
          }

          if (nestedTasks.length > 0) {
            const nestedTaskSet = new Set<FunctionlessNode>(nestedTasks);

            // walks through the tree and replaces nodes with an Identifier referencing the
            // result of their pre-computed value - this normalizes the whole AST into
            // a linear sequence of `variable = constant or computation` operations.
            const replaced = (function replaceTasks(
              node: FunctionlessNode
            ): FunctionlessNode | FunctionlessNode[] {
              if (nestedTaskSet.has(node)) {
                return new Identifier(self.getDeterministicGeneratedName(node));
              } else {
                return visitEachChild(node, replaceTasks);
              }
            })(node);

            return [
              // hoist all nested calls to individual VariableStmt(CallExpr())
              ...nestedTasks.map(
                (task) =>
                  new VariableStmt(
                    self.getDeterministicGeneratedName(task),
                    task.clone()
                  )
              ),
              ...(Array.isArray(replaced) ? replaced : [replaced]),
            ];
          }
        }
      }
      return visitEachChild(node, normalizeAST);
    });

    const states = this.execute(this.decl.body);

    const start = this.transition(this.decl.body);
    if (start === undefined) {
      throw new Error("State Machine has no States");
    }

    this.definition = {
      StartAt: start,
      States: states,
    };
  }

  /**
   * Generate a deterministic and unique variable name for a node.
   *
   * The value is cached so that the same node reference always has the same name.
   *
   * @param node the node to generate a name for
   * @returns a unique variable name that can be used in JSON Path
   */
  private getDeterministicGeneratedName(node: FunctionlessNode): string {
    if (!this.generatedNames.has(node)) {
      this.generatedNames.set(node, `${this.generatedNames.size}_tmp`);
    }
    return this.generatedNames.get(node)!;
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
      let stateName = toStateName(stmt);
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
      this.stateNames.set(stmt, stateName);
    }
    return this.stateNames.get(stmt)!;
  }

  public execute(stmt: Stmt): States {
    if (stmt.kind === "BlockStmt") {
      return stmt.statements.reduce(
        (states: States, s) => ({
          ...states,
          ...this.execute(s),
        }),
        {}
      );
    } else if (stmt.kind === "BreakStmt") {
      const loop = stmt.findParent(
        anyOf(isForOfStmt, isForInStmt, isWhileStmt, isDoStmt)
      );
      if (loop === undefined) {
        throw new Error("Stack Underflow");
      }

      return {
        [this.getStateName(stmt)]:
          loop.kind === "ForInStmt" || loop.kind === "ForOfStmt"
            ? {
                Type: "Fail",
                Error: "Break",
              }
            : {
                Type: "Pass",
                Next: this.next(loop),
              },
      };
    } else if (stmt.kind === "ContinueStmt") {
      const loop = stmt.findParent(
        anyOf(isForOfStmt, isForInStmt, isWhileStmt, isDoStmt)
      );
      if (loop === undefined) {
        throw new Error("Stack Underflow");
      }

      return {
        [this.getStateName(stmt)]:
          loop.kind === "ForInStmt" || loop.kind === "ForOfStmt"
            ? {
                Type: "Pass",
                End: true,
                ResultPath: null,
              }
            : loop.kind === "WhileStmt"
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
    } else if (stmt.kind === "ExprStmt") {
      return {
        [this.getStateName(stmt)]: this.eval(stmt.expr, {
          Next: this.next(stmt),
          ResultPath: null,
        }),
      };
    } else if (stmt.kind === "ForOfStmt" || stmt.kind === "ForInStmt") {
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
            ...(stmt.kind === "ForInStmt"
              ? {
                  // use special `0_` prefix (impossible variable name in JavaScript)
                  // to store a reference to the value so that we can implement array index
                  // for (const i in items) {
                  //   items[i] // $$.Map.Item.Value
                  // }
                  [`0_${stmt.variableDecl.name}.$`]: "$$.Map.Item.Value",
                }
              : {}),
            [`${stmt.variableDecl.name}.$`]:
              stmt.kind === "ForOfStmt"
                ? "$$.Map.Item.Value"
                : "$$.Map.Item.Index",
          },
          Iterator: {
            StartAt: this.getStateName(stmt.body.step()!),
            States: this.execute(stmt.body),
          },
        },
      };
    } else if (stmt.kind === "IfStmt") {
      const states: States = {};
      const choices: Branch[] = [];

      let curr: IfStmt | BlockStmt | undefined = stmt;
      while (curr?.kind === "IfStmt") {
        Object.assign(states, this.execute(curr.then));

        choices.push({
          Next: this.getStateName(curr.then.statements[0]),
          ...ASL.toCondition(curr.when),
        });
        curr = curr._else;
      }
      if (curr?.kind === "BlockStmt") {
        Object.assign(states, this.execute(curr));
      }
      const next =
        curr === undefined
          ? this.next(stmt)
          : // there was an else
            this.getStateName(curr.statements[0]);

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
    } else if (stmt.kind === "ReturnStmt") {
      const parent = stmt.findParent(
        anyOf(isFunctionExpr, isForInStmt, isForOfStmt)
      );
      if (parent?.kind === "ForInStmt" || parent?.kind === "ForOfStmt") {
        throw new Error(
          "a 'return' statement is not allowed within a for loop"
        );
      }

      if (
        stmt.expr.kind === "NullLiteralExpr" ||
        stmt.expr.kind === "UndefinedLiteralExpr"
      ) {
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
      return {
        [this.getStateName(stmt)]: this.eval(stmt.expr, {
          ResultPath: "$",
          End: true,
        }),
      };
    } else if (stmt.kind === "VariableStmt") {
      if (stmt.expr === undefined) {
        return {};
      }

      return {
        [this.getStateName(stmt)]: this.eval(stmt.expr, {
          ResultPath: `$.${stmt.name}`,
          Next: this.next(stmt),
        }),
      };
    } else if (stmt.kind === "ThrowStmt") {
      if (stmt.expr.kind !== "NewExpr" && stmt.expr.kind !== "CallExpr") {
        throw new Error(
          "the expr of a ThrowStmt must be a NewExpr or CallExpr"
        );
      }

      const error = (stmt.expr as NewExpr | CallExpr).args
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
    } else if (stmt.kind === "TryStmt") {
      const tryFlow = analyzeFlow(stmt.tryBlock);

      const errorVariableName = stmt.catchClause.variableDecl?.name;

      return {
        ...this.execute(stmt.tryBlock),
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
        ...this.execute(stmt.catchClause.block),
        ...(stmt.finallyBlock
          ? {
              ...this.execute(stmt.finallyBlock),
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
                            Variable: `$.${this.getDeterministicGeneratedName(
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
    } else if (stmt.kind === "CatchClause") {
      return this.execute(stmt.block);
    } else if (stmt.kind === "WhileStmt" || stmt.kind === "DoStmt") {
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
        ...this.execute(stmt.block),
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
  ): State {
    if (props.End === undefined && props.Next === undefined) {
      // Hack: delete props.Next when End is true to clean up test cases
      // TODO: make this cleaner somehow?
      delete props.Next;
      props.End = true;
    }
    if (expr.kind === "CallExpr") {
      const serviceCall = findIntegration(expr);
      if (serviceCall) {
        if (
          expr.expr.kind === "PropAccessExpr" &&
          (expr.expr.name === "waitFor" || expr.expr.name === "waitUntil")
        ) {
          delete (props as any).ResultPath;
          return <State>{
            ...serviceCall.asl(expr, this),
            ...props,
          };
        }

        const taskState = <State>{
          ...serviceCall.asl(expr, this),
          ...props,
        };

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
      } else if (isMapOrForEach(expr)) {
        const throwTransition = this.throw(expr);

        const callbackfn = expr.getArgument("callbackfn")?.expr;
        if (callbackfn !== undefined && callbackfn.kind === "FunctionExpr") {
          const callbackStates = this.execute(callbackfn.body);
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
        if (predicate !== undefined && predicate.kind === "FunctionExpr") {
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
    } else if (expr.kind === "ObjectLiteralExpr") {
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
      expr.kind === "BinaryExpr" &&
      expr.op === "=" &&
      isVariableReference(expr.left)
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
      } else if (isCallExpr(expr.right)) {
        return this.eval(expr.right, {
          ...props,
          ResultPath: ASL.toJsonPath(expr.left),
        });
      }
    } else if (expr.kind === "BinaryExpr") {
      // TODO
    }
    debugger;
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
    } else if (stmt.kind === "CatchClause") {
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
    } else if (stmt.kind === "BlockStmt") {
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
    if (node.kind === "ReturnStmt") {
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
        if (scope.kind === "ForInStmt" || scope.kind === "ForOfStmt") {
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
    } else if (node.kind === "FunctionDecl" || node.kind === "FunctionExpr") {
      return this.getStateName(node.body.lastStmt!);
    } else if (node.kind === "ForInStmt" || node.kind === "ForOfStmt") {
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
          catchOrFinally.kind === "CatchClause" && catchOrFinally.variableDecl
            ? `$.${catchOrFinally.variableDecl.name}`
            : catchOrFinally.kind === "BlockStmt" &&
              catchOrFinally.isFinallyBlock() &&
              canThrow(catchOrFinally.parent.catchClause) &&
              // we only store the error thrown from the catchClause if the finallyBlock is not terminal
              // by terminal, we mean that every branch returns a value - meaning that the re-throw
              // behavior of a finally will never be triggered - the return within the finally intercepts it
              !catchOrFinally.isTerminal()
            ? `$.${this.getDeterministicGeneratedName(catchOrFinally)}`
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
    expr.expr.kind === "PropAccessExpr" &&
    (expr.expr.name === "map" || expr.expr.name === "forEach")
  );
}

function isSlice(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "slice";
  };
} {
  return expr.expr.kind === "PropAccessExpr" && expr.expr.name === "slice";
}

function isFilter(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "filter";
  };
} {
  return expr.expr.kind === "PropAccessExpr" && expr.expr.name === "filter";
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
      (node.kind === "CallExpr" &&
        (findIntegration(node) !== undefined || isMapOrForEach(node))) ||
        node.kind === "ForInStmt" ||
        node.kind === "ForOfStmt"
        ? { hasTask: true }
        : node.kind === "ThrowStmt"
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
      node.kind === "ForInStmt" ||
      node.kind === "ForOfStmt" ||
      node.kind === "WhileStmt" ||
      node.kind === "DoStmt"
    ) {
      return false;
    } else if (node.kind === "BreakStmt") {
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
        return constant.constant.stateMachineArn;
      } else if (isTable(constant.constant)) {
        return constant.constant.resource.tableName;
      }
      return constant.constant;
    } else if (expr.kind === "Argument") {
      return toJson(expr.expr);
    } else if (expr.kind === "BinaryExpr") {
    } else if (expr.kind === "CallExpr") {
      if (isSlice(expr)) {
        return sliceToJsonPath(expr);
      } else if (isFilter(expr)) {
        return filterToJsonPath(expr);
      }
    } else if (expr.kind === "Identifier") {
      return toJsonPath(expr);
    } else if (expr.kind === "PropAccessExpr") {
      return `${toJson(expr.expr)}.${expr.name}`;
    } else if (expr.kind === "ElementAccessExpr") {
      return toJsonPath(expr);
    } else if (expr.kind === "ArrayLiteralExpr") {
      if (expr.items.find(isVariableReference) !== undefined) {
        return `States.Array(${expr.items
          .map((item) => toJsonPath(item))
          .join(", ")})`;
      }
      return expr.items.map((item) => toJson(item));
    } else if (expr.kind === "ObjectLiteralExpr") {
      const payload: any = {};
      for (const prop of expr.properties) {
        if (prop.kind !== "PropAssignExpr") {
          throw new Error(
            `${prop.kind} is not supported in Amazon States Language`
          );
        }
        if (
          (prop.name.kind === "ComputedPropertyNameExpr" &&
            prop.name.expr.kind === "StringLiteralExpr") ||
          prop.name.kind === "Identifier" ||
          prop.name.kind === "StringLiteralExpr"
        ) {
          payload[
            `${
              prop.name.kind === "Identifier"
                ? prop.name.name
                : prop.name.kind === "StringLiteralExpr"
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
    } else if (expr.kind === "TemplateExpr") {
      return `States.Format('${expr.exprs
        .map((e) => (isLiteralExpr(e) ? toJson(e) : "{}"))
        .join("")}',${expr.exprs
        .filter((e) => !isLiteralExpr(e))
        .map((e) => toJsonPath(e))})`;
    }
    debugger;
    throw new Error(`cannot evaluate ${expr.kind} to JSON`);
  }

  export function toJsonPath(expr: Expr): string {
    if (expr.kind === "ArrayLiteralExpr") {
      return aws_stepfunctions.JsonPath.array(
        ...expr.items.map((item) => toJsonPath(item))
      );
    } else if (expr.kind === "CallExpr") {
      if (isSlice(expr)) {
        return sliceToJsonPath(expr);
      } else if (isFilter(expr)) {
        return filterToJsonPath(expr);
      }
    } else if (expr.kind === "Identifier") {
      const ref = expr.lookup();
      // If the identifier references a parameter expression and that parameter expression
      // is in a FunctionDecl and that Function is at the top (no parent).
      // This logic needs to be updated to support destructured inputs: https://github.com/functionless/functionless/issues/68
      if (ref && isParameterDecl(ref) && isFunctionDecl(ref.parent)) {
        return "$";
      }
      return `$.${expr.name}`;
    } else if (expr.kind === "PropAccessExpr") {
      return `${toJsonPath(expr.expr)}.${expr.name}`;
    } else if (expr.kind === "ElementAccessExpr") {
      return elementAccessExprToJsonPath(expr);
    }

    debugger;
    throw new Error(
      `expression kind '${expr.kind}' cannot be evaluated to a JSON Path expression.`
    );
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
    if (predicate?.kind !== "FunctionExpr") {
      throw new Error(
        "the 'predicate' argument of slice must be a FunctionExpr"
      );
    }

    const stmt = predicate.body.statements[0];
    if (
      stmt === undefined ||
      stmt.kind !== "ReturnStmt" ||
      predicate.body.statements.length !== 1
    ) {
      throw new Error(
        'a JSONPath filter expression only supports a single, in-line statement, e.g. .filter(a => a == "hello" || a === "world")'
      );
    }

    return `${toJsonPath(expr.expr.expr)}[?(${toFilterCondition(stmt.expr)})]`;

    function toFilterCondition(expr: Expr): string {
      if (expr.kind === "BinaryExpr") {
        return `${toFilterCondition(expr.left)}${expr.op}${toFilterCondition(
          expr.right
        )}`;
      } else if (expr.kind === "UnaryExpr") {
        return `${expr.op}${toFilterCondition(expr.expr)}`;
      } else if (expr.kind === "Identifier") {
        const ref = expr.lookup();
        if (ref === undefined) {
          throw new Error(`unresolved identifier: ${expr.name}`);
        } else if (ref.kind === "ParameterDecl") {
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
        } else if (ref.kind === "VariableStmt") {
          throw new Error(
            "cannot reference a VariableStmt within a JSONPath .filter expression"
          );
        }
      } else if (expr.kind === "StringLiteralExpr") {
        return `'${expr.value.replace(/'/g, "\\'")}'`;
      } else if (
        expr.kind === "BooleanLiteralExpr" ||
        expr.kind === "NumberLiteralExpr" ||
        expr.kind === "NullLiteralExpr"
      ) {
        return `${expr.value}`;
      } else if (expr.kind === "PropAccessExpr") {
        return `${toFilterCondition(expr.expr)}.${expr.name}`;
      } else if (expr.kind === "ElementAccessExpr") {
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
    if (expr.element.kind === "Identifier" && expr.expr.kind === "Identifier") {
      const element = expr.element.lookup();
      if (
        element?.kind === "VariableStmt" &&
        element?.parent?.kind === "ForInStmt" &&
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
        and(isBoolean(v), ref(v))
      )
    );

  export const ref = (Variable: string): Condition => ({ Variable });

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
      },
    ],
  });

  export function toCondition(expr: Expr): Condition {
    if (expr.kind === "BooleanLiteralExpr") {
      return {
        IsPresent: !expr.value,
        Variable: `$.0_${expr.value}`,
      };
    } else if (expr.kind === "UnaryExpr") {
      return {
        Not: toCondition(expr.expr),
      };
    } else if (expr.kind === "BinaryExpr") {
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

          if (val.kind === "TypeOfExpr") {
            const supportedTypeNames = [
              "undefined",
              "boolean",
              "number",
              "string",
              "bigint",
            ] as const;

            if (literalExpr.kind !== "StringLiteralExpr") {
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
            literalExpr.kind === "NullLiteralExpr" ||
            literalExpr.kind === "UndefinedLiteralExpr"
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
          } else if (literalExpr.kind === "StringLiteralExpr") {
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
          } else if (literalExpr.kind === "NumberLiteralExpr") {
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
        if (
          expr.left.kind === "StringLiteralExpr" ||
          expr.right.kind === "StringLiteralExpr"
        ) {
        }
        // need typing information
        // return aws_stepfunctions.Condition.str
      }
    }
    debugger;

    throw new Error(`cannot evaluate expression: '${expr.kind}`);
  }
}

function toStateName(stmt: Stmt): string | undefined {
  if (stmt.kind === "IfStmt") {
    return `if(${exprToString(stmt.when)})`;
  } else if (stmt.kind === "ExprStmt") {
    return exprToString(stmt.expr);
  } else if (stmt.kind === "BlockStmt") {
    if (stmt.isFinallyBlock()) {
      return "finally";
    } else {
      return undefined;
    }
  } else if (stmt.kind === "BreakStmt") {
    return "break";
  } else if (stmt.kind === "ContinueStmt") {
    return "continue";
  } else if (stmt.kind === "CatchClause") {
    return `catch${
      stmt.variableDecl?.name ? `(${stmt.variableDecl?.name})` : ""
    }`;
  } else if (stmt.kind === "DoStmt") {
    return `while (${exprToString(stmt.condition)})`;
  } else if (stmt.kind === "ForInStmt") {
    return `for(${stmt.variableDecl.name} in ${exprToString(stmt.expr)})`;
  } else if (stmt.kind === "ForOfStmt") {
    return `for(${stmt.variableDecl.name} of ${exprToString(stmt.expr)})`;
  } else if (stmt.kind === "ReturnStmt") {
    if (stmt.expr) {
      return `return ${exprToString(stmt.expr)}`;
    } else {
      return "return";
    }
  } else if (stmt.kind === "ThrowStmt") {
    return `throw ${exprToString(stmt.expr)}`;
  } else if (stmt.kind === "TryStmt") {
    return "try";
  } else if (stmt.kind === "VariableStmt") {
    if (stmt.parent?.kind === "CatchClause") {
      return `catch(${stmt.name})`;
    } else {
      return `${stmt.name} = ${
        stmt.expr ? exprToString(stmt.expr) : "undefined"
      }`;
    }
  } else if (stmt.kind === "WhileStmt") {
    return `while (${exprToString(stmt.condition)})`;
  } else {
    return assertNever(stmt);
  }
}

function exprToString(expr?: Expr): string {
  if (!expr) {
    return "";
  } else if (expr.kind === "Argument") {
    return exprToString(expr.expr);
  } else if (expr.kind === "ArrayLiteralExpr") {
    return `[${expr.items.map(exprToString).join(", ")}]`;
  } else if (expr.kind === "BinaryExpr") {
    return `${exprToString(expr.left)} ${expr.op} ${exprToString(expr.right)}`;
  } else if (expr.kind === "BooleanLiteralExpr") {
    return `${expr.value}`;
  } else if (expr.kind === "CallExpr" || expr.kind === "NewExpr") {
    return `${expr.kind === "NewExpr" ? "new " : ""}${exprToString(
      expr.expr
    )}(${expr.args
      // Assume that undefined args are in order.
      .filter(
        (arg) =>
          arg.expr &&
          !(arg.name === "thisArg" && arg.expr.kind === "UndefinedLiteralExpr")
      )
      .map((arg) => exprToString(arg.expr))
      .join(", ")})`;
  } else if (expr.kind === "ConditionExpr") {
    return `if(${exprToString(expr.when)})`;
  } else if (expr.kind === "ComputedPropertyNameExpr") {
    return `[${exprToString(expr.expr)}]`;
  } else if (expr.kind === "ElementAccessExpr") {
    return `${exprToString(expr.expr)}[${exprToString(expr.element)}]`;
  } else if (expr.kind === "FunctionExpr") {
    return `function(${expr.parameters.map((param) => param.name).join(", ")})`;
  } else if (expr.kind === "Identifier") {
    return expr.name;
  } else if (expr.kind === "NullLiteralExpr") {
    return "null";
  } else if (expr.kind === "NumberLiteralExpr") {
    return `${expr.value}`;
  } else if (expr.kind === "ObjectLiteralExpr") {
    return `{${expr.properties.map(exprToString).join(", ")}}`;
  } else if (expr.kind === "PropAccessExpr") {
    return `${exprToString(expr.expr)}.${expr.name}`;
  } else if (expr.kind === "PropAssignExpr") {
    return `${
      expr.name.kind === "Identifier"
        ? expr.name.name
        : expr.name.kind === "StringLiteralExpr"
        ? expr.name.value
        : expr.name.kind === "ComputedPropertyNameExpr"
        ? expr.name.expr.kind === "StringLiteralExpr"
          ? expr.name.expr.value
          : exprToString(expr.name.expr)
        : assertNever(expr.name)
    }: ${exprToString(expr.expr)}`;
  } else if (expr.kind === "ReferenceExpr") {
    return expr.name;
  } else if (expr.kind === "SpreadAssignExpr") {
    return `...${exprToString(expr.expr)}`;
  } else if (expr.kind === "SpreadElementExpr") {
    return `...${exprToString(expr.expr)}`;
  } else if (expr.kind === "StringLiteralExpr") {
    return `"${expr.value}"`;
  } else if (expr.kind === "TemplateExpr") {
    return `\`${expr.exprs
      .map((e) => (e.kind === "StringLiteralExpr" ? e.value : exprToString(e)))
      .join("")}\``;
  } else if (expr.kind === "TypeOfExpr") {
    return `typeof ${exprToString(expr.expr)}`;
  } else if (expr.kind === "UnaryExpr") {
    return `${expr.op}${exprToString(expr.expr)}`;
  } else if (expr.kind === "UndefinedLiteralExpr") {
    return "undefined";
  } else {
    return assertNever(expr);
  }
}
