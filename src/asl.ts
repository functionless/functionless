import { Construct } from "constructs";
import { aws_iam, aws_stepfunctions } from "aws-cdk-lib";

import { assertNever } from "./assert";
import {
  Expr,
  FunctionExpr,
  isLiteralExpr,
  isReferenceExpr,
  isExpr,
} from "./expression";
import {
  BlockStmt,
  ForInStmt,
  ForOfStmt,
  IfStmt,
  isStmt,
  Stmt,
} from "./statement";
import { findFunction } from "./util";
import { FunctionDecl } from "./declaration";
import { FunctionlessNode } from "./node";

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
  | Succeed
  | Fail
  | Choice
  | Task
  | Pass
  | MapTask
  | ParallelTask;
export type TerminalState = Succeed | Fail | Extract<State, { End: true }>;

export interface Succeed {
  Type: "Succeed";
  Comment?: string;
  InputPath?: string;
  OutputPath?: string;
}

export interface Fail {
  Type: "Fail";
  Comment?: string;
  Error?: string;
  Cause?: string;
}

export interface TaskParameters {
  [key: string]: any;
}

export interface Nextable {
  End?: true;
  Next?: string;
}

export interface Pass {
  Comment?: string;
  Type: "Pass";
  Result?: any;
  InputPath?: string;
  OutputPath?: string;
  ResultPath?: string | null;
  Parameters?: TaskParameters;
  Next?: string;
  End?: boolean;
}

export interface Choice {
  Type: "Choice";
  Comment?: string;
  InputPath?: string;
  OutputPath?: string;
  Choices: Branch[];
  Default?: string;
}

export interface Branch extends Condition {
  Next: string;
}

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

export interface Retry {
  ErrorEquals: string[];
  IntervalSeconds?: number;
  MaxAttempts?: number;
  BackoffRate?: number;
}

export interface Catch {
  ErrorEquals: string[];
  ResultPath?: string | null;
  Next: string;
}

export interface BaseTask extends Nextable {
  Comment?: string;
  InputPath?: string;
  OutputPath?: string;
  Parameters?: TaskParameters;
  /**
   * Pass a collection of key value pairs, where the values are static or selected from the result. For more information, see ResultSelector.
   */
  ResultSelector?: string;
  ResultPath?: string | null;
  Retry?: Retry[];
  Catch?: Catch[];
}

export interface Task extends BaseTask {
  Type: "Task";
  Resource: string;
}

/**
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-map-state.html
 */
export interface MapTask extends BaseTask {
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

export interface ParallelTask extends BaseTask {
  Type: "Parallel";
  Iterator: States;
}

/**
 * Amazon States Language (ASL) Generator.
 */
export class ASL {
  static readonly ContextName = "Amazon States Language";

  readonly kind = ASL.ContextName;

  /**
   * Maps a {@link Stmt} to a unique State name. This is generated by passing over
   * the AST and assigning each state a unique name. These names are then used to
   * resolve state transitions.
   */
  readonly stateNames: Map<Stmt, string>;
  readonly returnTransitions: Map<
    FunctionDecl | FunctionExpr | ForInStmt | ForOfStmt,
    string
  >;
  readonly throwTransitions: Map<
    FunctionDecl | FunctionExpr | ForInStmt | ForOfStmt,
    string
  >;

  readonly definition: StateMachine<States>;

