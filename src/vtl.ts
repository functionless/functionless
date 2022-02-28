import { Call, Expr, Node, Stmt } from "./expression";
import { findFunction, isInTopLevelScope, lookupIdentifier } from "./analysis";
import { assertNever } from "./assert";

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
  public var(expr?: string): string;
  public var(id: string, expr: string): string;
  public var(a?: string, b?: string): string {
    if (a === undefined && b === undefined) {
      return this.newLocalVarName();
    } else if (a && b) {
      this.set(a, b);
      return a;
    }
    const varName = this.newLocalVarName();
    this.set(varName, a!);
    return varName;
  }

  private newLocalVarName() {
    return `$v${(this.varIt += 1)}`;
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
  public set(reference: string, expr: string): void {
    this.add(`#set(${reference} = ${expr})`);
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
  public call(call: Call): void {
    this.add(this.eval(call));
  }

  /**
   * Evaluate an {@link Expr} by emitting statements to this VTL template and
   * return a variable reference to the evaluated value.
   *
   * @param expr the {@link Expr} to evaluate.
   * @returns a variable reference to the evaluated value
   */
  public eval(expr: Expr): string;
  public eval(expr: Stmt): void;
  public eval(node: Node): string | void {
    if (node.kind === "ArrayLiteral") {
      return this.var(
        `[${node.items.map((item) => this.eval(item)).join(", ")}]`
      );
    } else if (node.kind === "Binary") {
      return this.var(
        `${this.eval(node.left)} ${node.op} ${this.eval(node.right)}`
      );
    } else if (node.kind === "Block") {
      for (const stmt of node.statements) {
        this.eval(stmt);
      }
      return undefined;
    } else if (node.kind === "BooleanLiteral") {
      return `${node.value}`;
    } else if (node.kind === "Call") {
      const serviceCall = findFunction(node);
      if (serviceCall) {
        return serviceCall(node, this);
      } else {
        return `${this.eval(node.expr)}(${Object.values(node.args)
          .map((arg) => this.eval(arg))
          .join(", ")})`;
      }
    } else if (node.kind === "ConditionExpr") {
      const val = this.var();
      this.add(`#if(${this.eval(node.when)})`);
      this.set(val, this.eval(node.then));
      this.add("#else");
      this.set(val, this.eval(node._else));
      this.add("#end");
      return val;
    } else if (node.kind === "ConditionStmt") {
      this.add(`#if(${this.eval(node.when)})`);
      this.eval(node.then);
      if (node._else) {
        this.add("#else");
        this.eval(node._else);
      }
      this.add("#end");
      return undefined;
    } else if (node.kind === "ExprStmt") {
      return this.qr(this.eval(node.expr));
    } else if (node.kind === "ForOfStmt" || node.kind === "ForInStmt") {
      const list = this.eval(node.expr);
      this.add(
        `#foreach($${node.i.name} in ${list}${
          node.kind === "ForInStmt" ? ".keySet()" : ""
        })`
      );
      this.eval(node.body);
      this.add(`#end`);
      return undefined;
    } else if (node.kind === "FunctionDecl") {
    } else if (node.kind === "Identifier") {
      if (node.name.startsWith("$")) {
        return node.name;
      }
      const ref = lookupIdentifier(node);
      if (ref?.kind === "VariableDecl" && isInTopLevelScope(ref)) {
        return `$context.stash.${node.name}`;
      } else if (ref?.kind === "ParameterDecl") {
        return `$context.arguments.${ref.name}`;
      }
      // determine is a stash or local variable
      return `$${node.name}`;
    } else if (node.kind === "PropRef") {
      let name = node.name;
      if (name === "push" && node.parent?.kind === "Call") {
        // this is a push to an array, rename to 'add'
        name = "add";
      }
      return `${this.eval(node.expr)}.${name}`;
    } else if (node.kind === "ElementAccess") {
      return `${this.eval(node.expr)}[${this.eval(node.element)}]`;
    } else if (node.kind === "NullLiteral") {
      return `$null`;
    } else if (node.kind === "NumberLiteral") {
      return node.value.toString(10);
    } else if (node.kind === "ObjectLiteral") {
      const obj = this.var("{}");
      for (const prop of node.properties) {
        if (prop.kind === "PropAssign") {
          this.qr(`${obj}.put('${prop.name}', ${this.eval(prop.expr)})`);
        } else if (prop.kind === "SpreadAssignment") {
          const itemName = this.var();
          const items = this.eval(prop.expr);
          this.add(`#foreach( ${itemName} in ${items}.keySet() )`);
          this.qr(`${obj}.put(${itemName}, ${items}.get(${itemName}))`);
          this.add(`#end`);
        } else {
          assertNever(prop);
        }
      }
      return obj;
    } else if (node.kind === "ParameterDecl") {
    } else if (node.kind === "PropAssign") {
    } else if (node.kind === "Reference") {
    } else if (node.kind === "Return") {
      this.set("$context.stash.return__val", this.eval(node.expr));
      this.set("$context.stash.return__flag", "true");
      this.add(`#return($context.stash.return__val)`);
      return "$null";
    } else if (node.kind === "SpreadAssignment") {
      // handled as part of ObjectLiteral
    } else if (node.kind === "StringLiteral") {
      return `'${node.value}'`;
    } else if (node.kind === "Unary") {
      return `${node.op} ${this.eval(node.expr)}`;
    } else if (node.kind === "VariableDecl") {
      const varName = isInTopLevelScope(node)
        ? `$context.stash.${node.name}`
        : `$${node.name}`;

      if (node.expr) {
        const expr = this.eval(node.expr);
        return this.var(varName, expr);
      } else {
        return varName;
      }
    }

    throw new Error(`cannot evaluate Expr kind: '${node.kind}'`);
  }
}
