import { Construct } from "constructs";
import { aws_iam, aws_stepfunctions } from "aws-cdk-lib";

import { assertNever } from "./assert";
import {
  ElementAccessExpr,
  Expr,
  FunctionExpr,
  isLiteralExpr,
  isReferenceExpr,
  isVariableReference,
  NullLiteralExpr,
} from "./expression";
import {
  BlockStmt,
  ForInStmt,
  ForOfStmt,
  IfStmt,
  ReturnStmt,
  Stmt,
} from "./statement";
import {
  findFunction,
  getLexicalScope,
  isTerminal,
  lookupIdentifier,
} from "./util";
import { FunctionDecl } from "./declaration";
import { FunctionlessNode } from "./node";
import { visitEachChild } from "./visit";
import { collect } from "./collect";

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

export type Parameters =
  | null
  | boolean
  | number
  | string
  | Parameters[]
  | {
      [name: string]: Parameters;
    };

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
  Parameters?: Parameters;
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
  Parameters?: Parameters;
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
  Branches: StateMachine<States>[];
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

  readonly decl: FunctionDecl;

  constructor(
    readonly scope: Construct,
    readonly role: aws_iam.IRole,
    decl: FunctionDecl
  ) {
    this.stateNames = new Map();
    this.returnTransitions = new Map();
    this.throwTransitions = new Map();

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
        } else if (!isTerminal(node.lastStmt)) {
          return new BlockStmt([
            ...node.statements.map((stmt) => visitEachChild(stmt, visit)),
            new ReturnStmt(new NullLiteralExpr()),
          ]);
        }
      }
      return visitEachChild(node, visit);
    });

    const states = this.execute(this.decl.body);

    const start = this.stepTo(this.decl.body);

    this.definition = {
      StartAt: start,
      States: states,
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
        [this.getStateName(stmt)]: this.eval(stmt.expr, {
          Next: this.next(stmt),
          ResultPath: null,
        }),
      };
    } else if (stmt.kind === "ForOfStmt" || stmt.kind === "ForInStmt") {
      return {
        [this.getStateName(stmt)]: {
          Type: "Map",
          ResultPath: null,
          ItemsPath: this.toJsonPath(stmt.expr),
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
            StartAt: this.getStateName(stmt.body.statements[0]),
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
          ...this.toCondition(curr.when),
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
            OutputPath: this.toJsonPath(stmt.expr),
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

      const catchClause = stmt.findThrowCatchClause();

      // TODO: handle case where we are inside a for-loop or `.map` function
      if (catchClause) {
        // const { hasTask } = analyzeFlow(catchClause.parent);

        // if this `throw` is within a try-catch, then Pass the error to the `catch` state
        return {
          [this.getStateName(stmt)]: {
            Type: "Pass",
            Result: Object.entries(stmt.expr.args).reduce(
              (args: any, [argName, argVal]) => ({
                ...args,
                [argName]: this.toJson(argVal),
              }),
              {}
            ),
            Next: this.stepTo(catchClause),
            ResultPath: catchClause.variableDecl
              ? `$.${catchClause.variableDecl.name}`
              : null,
          },
        };
      } else {
        // if this throw is not within a try-catch, then Fail the State Machine
        return {
          [this.getStateName(stmt)]: {
            Type: "Fail",
            Error: exprToString(stmt.expr.expr),
            Cause: JSON.stringify(
              Object.entries(stmt.expr.args).reduce(
                (args: any, [argName, argVal]) => ({
                  ...args,
                  [argName]: this.toJson(argVal),
                }),
                {}
              )
            ),
          },
        };
      }
    } else if (stmt.kind === "TryStmt") {
      const { hasTask } = analyzeFlow(stmt.tryBlock);

      return {
        ...this.execute(stmt.tryBlock),
        ...(hasTask && stmt.catchClause.variableDecl
          ? {
              [this.getStateName(stmt.catchClause.variableDecl)]: {
                Type: "Pass",
                Next: `0_${this.getStateName(stmt.catchClause.variableDecl)}`,
                Parameters: {
                  "0_ParsedError.$": `States.StringToJson(${`$.${stmt.catchClause.variableDecl.name}`}.Cause)`,
                },
                ResultPath: `$.${stmt.catchClause.variableDecl.name}`,
              },
              [`0_${this.getStateName(stmt.catchClause.variableDecl)}`]: {
                Type: "Pass",
                InputPath: `$.${stmt.catchClause.variableDecl.name}.0_ParsedError`,
                ResultPath: `$.${stmt.catchClause.variableDecl.name}`,
                Next: this.getStateName(stmt.catchClause.block.firstStmt),
              },
            }
          : {}),
        ...this.execute(stmt.catchClause.block),
        ...(stmt.finallyBlock ? this.execute(stmt.finallyBlock) : {}),
      };
    } else if (stmt.kind === "CatchClause") {
      return this.execute(stmt.block);
    }
    return assertNever(stmt);
  }

  private stepTo(node: Stmt): string {
    if (node.kind === "BlockStmt") {
      if (node.isEmpty()) {
        throw new Error(`a BlockStmt must have at least one statement`);
      }
      return this.stepTo(node.firstStmt);
    } else if (node.kind === "TryStmt") {
      return this.stepTo(node.tryBlock);
    } else if (node.kind === "CatchClause") {
      const { hasTask } = analyzeFlow(node.parent);
      if (hasTask && node.variableDecl) {
        return this.stepTo(node.variableDecl);
      } else {
        return this.stepTo(node.block);
      }
    } else {
      return this.getStateName(node);
    }
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
  }

  /**
   * Find the next state that the {@link node} should transition to.
   */
  private next(node: Stmt): string | undefined {
    if (node.kind === "ReturnStmt") {
      return this.return(node);
    } else if (node.next) {
      return this.stepTo(node.next);
    } else if (node.kind === "TryStmt" && isTerminal(node)) {
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
      } else if (scope.kind === "IfStmt") {
        return this.next(scope);
      } else if (scope.kind === "TryStmt") {
        if (block === scope.tryBlock) {
          // need to move to the finally block
          if (scope.finallyBlock?.isNotEmpty()) {
            return this.stepTo(scope.finallyBlock);
          }
          return this.next(scope);
        } else if (block === scope.finallyBlock) {
          // we're exiting the finallyBlock, so let's progress past it
          return this.next(scope);
        } else {
          throw new Error(`impossible`);
        }
      } else if (scope.kind === "CatchClause") {
        const tryStmt = scope.parent;
        if (tryStmt.finallyBlock?.isNotEmpty()) {
          return this.stepTo(tryStmt.finallyBlock);
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
      return this.getStateName(node.body.lastStmt);
    } else if (node.kind === "ForInStmt" || node.kind === "ForOfStmt") {
      return this.getStateName(node);
    } else {
      return this.return(node.parent);
    }
  }

  // private throw(node: FunctionlessNode): string | undefined {
  //   const catchClause = node.findThrowCatchClause();
  //   if (catchClause) {
  //     const { hasTask } = analyzeFlow(catchClause.parent.tryBlock);

  //     if (catchClause.variableDecl && hasTask) {
  //       // we first need to know if `hasTask` is true before routing to the `catch(err)` block
  //       // if there is no Task, then we will not have states to parse the Cause JSON string and should
  //       // therefore jump straight to the firstStmt of the catchClause instead
  //       return this.getStateName(catchClause.variableDecl);
  //     } else {
  //       return this.getStateName(catchClause.block.firstStmt);
  //     }
  //   } else {
  //     return undefined;
  //   }
  //   // const parent = node.parent;
  //   // if (parent === undefined) {
  //   //   return undefined;
  //   // } else if (parent.kind === "TryStmt") {
  //   //   const { hasTask } = analyzeFlow(parent.tryBlock);

  //   //   if (parent.catchClause.variableDecl && hasTask) {
  //   //     // we first need to know if `hasTask` is true before routing to the `catch(err)` block
  //   //     // if there is no Task, then we will not have states to parse the Cause JSON string and should
  //   //     // therefore jump straight to the firstStmt of the catchClause instead
  //   //     return this.getStateName(parent.catchClause.variableDecl);
  //   //   } else {
  //   //     return this.getStateName(parent.catchClause.block.firstStmt);
  //   //   }
  //   // } else if (parent.kind === "CatchClause") {
  //   //   // skip the try-block
  //   //   return this.throw(parent.parent);
  //   // } else {
  //   //   return this.throw(parent);
  //   // }
  // }

  public eval(
    expr: Expr,
    props: {
      ResultPath: string | null;
      End?: true;
      Next?: string;
    }
  ): State {
    if (props.End === undefined && props.Next === undefined) {
      delete props.Next;
      props.End = true;
    }
    if (expr.kind === "CallExpr") {
      const serviceCall = findFunction(expr);
      if (serviceCall) {
        const task = serviceCall(expr, this);

        const catchClause = expr.findThrowCatchClause();

        return {
          ...task,
          ...props,
          ...(catchClause
            ? {
                Catch: [
                  {
                    ErrorEquals: ["States.ALL"],
                    Next: this.stepTo(catchClause),
                  },
                ],
              }
            : {}),
        };
      }
      throw new Error(`call must be a service call, ${expr}`);
    } else if (isVariableReference(expr)) {
      return {
        Type: "Pass",
        Parameters: {
          [`result${isLiteralExpr(expr) ? "" : ".$"}`]: this.toJsonPath(expr),
        },
        OutputPath: "$.result",
        ...props,
      };
    } else if (expr.kind === "ObjectLiteralExpr") {
      return {
        Type: "Pass",
        Parameters: this.toJson(expr),
        ...props,
      };
    } else if (isLiteralExpr(expr)) {
      return {
        Type: "Pass",
        Result: this.toJson(expr),
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
              getLexicalScope(expr).map((name) => [`${name}.$`, `$.${name}`])
            ),
            [this.toJsonPath(expr.left)]: null,
          },
        };
      } else if (isVariableReference(expr.right)) {
        return {
          Type: "Pass",
          ...props,
          InputPath: this.toJsonPath(expr.right),
          ResultPath: this.toJsonPath(expr.left),
        };
      } else if (isLiteralExpr(expr.right)) {
        return {
          Type: "Pass",
          ...props,
          Parameters: this.toJson(expr.right),
          ResultPath: this.toJsonPath(expr.left),
        };
      }
    }
    throw new Error(`cannot eval expression kind '${expr.kind}'`);
  }

  public toJson(expr: Expr): any {
    if (expr.kind === "Identifier") {
      return this.toJsonPath(expr);
    } else if (expr.kind === "PropAccessExpr") {
      return `${this.toJson(expr.expr)}.${expr.name}`;
    } else if (
      expr.kind === "ElementAccessExpr" &&
      expr.element.kind === "NumberLiteralExpr"
    ) {
      return `${this.toJson(expr.expr)}[${expr.element.value}]`;
    } else if (expr.kind === "ArrayLiteralExpr") {
      if (expr.items.find(isVariableReference) !== undefined) {
        return `States.Array(${expr.items
          .map((item) => this.toJsonPath(item))
          .join(", ")})`;
      }
      return expr.items.map((item) => this.toJson(item));
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
        ] = this.toJson(prop.expr);
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
      return this.toJsonPath(expr);
    }
    throw new Error(`cannot evaluate ${expr.kind} to JSON`);
  }

  public toJsonPath(expr: Expr): string {
    if (expr.kind === "ArrayLiteralExpr") {
      return aws_stepfunctions.JsonPath.array(
        ...expr.items.map((item) => this.toJsonPath(item))
      );
    } else if (expr.kind === "Identifier") {
      return `$.${expr.name}`;
    } else if (expr.kind === "PropAccessExpr") {
      return `${this.toJsonPath(expr.expr)}.${expr.name}`;
    } else if (expr.kind === "ElementAccessExpr") {
      return this.elementAccessExprToJsonPath(expr);
    }

    throw new Error(
      `expression kind '${expr.kind}' cannot be evaluated to a JSON Path expression.`
    );
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
  private elementAccessExprToJsonPath(expr: ElementAccessExpr): string {
    if (expr.element.kind === "Identifier" && expr.expr.kind === "Identifier") {
      const element = lookupIdentifier(expr.element);
      if (
        element?.kind === "VariableStmt" &&
        element?.parent?.kind === "ForInStmt" &&
        expr.findNearestParent("ForInStmt") === element.parent
      ) {
        return `$.0_${element.name}`;
      } else {
        throw new Error(
          `cannot use an Identifier to index an Array or Object except for an array in a for-in statement`
        );
      }
    }
    return `${this.toJsonPath(expr.expr)}[${this.evalElement(expr.element)}]`;
  }

  public toCondition(expr: Expr): Condition {
    if (expr.kind === "UnaryExpr") {
      return {
        Not: this.toCondition(expr.expr),
      };
    } else if (expr.kind === "BinaryExpr") {
      if (expr.op === "&&") {
        return {
          And: [this.toCondition(expr.left), this.toCondition(expr.right)],
        };
      } else if (expr.op === "||") {
        return {
          Or: [this.toCondition(expr.left), this.toCondition(expr.right)],
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
                    Variable: this.toJsonPath(val),
                    IsPresent: true,
                  },
                  {
                    Variable: this.toJsonPath(val),
                    IsNull: false,
                  },
                ],
              };
            } else if (expr.op === "==") {
              return {
                Or: [
                  {
                    Variable: this.toJsonPath(val),
                    IsPresent: false,
                  },
                  {
                    Variable: this.toJsonPath(val),
                    IsNull: true,
                  },
                ],
              };
            }
          } else if (lit.kind === "StringLiteralExpr") {
            const [variable, value] = [
              this.toJsonPath(val),
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
              this.toJsonPath(val),
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
    throw new Error(`cannot evaluate expression: '${expr.kind}`);
  }

  private evalElement(expr: Expr): string {
    if (expr.kind === "StringLiteralExpr") {
      return `'${expr.value}'`;
    } else if (expr.kind === "NumberLiteralExpr") {
      return expr.value.toString(10);
    }

    throw new Error(
      `Expression kind '${expr.kind}' is not allowed as an element in a Step Function`
    );
  }
}

interface FlowResult {
  hasTask?: true;
  hasThrow?: true;
}

/**
 * Analyze the flow contained within a section of the AST and determine if it has any tasks or throw statements.
 */
function analyzeFlow(node: FunctionlessNode): FlowResult {
  if (node.kind === "CallExpr" && findFunction(node) !== undefined) {
    return { hasTask: true };
  } else if (node.kind === "ThrowStmt") {
    return { hasThrow: true };
  }
  return collect(node, analyzeFlow).reduce((a, b) => ({ ...a, ...b }), {});
}

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
    )}(${Object.values(expr.args).map(exprToString).join(", ")})`;
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
