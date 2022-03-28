import { Construct } from "constructs";
import { aws_iam, aws_stepfunctions } from "aws-cdk-lib";

import { assertNever } from "./assert";
import {
  CallExpr,
  ElementAccessExpr,
  Expr,
  isFunctionExpr,
  isLiteralExpr,
  isReferenceExpr,
  isVariableReference,
  NewExpr,
  NullLiteralExpr,
  PropAccessExpr,
} from "./expression";
import {
  BlockStmt,
  IfStmt,
  isForInStmt,
  isForOfStmt,
  ReturnStmt,
  Stmt,
} from "./statement";
import { anyOf, findFunction } from "./util";
import { FunctionDecl } from "./declaration";
import { FunctionlessNode } from "./node";
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
  BooleanEquals?: string;
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
    this.decl = visitEachChild(decl, function visit(node): FunctionlessNode {
      // re-write the AST to include explicit `ReturnStmt(NullLiteral())` statements
      // this simplifies the interpreter code by always having a node to chain onto, even when
      // the AST has no final `ReturnStmt` (i.e. when the function is a void function)
      // without this, chains that should return null will actually include the entire state as their output
      if (
        node.kind === "BlockStmt" &&
        (node.parent?.kind === "FunctionExpr" ||
          node.parent?.kind === "FunctionDecl")
      ) {
        if (node.lastStmt === undefined) {
          return new BlockStmt([new ReturnStmt(new NullLiteralExpr())]);
        } else if (!node.lastStmt.isTerminal()) {
          return new BlockStmt([
            ...node.statements.map((stmt) => visitEachChild(stmt, visit)),
            new ReturnStmt(new NullLiteralExpr()),
          ]);
        }
      }
      return visitEachChild(node, visit);
    });

    const states = this.execute(this.decl.body);

    const start = this.transition(this.decl.body);
    if (start === undefined) {
      throw new Error(`State Machine has no States`);
    }

    this.definition = {
      StartAt: start,
      States: states,
    };
  }

  private getDeterministicGeneratedName(node: FunctionlessNode): string {
    if (!this.generatedNames.has(node)) {
      this.generatedNames.set(node, `${this.generatedNames.size}_tmp`);
    }
    return this.generatedNames.get(node)!;
  }

  public getStateName(stmt: Stmt): string {
    if (!this.stateNames.has(stmt)) {
      let stateName = toStateName(stmt);
      if (stateName === undefined) {
        throw new Error(`cannot transition to ${stmt.kind}`);
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
      return stmt.statements.reduce((states: States, s, i) => {
        if (i < stmt.statements.length - 1) {
          return {
            ...states,
            ...this.execute(s),
          };
        } else {
          return {
            ...states,
            ...this.execute(s),
          };
        }
      }, {});
    } else if (stmt.kind === "BreakStmt") {
      const loop = stmt.findParent(anyOf(isForOfStmt, isForInStmt));
      if (loop === undefined) {
        throw new Error(`Stack Underflow`);
      }
      return {
        [this.getStateName(stmt)]: {
          Type: "Pass",
          Next: this.next(loop),
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

      return {
        [this.getStateName(stmt)]: {
          Type: "Map",
          Catch: throwTransition
            ? [
                {
                  ErrorEquals: ["States.ALL"],
                  Next: throwTransition.Next!,
                  ResultPath: throwTransition.ResultPath,
                },
              ]
            : undefined,
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
      return {
        [this.getStateName(stmt)]: {
          Type: "Choice",
          Choices: choices,
          Default:
            curr === undefined
              ? this.next(stmt)
              : // there was an else
                this.getStateName(curr.statements[0]),
        },
        ...states,
      };
    } else if (stmt.kind === "ReturnStmt") {
      if (stmt.expr.kind === "NullLiteralExpr") {
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
      if (stmt.expr.kind !== "NewExpr") {
        throw new Error(`the expr of a ThrowStmt must be a NewExpr`);
      }

      const throwTransition = this.throw(stmt);
      if (throwTransition === undefined) {
        return {
          [this.getStateName(stmt)]: {
            Type: "Fail",
            Error: exprToString((stmt.expr as NewExpr).expr),
            Cause: JSON.stringify(
              Object.entries((stmt.expr as NewExpr).args).reduce(
                (args: any, [argName, argVal]) => ({
                  ...args,
                  [argName]: ASL.toJson(argVal),
                }),
                {}
              )
            ),
          } as const,
        };
      } else {
        return {
          [this.getStateName(stmt)]: {
            Type: "Pass",
            Result: Object.entries((stmt.expr as NewExpr).args).reduce(
              (args: any, [argName, argVal]) => ({
                ...args,
                [argName]: ASL.toJson(argVal),
              }),
              {}
            ),
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
      const serviceCall = findFunction(expr);
      if (serviceCall) {
        if (
          expr.expr.kind === "PropAccessExpr" &&
          (expr.expr.name === "waitFor" || expr.expr.name === "waitUntil")
        ) {
          delete (props as any).ResultPath;
          return {
            ...(serviceCall as any)(expr, this),
            ...props,
          };
        }

        const taskState = {
          ...serviceCall(expr, this),
          ...props,
        };

        const throwOrPass = this.throw(expr);
        if (throwOrPass?.Next) {
          return {
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

        const callbackfn = expr.args.callbackfn;
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
                param.name,
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
      if (expr.right.kind === "NullLiteralExpr") {
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
      } else if (isLiteralExpr(expr.right)) {
        return {
          Type: "Pass",
          ...props,
          Parameters: ASL.toJson(expr.right),
          ResultPath: ASL.toJsonPath(expr.left),
        };
      } else if (expr.right.kind === "CallExpr") {
        return this.eval(expr.right, {
          ...props,
          ResultPath: ASL.toJsonPath(expr.left),
        });
      }
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
    } else if (node.kind === "TryStmt" && node.isTerminal()) {
      return undefined;
    } else if (node.parent?.kind === "BlockStmt") {
      const block = node.parent;
      const scope = node.parent.parent;
      if (scope === undefined) {
        throw new Error(`broken AST - BlockStmt without a parent node`);
      } else if (scope.kind === "FunctionDecl") {
      } else if (scope.kind === "FunctionExpr") {
      } else if (scope.kind === "ForInStmt" || scope.kind === "ForOfStmt") {
        return undefined;
      } else if (scope.kind === "WhileStmt" || scope.kind === "DoStmt") {
        return this.getStateName(scope);
      } else if (scope.kind === "IfStmt") {
        return this.next(scope);
      } else if (scope.kind === "TryStmt") {
        if (block === scope.tryBlock) {
          // need to move to the finally block
          if (scope.finallyBlock?.isNotEmpty()) {
            return this.transition(scope.finallyBlock);
          }
          return this.next(scope);
        } else if (block === scope.finallyBlock) {
          // we're exiting the finallyBlock, so let's progress past it
          if (canThrow(scope.catchClause)) {
            // if the catchClause can throw, then we need to transition through the `exit finally` state first
            return `exit ${this.getStateName(scope.finallyBlock)}`;
          }
          return this.next(scope);
        } else {
          throw new Error(`impossible`);
        }
      } else if (scope.kind === "CatchClause") {
        const tryStmt = scope.parent;
        if (tryStmt.finallyBlock?.isNotEmpty()) {
          return this.transition(tryStmt.finallyBlock);
        }
        return this.next(scope);
      } else {
        return assertNever(scope);
      }
    }

    return this.return(node);
  }

  /**
   * Find the nearest state on the call stack to return the value to.
   */
  private return(node: FunctionlessNode | undefined): string {
    if (node === undefined) {
      throw new Error(`Stack Underflow`);
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
    const catchOrFinally = node.error();
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
        (findFunction(node) !== undefined || isMapOrForEach(node))) ||
        node.kind === "ForInStmt" ||
        node.kind === "ForOfStmt"
        ? { hasTask: true }
        : node.kind === "ThrowStmt"
        ? { hasThrow: true }
        : {}
    );
}

export namespace ASL {
  export function toJson(expr: Expr): any {
    if (expr.kind === "CallExpr" && isSlice(expr)) {
      return sliceToJsonPath(expr);
    } else if (expr.kind === "Identifier") {
      return toJsonPath(expr);
    } else if (expr.kind === "PropAccessExpr") {
      return `${toJson(expr.expr)}.${expr.name}`;
    } else if (
      expr.kind === "ElementAccessExpr" &&
      expr.element.kind === "NumberLiteralExpr"
    ) {
      return `${toJson(expr.expr)}[${expr.element.value}]`;
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
          prop.name.kind !== "StringLiteralExpr" &&
          prop.name.kind !== "Identifier"
        ) {
          throw new Error(
            `computed name of PropAssignExpr is not supported in Amazon States Language`
          );
        }

        payload[
          `${
            prop.name.kind === "StringLiteralExpr"
              ? prop.name.value
              : prop.name.name
          }${
            isLiteralExpr(prop.expr) || isReferenceExpr(prop.expr) ? "" : ".$"
          }`
        ] = toJson(prop.expr);
      }
      return payload;
    } else if (isLiteralExpr(expr)) {
      return expr.value;
    } else if (expr.kind === "ReferenceExpr") {
      const ref = expr.ref();
      if (ref.kind === "Function") {
        return ref.resource.functionArn;
      } else if (ref.kind === "StepFunction") {
        return ref.stateMachineArn;
      } else if (ref.kind === "Table") {
        return ref.resource.tableName;
      }
    } else if (expr.kind === "ElementAccessExpr") {
      return toJsonPath(expr);
    }
    throw new Error(`cannot evaluate ${expr.kind} to JSON`);
  }

  export function toJsonPath(expr: Expr): string {
    if (expr.kind === "ArrayLiteralExpr") {
      return aws_stepfunctions.JsonPath.array(
        ...expr.items.map((item) => toJsonPath(item))
      );
    } else if (expr.kind === "CallExpr" && isSlice(expr)) {
      return sliceToJsonPath(expr);
    } else if (expr.kind === "Identifier") {
      return `$.${expr.name}`;
    } else if (expr.kind === "PropAccessExpr") {
      return `${toJsonPath(expr.expr)}.${expr.name}`;
    } else if (expr.kind === "ElementAccessExpr") {
      return elementAccessExprToJsonPath(expr);
    }

    throw new Error(
      `expression kind '${expr.kind}' cannot be evaluated to a JSON Path expression.`
    );
  }

  function sliceToJsonPath(expr: CallExpr & { expr: PropAccessExpr }) {
    const start = expr.args.start;
    if (start.kind !== "NumberLiteralExpr") {
      throw new Error(
        `the 'start' argument of slice must be a NumberLiteralExpr`
      );
    }

    const end = expr.args.end;
    if (end.kind !== "NullLiteralExpr") {
      if (end.kind !== "NumberLiteralExpr") {
        throw new Error(
          `the 'end' argument of slice must be a NumberLiteralExpr`
        );
      }
      return `${toJsonPath(expr.expr.expr)}[${start.value}:${end.value}]`;
    } else {
      return `${toJsonPath(expr.expr.expr)}[${start.value}:]`;
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
   * ```
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
          `cannot use an Identifier to index an Array or Object except for an array in a for-in statement`
        );
      }
    }
    return `${toJsonPath(expr.expr)}[${elementToJsonPath(expr.element)}]`;
  }

  function elementToJsonPath(expr: Expr): string {
    if (expr.kind === "StringLiteralExpr") {
      return `'${expr.value}'`;
    } else if (expr.kind === "NumberLiteralExpr") {
      return expr.value.toString(10);
    }

    throw new Error(
      `Expression kind '${expr.kind}' is not allowed as an element in a Step Function`
    );
  }

  export function toCondition(expr: Expr): Condition {
    if (expr.kind === "UnaryExpr") {
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
      } else {
        if (isLiteralExpr(expr.left) && isLiteralExpr(expr.right)) {
        } else if (isLiteralExpr(expr.left) || isLiteralExpr(expr.right)) {
          const [lit, val] = isLiteralExpr(expr.left)
            ? [expr.left, expr.right]
            : [expr.right, expr.left];

          if (lit.kind === "NullLiteralExpr") {
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
          } else if (lit.kind === "StringLiteralExpr") {
            const [variable, value] = [toJsonPath(val), lit.value] as const;
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
          } else if (lit.kind === "NumberLiteralExpr") {
            const [variable, value] = [toJsonPath(val), lit.value] as const;
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
  } else if (stmt.kind === "CatchClause") {
    return `catch${
      stmt.variableDecl?.name ? `(${stmt.variableDecl?.name})` : ""
    }`;
  } else if (stmt.kind === "DoStmt") {
    return `do...while (${exprToString(stmt.condition)})`;
  } else if (stmt.kind === "ForInStmt") {
    return `for(${stmt.variableDecl.name} in ${exprToString(stmt.expr)})`;
  } else if (stmt.kind === "ForOfStmt") {
    return `for(${stmt.variableDecl.name} of ${exprToString(stmt.expr)})`;
  } else if (stmt.kind === "ReturnStmt") {
    if (stmt.expr) {
      return `return ${exprToString(stmt.expr)}`;
    } else {
      return `return`;
    }
  } else if (stmt.kind === "ThrowStmt") {
    return `throw ${exprToString(stmt.expr)}`;
  } else if (stmt.kind === "TryStmt") {
    return `try`;
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

function exprToString(expr: Expr): string {
  if (expr.kind === "ArrayLiteralExpr") {
    return `[${expr.items.map(exprToString).join(", ")}]`;
  } else if (expr.kind === "BinaryExpr") {
    return `${exprToString(expr.left)} ${expr.op} ${exprToString(expr.right)}`;
  } else if (expr.kind === "BooleanLiteralExpr") {
    return `${expr.value}`;
  } else if (expr.kind === "CallExpr" || expr.kind === "NewExpr") {
    return `${expr.kind === "NewExpr" ? "new " : ""}${exprToString(
      expr.expr
    )}(${Object.entries(expr.args)
      .filter(
        ([name, val]) => !(name === "thisArg" && val.kind === "NullLiteralExpr")
      )
      .map(([_, val]) => exprToString(val))
      .join(", ")})`;
  } else if (expr.kind === "ConditionExpr") {
    return `if(${exprToString(expr.when)})`;
  } else if (expr.kind === "ElementAccessExpr") {
    return `${exprToString(expr.expr)}[${exprToString(expr.element)}]`;
  } else if (expr.kind === "FunctionExpr") {
    return `function(${expr.parameters.map((param) => param.name).join(", ")})`;
  } else if (expr.kind === "Identifier") {
    return expr.name;
  } else if (expr.kind === "NullLiteralExpr") {
    return `null`;
  } else if (expr.kind === "NumberLiteralExpr") {
    return `${expr.value}`;
  } else if (expr.kind === "ObjectLiteralExpr") {
    return `{${expr.properties.map(exprToString).join(", ")}}`;
  } else if (expr.kind === "PropAccessExpr") {
    return `${exprToString(expr.expr)}.${expr.name}`;
  } else if (expr.kind === "PropAssignExpr") {
    return `${
      expr.name.kind === "StringLiteralExpr"
        ? expr.name.value
        : exprToString(expr.name)
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
    return `\`${expr.exprs.map(exprToString).join("")}\``;
  } else if (expr.kind === "UnaryExpr") {
    return `${expr.op}${exprToString(expr.expr)}`;
  } else {
    return assertNever(expr);
  }
}
