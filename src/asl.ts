import { Construct } from "constructs";
import { aws_stepfunctions, aws_stepfunctions_tasks } from "aws-cdk-lib";

import { assertNever } from "./assert";
import { Expr, isLiteralExpr } from "./expression";
import { Stmt } from "./statement";
import { findFunction, isInTopLevelScope, lookupIdentifier } from "./util";

export function isASL(a: any): a is ASL {
  return (a as ASL | undefined)?.kind === ASL.ContextName;
}

type Chain = aws_stepfunctions.IChainable & aws_stepfunctions.INextable;

/**
 * Amazon States Language (ASL) Generator.
 */
export class ASL {
  static readonly ContextName = "Amazon States Language";

  readonly kind = ASL.ContextName;

  protected varNameIt: number = 0;
  protected constructNameIt: number = 0;

  constructor(readonly scope: Construct, readonly parent?: ASL) {}

  private push(): ASL {
    return new ASL(this.scope, this.parent);
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

  private getNextConstructId(): string {
    if (this.parent) {
      return this.parent.getNextVarName();
    } else {
      return `Step${(this.constructNameIt += 1)}`;
    }
  }

  public evalStmt(stmt: Stmt): Chain {
    if (stmt.kind === "BlockStmt") {
      return this.block(() => {
        let chain: Chain | undefined;
        for (const s of stmt.statements) {
          if (chain !== undefined) {
            const next = this.evalStmt(s);
            chain = chain.next(next);
          } else {
            chain = this.evalStmt(s) ?? chain;
          }
        }
        return (
          chain ??
          new aws_stepfunctions.Pass(this.scope, this.getNextConstructId())
        );
      });
    } else if (stmt.kind === "BreakStmt") {
    } else if (stmt.kind === "ExprStmt") {
      return this.evalExpr(stmt.expr, aws_stepfunctions.JsonPath.DISCARD);
    } else if (stmt.kind === "ForInStmt") {
    } else if (stmt.kind === "ForOfStmt") {
    } else if (stmt.kind === "IfStmt") {
      let choice = new aws_stepfunctions.Choice(
        this.scope,
        this.getNextConstructId(),
        {
          // inputPath: ?
          // outputPath: ?
        }
      );

      let curr: Stmt | undefined = stmt;
      while (curr?.kind === "IfStmt") {
        choice = choice.when(
          this.evalCondition(curr.when),
          this.evalStmt(curr.then)
        );
        curr = curr._else;
      }
      if (curr !== undefined) {
        return choice.otherwise(this.evalStmt(curr)).afterwards();
      } else {
        return choice.afterwards();
      }
    } else if (stmt.kind === "ReturnStmt") {
      return this.evalExpr(stmt.expr, "$").next(
        new aws_stepfunctions.Succeed(this.scope, this.getNextConstructId(), {
          outputPath: "$",
        })
      );
    } else if (stmt.kind === "VariableStmt") {
      if (stmt.expr && isInTopLevelScope(stmt)) {
        return this.evalExpr(stmt.expr, `$.${stmt.name}`);
      }
    } else {
      return assertNever(stmt);
    }

    debugger;
    throw new Error(`cannot evaluate statement: '${stmt.kind}`);
  }

  public evalExpr(
    expr: Expr,
    outputPath: string = aws_stepfunctions.JsonPath.DISCARD
  ): Chain {
    if (expr.kind === "ArrayLiteralExpr") {
    } else if (expr.kind === "BinaryExpr") {
    } else if (expr.kind === "BooleanLiteralExpr") {
    } else if (expr.kind === "CallExpr") {
      const serviceCall = findFunction(expr);
      if (serviceCall) {
        return new aws_stepfunctions_tasks.CallAwsService(
          this.scope,
          this.getNextConstructId(),
          {
            ...serviceCall(expr, this, outputPath),
            outputPath,
          }
        );
      }
    } else if (expr.kind === "ConditionExpr") {
      const choice = new aws_stepfunctions.Choice(
        this.scope,
        this.getNextConstructId(),
        {
          outputPath,
        }
      );

      let curr: Expr | undefined = expr;
      while (curr?.kind === "ConditionExpr") {
        choice.when(
          this.evalCondition(curr.when),
          this.evalExpr(curr.then, outputPath)
        );
        curr = curr._else;
      }
      if (curr !== undefined) {
        return choice.otherwise(this.evalExpr(curr, outputPath)).afterwards();
      } else {
        return choice.afterwards();
      }
    } else if (expr.kind === "NullLiteralExpr") {
      return new aws_stepfunctions.Pass(this.scope, this.getNextConstructId(), {
        outputPath,
        result: aws_stepfunctions.Result.fromObject({ val: null }),
        resultPath: "$.val",
      });
    }
    debugger;
    throw new Error(`cannot evaluate expression kind: '${expr.kind}'`);
  }

  public evalCondition(expr: Expr): aws_stepfunctions.Condition {
    if (expr.kind === "UnaryExpr") {
      return aws_stepfunctions.Condition.not(this.evalCondition(expr.expr));
    } else if (expr.kind === "BinaryExpr") {
      if (expr.op === "&&") {
        return aws_stepfunctions.Condition.and(
          this.evalCondition(expr.left),
          this.evalCondition(expr.right)
        );
      } else if (expr.op === "||") {
        return aws_stepfunctions.Condition.or(
          this.evalCondition(expr.left),
          this.evalCondition(expr.right)
        );
      } else if (expr.op === "+" || expr.op === "-") {
      } else {
        if (isLiteralExpr(expr.left) && isLiteralExpr(expr.right)) {
        } else if (isLiteralExpr(expr.left) || isLiteralExpr(expr.right)) {
          const [lit, val] = isLiteralExpr(expr.left)
            ? [expr.left, expr.right]
            : [expr.right, expr.left];

          if (lit.kind === "NullLiteralExpr") {
            if (expr.op === "!=") {
              return aws_stepfunctions.Condition.isNotNull(
                this.evalJsonPath(val)
              );
            } else if (expr.op === "==") {
              return aws_stepfunctions.Condition.isNull(this.evalJsonPath(val));
            }
          } else if (lit.kind === "StringLiteralExpr") {
            const args = [this.evalJsonPath(val), lit.value] as const;
            if (expr.op === "==") {
              return aws_stepfunctions.Condition.stringEquals(...args);
            } else if (expr.op === "!=") {
              return aws_stepfunctions.Condition.not(
                aws_stepfunctions.Condition.stringEquals(...args)
              );
            } else if (expr.op === "<") {
              return aws_stepfunctions.Condition.stringLessThan(...args);
            } else if (expr.op === "<=") {
              return aws_stepfunctions.Condition.stringLessThanEquals(...args);
            } else if (expr.op === ">") {
              return aws_stepfunctions.Condition.stringGreaterThan(...args);
            } else if (expr.op === ">=") {
              return aws_stepfunctions.Condition.stringGreaterThanEquals(
                ...args
              );
            }
          } else if (lit.kind === "NumberLiteralExpr") {
            const args = [this.evalJsonPath(val), lit.value] as const;
            if (expr.op === "==") {
              return aws_stepfunctions.Condition.numberEquals(...args);
            } else if (expr.op === "!=") {
              return aws_stepfunctions.Condition.not(
                aws_stepfunctions.Condition.numberEquals(...args)
              );
            } else if (expr.op === "<") {
              return aws_stepfunctions.Condition.numberLessThan(...args);
            } else if (expr.op === "<=") {
              return aws_stepfunctions.Condition.numberLessThanEquals(...args);
            } else if (expr.op === ">") {
              return aws_stepfunctions.Condition.numberGreaterThan(...args);
            } else if (expr.op === ">=") {
              return aws_stepfunctions.Condition.numberGreaterThanEquals(
                ...args
              );
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

export interface Task {}
