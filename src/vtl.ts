import { AnyFunction } from "./function";
import { Call, Expr } from "./expression";
import { lookupIdentifier } from "./analysis";
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
  public var(expr?: string): string {
    const varName = `$v${(this.varIt += 1)}`;
    if (expr === undefined) {
      return varName;
    }
    this.set(varName, expr);
    return varName;
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
  public qr(expr: string) {
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
  public eval(expr: Expr): string {
    if (expr.kind === "ArrayLiteral") {
      return this.var(`[${expr.items.map(this.eval).join(", ")}]`);
    } else if (expr.kind === "Binary") {
      return this.var(
        `${this.eval(expr.left)} ${expr.op} ${this.eval(expr.right)}`
      );
    } else if (expr.kind === "Block") {
      let last;
      for (const exp of expr.exprs) {
        last = this.eval(exp);
      }
      return last ?? "$null";
    } else if (expr.kind === "BooleanLiteral") {
      return this.var(`${expr.value}`);
    } else if (expr.kind === "Call") {
      const serviceCall = findFunction(expr);
      if (serviceCall) {
        return serviceCall(expr, this);
      } else {
        return this.var(
          `${this.eval(expr.expr)}(${Object.values(expr.args)
            .map(this.eval)
            .join(", ")})`
        );
      }
    } else if (expr.kind === "ConditionExpr") {
      const val = this.var();
      this.add(`#if(${this.eval(expr.when)})`);
      this.set(val, this.eval(expr.then));
      this.add("#else");
      this.set(val, this.eval(expr._else));
      this.add("#end");
      return val;
    } else if (expr.kind === "ConditionStmt") {
      this.add(`#if(${this.eval(expr.when)})`);
      this.eval(expr.then);
      if (expr._else) {
        this.add("#else");
        this.eval(expr._else);
      }
      this.add("#end");
      return `$null`;
    } else if (expr.kind === "FunctionDecl") {
    } else if (expr.kind === "Identifier") {
      if (expr.name.startsWith("$")) {
        return expr.name;
      }

      const ref = lookupIdentifier(expr);
      if (ref?.kind === "VariableDecl") {
        return `$context.stash.${expr.name}`;
      } else if (ref?.kind === "ParameterDecl") {
        return `$context.arguments.${ref.name}`;
      }
      // determine is a stash or local variable
      return expr.name;
    } else if (expr.kind === "PropRef") {
      return `${this.eval(expr.expr)}.${expr.id}`;
    } else if (expr.kind === "Map") {
    } else if (expr.kind === "NullLiteral") {
      return `$null`;
    } else if (expr.kind === "NumberLiteral") {
      return this.var(expr.value.toString(10));
    } else if (expr.kind === "ObjectLiteral") {
      const obj = this.var("{}");
      for (const prop of expr.properties) {
        if (prop.kind === "PropertyAssignment") {
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
    } else if (expr.kind === "ParameterDecl") {
    } else if (expr.kind === "PropertyAssignment") {
      throw new Error("");
    } else if (expr.kind === "Reference") {
    } else if (expr.kind === "Return") {
      this.set("$context.stash.return__flag", "true");
      this.set("$context.stash.return__val", this.eval(expr.expr));
      this.add(`#return($context.stash.return__val)`);
      return "$null";
    } else if (expr.kind === "SpreadAssignment") {
      // handled as part of ObjectLiteral
    } else if (expr.kind === "StringLiteral") {
      return this.var(`"${expr.value}"`);
    } else if (expr.kind === "Unary") {
      return `${expr.op} ${this.eval(expr.expr)}`;
    } else if (expr.kind === "VariableDecl") {
      return this.var(this.eval(expr.expr));
    }

    throw new Error(`cannot evaluate Expr kind: '${expr.kind}'`);
  }
}

export function findFunction(call: Call): AnyFunction | undefined {
  return find(call.expr);

  function find(expr: Expr): any {
    if (expr.kind === "PropRef") {
      return find(expr.expr)?.[expr.id];
    } else if (expr.kind === "Identifier") {
      return undefined;
    } else if (expr.kind === "Reference") {
      return expr.ref();
    } else {
      return undefined;
    }
  }
}
