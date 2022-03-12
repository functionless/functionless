import { Construct } from "constructs";
import { aws_iam, aws_stepfunctions } from "aws-cdk-lib";

import { assertNever } from "./assert";
import { CallExpr, Expr, isLiteralExpr } from "./expression";
import { Stmt } from "./statement";
import { findFunction, lookupIdentifier } from "./util";
import { FunctionDecl } from "./declaration";

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
export type State = Succeed | Fail | Choice | Task | Pass | Map | Parallel;
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
  Error: string;
}

export interface TaskParameters {
  [key: string]: any;
}

export type Nextable =
  | {
      End: true;
      Next?: never;
    }
  | {
      End?: never;
      Next: string;
    };

export interface Pass {
  Comment?: string;
  Type: "Pass";
  InputPath?: string;
  OutputPath?: string;
  ResultPath?: string;
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
  IsBoolean?: string;
  IsNull?: string;
  IsNumeric?: string;
  IsPresent?: string;
  IsString?: string;
  IsTimestamp?: string;
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
  ResultPath?: string;
  Next: string;
}

export type BaseTask = Nextable & {
  Comment?: string;
  InputPath?: string;
  OutputPath?: string;
  Parameters?: TaskParameters;
  ResultSelector?: string;
  ResultPath?: string;
  Retry?: Retry[];
  Catch?: Catch[];
};

export type Task = BaseTask & {
  Type: "Task";
  Resource: string;
};

export type Map = BaseTask & {
  Type: "Map";
  Iterator: States;
};

export type Parallel = BaseTask & {
  Type: "Parallel";
  Iterator: States;
};

/**
 * Amazon States Language (ASL) Generator.
 */
export class ASL {
  static readonly ContextName = "Amazon States Language";

  readonly kind = ASL.ContextName;

  protected varNameIt: number = 0;
  protected constructNameIt: number = 0;

  constructor(
    readonly scope: Construct,
    readonly role: aws_iam.IRole,
    readonly parent?: ASL
  ) {}

  private push(): ASL {
    return new ASL(this.scope, this.role, this.parent);
  }

  private pop() {
    return this.parent;
  }

  private block<T>(fn: () => T) {
    this.push();
    const t = fn();
    this.pop();
    return t;
  }

  private getNextVarName(): string {
    if (this.parent) {
      return this.parent.getNextVarName();
    } else {
      return `v${(this.varNameIt += 1)}`;
    }
  }

  private getNextStateId(): string {
    if (this.parent) {
      return this.parent.getNextVarName();
    } else {
      return `Step${(this.constructNameIt += 1)}`;
    }
  }

  public interpret(func: FunctionDecl): StateMachine<States> {
    const returnState = this.getNextStateId();
    const throwState = this.getNextStateId();

    const states = this.execute(func.body, returnState, throwState);
    const start = Object.keys(states)[0];

    return {
      StartAt: start,
      States: {
        ...states,
        [returnState]: {
          Type: "Succeed",
        },
        [throwState]: {
          Type: "Fail",
          Error: "TODO",
        },
      },
    };
  }

  public execute(
    stmt: Stmt,
    returnState: string,
    throwState: string,
    breakState?: string
  ): States {
    if (stmt.kind === "BlockStmt") {
      return stmt.statements.reduce((states: States, s, i) => {
        if (i < stmt.statements.length - 1) {
          return {
            ...states,
            ...this.execute(s, returnState, throwState),
          };
        } else {
          return {
            ...states,
            ...this.execute(s, returnState, throwState),
          };
        }
      }, {});
    } else if (stmt.kind === "BreakStmt") {
      if (breakState === undefined) {
        throw new Error(`cannot break outside of a for-loop`);
      }
    } else if (stmt.kind === "ExprStmt") {
    } else if (stmt.kind === "ForInStmt") {
      throw new Error(`for-in is no supported in Amazon States Language`);
    } else if (stmt.kind === "ForOfStmt") {
      const innerReturnState = this.getNextStateId();
      const innerThrowState = this.getNextStateId();
      return {
        [this.getNextStateId()]: {
          Type: "Map",
          InputPath: this.evalJsonPath(stmt.expr),
          End: undefined,
          Next: "",
          Iterator: this.execute(
            stmt.body,
            innerReturnState,
            innerThrowState,
            innerReturnState
          ),
        },
      };
    } else if (stmt.kind === "IfStmt") {
      return {
        [this.getNextStateId()]: {
          Type: "Choice",
          Choices: [],
          Default: "",
        },
      };
    } else if (stmt.kind === "ReturnStmt") {
      return {
        [this.getNextStateId()]: {
          ...this.eval(stmt.expr),
          End: undefined,
          Next: returnState,
        },
      };
    } else if (stmt.kind === "VariableStmt") {
      if (stmt.expr === undefined) {
        return {};
      }
      return {
        [this.getNextStateId()]: this.eval(stmt.expr),
      };
    } else {
      return assertNever(stmt);
    }
  }

  public eval(expr: Expr): State {
    switch (expr.kind) {
      case "CallExpr":
        return this.call(expr);

      default:
        throw new Error(`cannot eval expression kind '${expr.kind}'`);
    }
  }

  public call(call: CallExpr): Task {
    const serviceCall = findFunction(call);
    if (serviceCall) {
      return {
        Type: "Task",
      };
    }
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
                Not: {
                  IsNull: this.evalJsonPath(val),
                },
              };
            } else if (expr.op === "==") {
              return {
                IsNull: this.evalJsonPath(val),
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

  private evalJsonPath(expr: Expr): string {
    if (expr.kind === "ArrayLiteralExpr") {
      return aws_stepfunctions.JsonPath.array(
        ...expr.items.map((item) => this.evalJsonPath(item))
      );
    } else if (expr.kind === "Identifier") {
      const ref = lookupIdentifier(expr);
      if (
        ref?.kind === "ParameterDecl" &&
        ref.parent?.kind === "FunctionExpr"
      ) {
        // this is a nested FunctionExpr, such as in list.map.
        return `$$.Map.Item.Value`;
      }
      return `$.${expr.name}`;
    } else if (expr.kind === "PropAccessExpr") {
      return `${this.evalJsonPath(expr.expr)}['${expr.name}']`;
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
}