  constructor(
    readonly scope: Construct,
    readonly role: aws_iam.IRole,
    readonly decl: FunctionDecl
  ) {
    this.stateNames = new Map();
    this.returnTransitions = new Map();
    this.throwTransitions = new Map();

    const terminalStates = {
      [this.getReturnStateName(this.decl)]: {
        Type: "Succeed",
      },
      [this.getThrowStateName(this.decl)]: {
        Type: "Fail",
      },
    } as const;

    const states = this.execute(this.decl.body);

    const start = this.getStateName(this.decl.body.statements[0]);

    this.definition = {
      StartAt: start,
      States: {
        ...states,
        ...terminalStates,
      },
    };
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
      return {
        [this.getStateName(stmt)]: {
          Type: "Pass",
          Next: this.next(findLoop(stmt)),
        },
      };
      function findLoop(
        node: FunctionlessNode | undefined
      ): ForOfStmt | ForInStmt {
        if (node === undefined) {
          throw new Error(`Stack Underflow`);
        }
        if (node.kind === "ForOfStmt" || node.kind === "ForInStmt") {
          return node;
        } else {
          return findLoop(node.parent);
        }
      }
    } else if (stmt.kind === "ExprStmt") {
      return {
        [this.getStateName(stmt)]: this.eval(stmt.expr),
      };
    } else if (stmt.kind === "ForInStmt") {
      throw new Error(`for-in is no supported in Amazon States Language`);
    } else if (stmt.kind === "ForOfStmt") {
      return {
        [this.getStateName(stmt)]: {
          Type: "Map",
          ResultPath: null,
          ItemsPath: this.evalJsonPath(stmt.expr),
          Next: this.next(stmt),
          MaxConcurrency: 1,
          Catch: [
            {
              ErrorEquals: ["States.All"],
              Next: this.throw(stmt.parent),
            },
          ],
          Parameters: {
            [`${stmt.i.name}.$`]: "$$.Map.Item.Value",
          },
          Iterator: {
            StartAt: this.getStateName(stmt.body.statements[0]),
            States: {
              ...this.execute(stmt.body),
              [this.getReturnStateName(stmt)]: {
                Type: "Succeed",
              },
              [this.getThrowStateName(stmt)]: {
                Type: "Fail",
              },
            },
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
          ...this.condition(curr.when),
        });
        curr = curr._else;
      }
      return {
        ...states,
        [this.getStateName(stmt)]: {
          Type: "Choice",
          Choices: choices,
          Default:
            curr === undefined
              ? this.next(stmt)
              : // there was an else
                this.getStateName(curr.statements[0]),
        },
      };
    } else if (stmt.kind === "ReturnStmt") {
      return {
        [this.getStateName(stmt)]: this.eval(stmt.expr),
      };
    } else if (stmt.kind === "ThrowStmt") {
      return {
        [this.getStateName(stmt)]: {
          Type: "Pass",
          Next: this.throw(stmt),
        },
      };
    } else if (stmt.kind === "VariableStmt") {
      if (stmt.expr === undefined) {
        return {};
      }
      return {
        [this.getStateName(stmt)]: this.eval(stmt.expr),
      };
    } else if (stmt.kind === "TryStmt") {
      return {
        ...this.execute(stmt.tryBlock),
        ...(stmt.catchClause ? this.execute(stmt.catchClause) : {}),
        ...(stmt.finallyBlock ? this.execute(stmt.finallyBlock) : {}),
      };
    } else if (stmt.kind === "CatchClause") {
      return this.execute(stmt.block);
    }
    return assertNever(stmt);
  }

  /**
   * Find the next state that the {@link node} should transition to.
   */
  private next(node: FunctionlessNode | undefined): string {
    if (node === undefined) {
      throw new Error(`Stack Underflow`);
    } else if (node.kind === "FunctionDecl") {
      return this.getReturnStateName(node);
    } else if (node.kind === "FunctionExpr") {
      return this.getReturnStateName(node);
    } else if (isExpr(node)) {
      return this.next(node.parent);
    } else if (isStmt(node)) {
      if (node.kind === "TryStmt" && node.finallyBlock) {
        return this.getStateName(node.finallyBlock.statements[0]);
      } else if (node.kind === "ReturnStmt") {
        return this.return(node);
      } else if (node.next) {
        return this.getStateName(node.next);
      }
    }
    return this.return(node.parent);
  }

  /**
   * Find the nearest state on the call stack to return the value to.
   */
  private return(node: FunctionlessNode | undefined): string {
    if (node === undefined) {
      throw new Error(`Stack Underflow`);
    } else if (
      node.kind === "FunctionDecl" ||
      node.kind === "FunctionExpr" ||
      node.kind === "ForInStmt" ||
      node.kind === "ForOfStmt"
    ) {
      return this.getReturnStateName(node);
    } else {
      return this.return(node.parent);
    }
  }

