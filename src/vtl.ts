import { CallExpr, Expr } from "./expression";
import { findFunction, isInTopLevelScope, lookupIdentifier } from "./util";
import { assertNever } from "./assert";
import { FunctionlessNode } from "./node";
import { Stmt } from "./statement";
import { FunctionExpr } from ".";

// https://velocity.apache.org/engine/devel/user-guide.html#conditionals
// https://cwiki.apache.org/confluence/display/VELOCITY/CheckingForNull
// https://velocity.apache.org/engine/devel/user-guide.html#set

export class VTL {
  private readonly statements: string[] = [];

  private varIt = 0;

  constructor(...statements: string[]) {
    this.statements.push(...statements);
  }

  public toVTL(): string {
    return this.statements.join("\n");
  }

  public add(...statements: string[]) {
    this.statements.push(...statements);
  }

  /**
   * Declare a new variable.
   *
   * @param expr - optional value to initialize the value to
   * @returns the variable reference, e.g. $v1
   */
  // public var(expr?: Expr | string): string;
  // public var(id?: string): string;
  // public var(id: string, expr: Expr): string;
  // public var(a?: string | Expr, b?: Expr): string {
  //   if (a === undefined && b === undefined) {
  //     return this.newLocalVarName();
  //   } else if (typeof a === "string") {

  //     this.set(a, b);
  //     return a;
  //   }
  //   const varName = this.newLocalVarName();
  //   this.set(varName, a as Expr);
  //   return varName;
  // }

  private newLocalVarName() {
    return `v${(this.varIt += 1)}`;
  }

  /**
   * Converts a variable {@link reference} to JSON using the built-in `$util.toJson` intrinsic function.
   *
   * @param reference variable reference
   * @returns VTL expression which yields a JSON string of the variable {@link reference}.
   */
  public json(reference: string): string {
    return `$util.toJson(${reference})`;
  }

  /**
   * Evaluates an {@link expr} with the `$util.qr` statement.
   *
   * @param expr expression string to evaluate quietly (i.e. without emitting to output) .
   */
  public qr(expr: string): void {
    this.add(`$util.qr(${expr})`);
  }

  /**
   * Add a statement which sets the variable {@link reference} to the value of the {@link expr}.
   *
   * @param reference the name of the variable to set
   * @param expr the value to set the variable to
   */
  public set(reference: string, expr: Expr | string): string {
    this.add(
      `#set(\$${reference} = ${typeof expr === "string" ? expr : this.$(expr)})`
    );
    return reference;
  }

  /**
   * References an expression.
   * @param expr
   * @param surround
   * @returns
   */
  public $(expr: Expr, returnVar?: string, surround = false): string {
    const text = this.eval(expr, returnVar);
    if (text.startsWith("$")) {
      return text;
    }
    return expr.kind === "CallExpr" ||
      expr.kind === "BinaryExpr" ||
      expr.kind === "ConditionExpr" ||
      expr.kind === "ElementAccessExpr" ||
      expr.kind === "Identifier" ||
      expr.kind === "ObjectLiteralExpr" ||
      expr.kind === "PropAccessExpr" ||
      expr.kind === "UnaryExpr"
      ? surround
        ? `\${${text}}`
        : `\$${text}`
      : text;
  }

  /**
   * Stores the {@link expr} in a new variable with a uniquely generated name.
   *
   * @param expr the expression
   * @returns the variable name that contains the value.
   */
  public var(expr: string | Expr): string {
    return this.set(this.newLocalVarName(), expr);
  }

  /**
   * Evaluate and return an {@link expr}.
   *
   * @param expr expression to evaluate
   * @returns a `#return` VTL expression.
   */
  public return(expr: string | Expr): void {
    if (typeof expr === "string") {
      this.add(`#return(${expr})`);
    } else {
      return this.return(this.eval(expr));
    }
  }

  /**
   * Call a service API. The Call expression will be evaluated and JSON will be rendered
   * to the Velocity Template output. This JSON payload will be passed to the
   * service-to-service integration, e.g. a Dynamo API request.
   *
   * ```json
   * #set($payload = {
   *   "operation": "GetItem",
   *   "key": $util.toJson($util.toDynamoDB($key)),
   * })
   * $util.toJson($payload)
   * ```
   * @param call
   */
  public call(call: CallExpr): void {
    this.add(this.eval(call));
  }