  /**
   * Find the nearest state on the call stack to throw an error to.
   */
  private throw(node: FunctionlessNode | undefined): string {
    if (node === undefined) {
      throw new Error(`Stack Underflow`);
    } else if (
      node.kind === "FunctionDecl" ||
      node.kind === "FunctionExpr" ||
      node.kind === "ForInStmt" ||
      node.kind === "ForOfStmt"
    ) {
      return this.getThrowStateName(node);
    } else if (node.kind === "TryStmt") {
      if (node.catchClause) {
        return this.next(node.catchClause);
      } else if (node.finallyBlock) {
        return this.next(node.finallyBlock);
      } else {
        return this.throw(node.parent);
      }
    } else {
      return this.throw(node.parent);
    }
  }

  public eval(expr: Expr): State {
    const ResultPath =
      expr.parent?.kind === "VariableStmt"
        ? `$.${expr.parent.name}`
        : expr.parent?.kind === "ReturnStmt"
        ? "$"
        : null;
    if (expr.kind === "CallExpr") {
      const serviceCall = findFunction(expr);
      if (serviceCall) {
        const task: Task = serviceCall(expr, this);

        return {
          ...task,
          ResultPath,
          Catch: [
            {
              // https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
              ErrorEquals: ["States.All"],
              Next: this.throw(expr),
            },
          ],
          Next: this.next(expr),
        };
      }
      throw new Error(`call must be a service call, ${expr}`);
    } else if (
      expr.kind === "Identifier" ||
      expr.kind === "PropAccessExpr" ||
      expr.kind === "ElementAccessExpr"
    ) {
      return {
        Type: "Pass",
        Next: this.next(expr),
        Parameters: {
          [`result${isLiteralExpr(expr) ? "" : ".$"}`]: this.evalJson(expr),
        },
        OutputPath: "$.result",
        ResultPath,
      };
    } else if (isLiteralExpr(expr)) {
      return {
        Type: "Pass",
        Next: this.next(expr),
        Result: this.evalJson(expr),
        ResultPath,
      };
    } else {
      throw new Error(`cannot eval expression kind '${expr.kind}'`);
    }
  }