  /**
   * Evaluate an {@link Expr} by emitting statements to this VTL template and
   * return a variable reference to the evaluated value.
   *
   * @param expr the {@link Expr} to evaluate.
   * @returns a variable reference to the evaluated value
   */
  public eval(expr: Expr, returnVar?: string): string;
  public eval(expr: Stmt, returnVar?: string): void;
  public eval(node: FunctionlessNode, returnVar?: string): string | void {
    if (node.kind === "ArrayLiteralExpr") {
      return `[${node.items.map((item) => this.$(item)).join(", ")}]`;
    } else if (node.kind === "BinaryExpr") {
      return `${this.$(node.left)} ${node.op} ${this.$(node.right)}`;
    } else if (node.kind === "BlockStmt") {
      for (const stmt of node.statements) {
        this.eval(stmt);
      }
      return undefined;
    } else if (node.kind === "BooleanLiteralExpr") {
      return `${node.value}`;
    } else if (node.kind === "BreakStmt") {
      return this.add("#break");
    } else if (node.kind === "CallExpr") {
      const serviceCall = findFunction(node);
      if (serviceCall) {
        return serviceCall(node, this);
      } else if (
        node.expr.kind === "PropAccessExpr" &&
        (node.expr.name === "map" ||
          node.expr.name === "forEach" ||
          node.expr.name === "reduce")
      ) {
        if (node.expr.name === "map") {
          // list.map(item => ..)
          // list.map((item, idx) => ..)
          const fn = node.args.callbackfn as FunctionExpr;
          const newList = this.var(`[]`);
          const list = this.$(node.expr.expr);
          const value = fn.parameters[0]?.name ?? this.newLocalVarName();
          const index = fn.parameters[1]?.name;
          const array = fn.parameters[2]?.name;

          this.add(`#foreach($${value} in ${list})`);
          if (index) {
            this.add(`#set($${index} = $foreach.index)`);
          }
          if (array) {
            this.add(`#set($${array} = $${list})`);
          }

          const tmp = this.newLocalVarName();
          for (const stmt of fn.body.statements) {
            this.eval(stmt, tmp);
          }
          this.qr(`$${newList}.add($${tmp})`);
          return newList;
        }
        // this is an array map, forEach, reduce call
      }
      return `${this.eval(node.expr)}(${Object.values(node.args)
        .map((arg) => this.$(arg))
        .join(", ")})`;
    } else if (node.kind === "ConditionExpr") {
      const val = this.newLocalVarName();
      this.add(`#if(${this.eval(node.when)})`);
      this.set(val, node.then);
      this.add("#else");
      this.set(val, node._else);
      this.add("#end");
      return val;
    } else if (node.kind === "IfStmt") {
      this.add(`#if(${this.eval(node.when)})`);
      this.eval(node.then);
      if (node._else) {
        this.add("#else");
        this.eval(node._else);
      }
      this.add("#end");
      return undefined;
    } else if (node.kind === "ExprStmt") {
      return this.qr(this.$(node.expr));
    } else if (node.kind === "ForOfStmt" || node.kind === "ForInStmt") {
      this.add(
        `#foreach($${node.i.name} in ${this.$(node.expr)}${
          node.kind === "ForInStmt" ? ".keySet()" : ""
        })`
      );
      this.eval(node.body);
      this.add(`#end`);
      return undefined;
    } else if (node.kind === "FunctionDecl") {
    } else if (node.kind === "FunctionExpr") {
      return this.eval(node.body);
    } else if (node.kind === "Identifier") {
      const ref = lookupIdentifier(node);
      if (ref?.kind === "VariableStmt" && isInTopLevelScope(ref)) {
        return `context.stash.${node.name}`;
      } else if (
        ref?.kind === "ParameterDecl" &&
        ref.parent?.kind === "FunctionDecl"
      ) {
        return `context.arguments.${ref.name}`;
      }
      return node.name;
    } else if (node.kind === "PropAccessExpr") {
      let name = node.name;
      if (name === "push" && node.parent?.kind === "CallExpr") {
        // this is a push to an array, rename to 'add'
        name = "add";
      }
      return `${this.eval(node.expr)}.${name}`;
    } else if (node.kind === "ElementAccessExpr") {
      return `${this.eval(node.expr)}[${this.$(node.element)}]`;
    } else if (node.kind === "NullLiteralExpr") {
      return "$null";
    } else if (node.kind === "NumberLiteralExpr") {
      return node.value.toString(10);
    } else if (node.kind === "ObjectLiteralExpr") {
      const obj = this.var("{}");
      for (const prop of node.properties) {
        if (prop.kind === "PropAssignExpr") {
          this.qr(`$${obj}.put('${prop.name}', ${this.$(prop.expr)})`);
        } else if (prop.kind === "SpreadAssignExpr") {
          const itemName = this.newLocalVarName();
          const items = this.$(prop.expr);
          this.add(`#foreach( $${itemName} in ${items}.keySet() )`);
          this.qr(`$${obj}.put($${itemName}, ${items}.get($${itemName}))`);
          this.add(`#end`);
        } else {
          assertNever(prop);
        }
      }
      return obj;
    } else if (node.kind === "ParameterDecl") {
    } else if (node.kind === "PropAssignExpr") {
    } else if (node.kind === "ReferenceExpr") {
    } else if (node.kind === "ReturnStmt") {
      if (returnVar) {
        this.set(returnVar, node.expr);
      } else {
        this.set("context.stash.return__val", node.expr);
        this.add("#set($context.stash.return__flag = true)");
        this.add(`#return($context.stash.return__val)`);
      }
      return undefined;
    } else if (node.kind === "SpreadAssignExpr") {
      // handled as part of ObjectLiteral
    } else if (node.kind === "StringLiteralExpr") {
      return `'${node.value}'`;
    } else if (node.kind === "TemplateExpr") {
      return `"${node.exprs
        .map((expr) => {
          if (expr.kind === "StringLiteralExpr") {
            return expr.value;
          }
          return this.$(expr, returnVar, true);
        })
        .join("")}"`;
    } else if (node.kind === "UnaryExpr") {
      return `${node.op} ${this.eval(node.expr)}`;
    } else if (node.kind === "VariableStmt") {
      const varName = isInTopLevelScope(node)
        ? `context.stash.${node.name}`
        : node.name;

      if (node.expr) {
        return this.set(varName, node.expr);
      } else {
        return varName;
      }
    }

    throw new Error(`cannot evaluate Expr kind: '${node.kind}'`);
  }
}