  public evalJson(expr: Expr): any {
    if (expr.kind === "Identifier") {
      return this.evalJsonPath(expr);
    } else if (expr.kind === "PropAccessExpr") {
      return `${this.evalJson(expr.expr)}.${expr.name}`;
    } else if (
      expr.kind === "ElementAccessExpr" &&
      expr.element.kind === "NumberLiteralExpr"
    ) {
      return `${this.evalJson(expr.expr)}[${expr.element.value}]`;
    } else if (expr.kind === "ArrayLiteralExpr") {
      return expr.items.map(this.evalJson);
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
        ] = this.evalJson(prop.expr);
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
    }
    throw new Error(`cannot evaluate ${expr.kind} to JSON`);
  }

  public condition(expr: Expr): Condition {
    if (expr.kind === "UnaryExpr") {
      return {
        Not: this.condition(expr.expr),
      };
    } else if (expr.kind === "BinaryExpr") {
      if (expr.op === "&&") {
        return {
          And: [this.condition(expr.left), this.condition(expr.right)],
        };
      } else if (expr.op === "||") {
        return {
          Or: [this.condition(expr.left), this.condition(expr.right)],
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
                    Variable: this.evalJsonPath(val),
                    IsPresent: true,
                  },
                  {
                    Variable: this.evalJsonPath(val),
                    IsNull: false,
                  },
                ],
              };
            } else if (expr.op === "==") {
              return {
                Or: [
                  {
                    Variable: this.evalJsonPath(val),
                    IsPresent: false,
                  },
                  {
                    Variable: this.evalJsonPath(val),
                    IsNull: true,
                  },
                ],
              };
            }
          } else if (lit.kind === "StringLiteralExpr") {
            const [variable, value] = [
              this.evalJsonPath(val),
              lit.value,
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
          } else if (lit.kind === "NumberLiteralExpr") {
            const [variable, value] = [
              this.evalJsonPath(val),
              lit.value,
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

  public evalJsonPath(expr: Expr): string {
    if (expr.kind === "ArrayLiteralExpr") {
      return aws_stepfunctions.JsonPath.array(
        ...expr.items.map((item) => this.evalJsonPath(item))
      );
    } else if (expr.kind === "Identifier") {
      return `$.${expr.name}`;
    } else if (expr.kind === "PropAccessExpr") {
      return `${this.evalJsonPath(expr.expr)}.${expr.name}`;
    } else if (expr.kind === "ElementAccessExpr") {
      return `${this.evalJsonPath(expr.expr)}[${this.evalElement(
        expr.element
      )}]`;
    }

    debugger;
    throw new Error(
      `expression kind '${expr.kind}' cannot be evaluated to a JSON Path expression.`
    );
  }

  private evalElement(expr: Expr): string {
    if (expr.kind === "StringLiteralExpr") {
      return `'${expr.value}'`;
    } else if (expr.kind === "NumberLiteralExpr") {
      return expr.value.toString(10);
    }

    debugger;
    throw new Error(
      `Expression kind '${expr.kind}' is not allowed as an element in a Step Function`
    );
  }

  private getStateName(stmt: Stmt): string {
    if (!this.stateNames.has(stmt)) {
      const stateName = toStateName(stmt);
      if (stateName === undefined) {
        throw new Error(`cannot transition to ${stmt.kind}`);
      }
      this.stateNames.set(stmt, stateName);
    }
    return this.stateNames.get(stmt)!;

    function toStateName(stmt: Stmt): string | undefined {
      if (stmt.kind === "IfStmt") {
        return `if(${exprToString(stmt.when)})`;
      } else if (stmt.kind === "ExprStmt") {
        return exprToString(stmt.expr);
      } else if (stmt.kind === "BlockStmt") {
        return undefined;
      } else if (stmt.kind === "BreakStmt") {
        return "break";
      } else if (stmt.kind === "CatchClause") {
        return `catch${
          stmt.variableDecl?.name ? `(${stmt.variableDecl?.name})` : ""
        }`;
      } else if (stmt.kind === "ForInStmt") {
        return `for(${stmt.i.name} in ${exprToString(stmt.expr)})`;
      } else if (stmt.kind === "ForOfStmt") {
        return `for(${stmt.i.name} of ${exprToString(stmt.expr)})`;
      } else if (stmt.kind === "ReturnStmt") {
        return `return ${exprToString(stmt.expr)}`;
      } else if (stmt.kind === "ThrowStmt") {
        return `throw ${exprToString(stmt.expr)}`;
      } else if (stmt.kind === "TryStmt") {
        return `try`;
      } else if (stmt.kind === "VariableStmt") {
        return `${stmt.name} = ${
          stmt.expr ? exprToString(stmt.expr) : "undefined"
        }`;
      } else {
        return assertNever(stmt);
      }
    }

    function exprToString(expr: Expr): string {
      if (expr.kind === "ArrayLiteralExpr") {
        return `[${expr.items.map(exprToString).join(", ")}]`;
      } else if (expr.kind === "BinaryExpr") {
        return `${exprToString(expr.left)} ${expr.op} ${exprToString(
          expr.right
        )}`;
      } else if (expr.kind === "BooleanLiteralExpr") {
        return `${expr.value}`;
      } else if (expr.kind === "CallExpr") {
        return `${exprToString(expr.expr)}(${Object.values(expr.args)
          .map(exprToString)
          .join(", ")})`;
      } else if (expr.kind === "ConditionExpr") {
        return `if(${exprToString(expr.when)})`;
      } else if (expr.kind === "ElementAccessExpr") {
        return `${exprToString(expr.expr)}[${exprToString(expr.element)}]`;
      } else if (expr.kind === "FunctionExpr") {
        return `function(${expr.parameters
          .map((param) => param.name)
          .join(", ")})`;
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
  }

  private getReturnStateName(
    node: FunctionDecl | FunctionExpr | ForInStmt | ForOfStmt
  ) {
    return this.getOrCreateTransition(this.returnTransitions, "Success", node);
  }

  private getThrowStateName(
    node: FunctionDecl | FunctionExpr | ForInStmt | ForOfStmt
  ) {
    return this.getOrCreateTransition(this.throwTransitions, "Throw", node);
  }

  private getOrCreateTransition<
    Node extends FunctionDecl | FunctionExpr | ForInStmt | ForOfStmt
  >(transitions: Map<Node, string>, prefix: string, node: Node) {
    if (!transitions.has(node)) {
      transitions.set(
        node,
        `${prefix}${transitions.size === 0 ? "" : transitions.size}`
      );
    }
    return transitions.get(node)!;
  }
}
