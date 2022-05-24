import { assertNever, assertNodeKind } from "./assert";
import {
  CallExpr,
  Expr,
  FunctionExpr,
  isIdentifier,
  PropAccessExpr,
} from "./expression";
import { findIntegration } from "./integration";
import { FunctionlessNode } from "./node";
import { Stmt } from "./statement";
import { isInTopLevelScope } from "./util";

// https://velocity.apache.org/engine/devel/user-guide.html#conditionals
// https://cwiki.apache.org/confluence/display/VELOCITY/CheckingForNull
// https://velocity.apache.org/engine/devel/user-guide.html#set

export function isVTL(a: any): a is VTL {
  return (a as VTL | undefined)?.kind === VTL.ContextName;
}

/**
 * Props to control the evaluation of the AST.
 */
interface EvalProps {
  returnVar?: string;
  handlingInputParamAccess?: boolean;
}

/**
 * Base class for interpreting the Functionless AST to VTL.
 *
 * AppSync and API Gateway run different VTL engines with different
 * capabilities. We reuse as much of the logic as we can and provide
 * stubs for implementing classes to override what they need to.
 */
export abstract class VTL {
  static readonly ContextName = "Velocity Template";

  readonly kind = VTL.ContextName;

  private readonly statements: string[] = [];

  private varIt = 0;

  constructor(...statements: string[]) {
    this.statements.push(...statements);
  }

  /**
   * Name of a variable on the stash. Prefixes with the VTL engines stash name.
   * @param name Name of the variable.
   */
  public abstract stashVariableName(name: string): string;
  /**
   * Evaluate an expression quietly i.e. without outputting to the VTL result.
   * @param expr Expr to evaluate.
   */
  public abstract quiet(expr: string): void;
  /**
   * Return the value of the expression.
   * @param expr Expr to evaluate and return.
   */
  public abstract return(expr: string | Expr): void;
  /**
   * Output a variable as JSON.
   * @param reference Name of the variable to JSONify.
   */
  public abstract json(reference: string): string;
  /**
   * Handle a PropAccessExpr descended from the functions input parameter.
   * e.g. `input.arguments.baz` descends from `input` in `function(input: AppsyncContext<...>) { ... }`.
   * We need to handle this by referencing the input to the mapping template for each
   * service e.g. the above needs to be turned into `$context.arguments.baz` in AppSync.
   * @param node The PropAccessExpr to handle.
   */
  public abstract inputParamAccess(node: PropAccessExpr): string;

  public toVTL(): string {
    return this.statements.join("\n");
  }

  public add(...statements: string[]) {
    this.statements.push(...statements);
  }

  private newLocalVarName() {
    return `$v${(this.varIt += 1)}`;
  }

  public str(value: string) {
    return `'${value}'`;
  }

  /**
   * Add a statement which sets the variable {@link reference} to the value of the {@link expr}.
   *
   * @param reference the name of the variable to set
   * @param expr the value to set the variable to
   */
  public set(reference: string, expr: Expr | string): string {
    this.add(
      `#set(${reference} = ${
        typeof expr === "string" ? expr : this.eval(expr)
      })`
    );
    return reference;
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
   * The put method on an object.
   *
   * $var.put("name", "value")
   *
   * @param objVar should be a variable referencing an object.
   * @param name should be a quoted string or variable that represents the name to set in the object
   * @param expr should be a quoted string or a variable that represents the value to set
   */
  public put(objVar: string, name: string, expr: string | Expr) {
    this.quiet(
      `${objVar}.put(${name}, ${
        typeof expr === "string" ? expr : this.eval(expr)
      })`
    );
  }

  /**
   * The putAll method on an object.
   *
   * $var.putAll($otherObj)
   *
   * @param objVar should be a variable referencing an object.
   * @param expr should be a variable that represents an object to merge with the expression
   */
  public putAll(objVar: string, expr: Expr) {
    this.quiet(`${objVar}.putAll(${this.eval(expr)})`);
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
   * Evaluate an {@link Expr} or {@link Stmt} by emitting statements to this VTL template and
   * return a variable reference to the evaluated value.
   *
   * @param node the {@link Expr} or {@link Stmt} to evaluate.
   * @returns a variable reference to the evaluated value
   */
  public eval(node?: Expr, props?: EvalProps): string;
  public eval(node: Stmt, props?: EvalProps): void;
  public eval(node?: FunctionlessNode, props?: EvalProps): string | void {
    if (!node) {
      return "$null";
    }
    switch (node.kind) {
      case "ArrayLiteralExpr": {
        if (
          node.items.find((item) => item.kind === "SpreadElementExpr") ===
          undefined
        ) {
          return `[${node.items.map((item) => this.eval(item)).join(", ")}]`;
        } else {
          // contains a spread, e.g. [...i], so we will store in a variable
          const list = this.var("[]");
          for (const item of node.items) {
            if (item.kind === "SpreadElementExpr") {
              this.quiet(`${list}.addAll(${this.eval(item.expr)})`);
            } else {
              // we use addAll because `list.push(item)` is pared as `list.push(...[item])`
              // - i.e. the compiler passes us an ArrayLiteralExpr even if there is one arg
              this.quiet(`${list}.add(${this.eval(item)})`);
            }
          }
          return list;
        }
      }
      case "BinaryExpr":
        // VTL fails to evaluate binary expressions inside an object put e.g. $obj.put('x', 1 + 1)
        // a workaround is to use a temp variable.
        return this.var(
          `${this.eval(node.left)} ${node.op} ${this.eval(node.right)}`
        );
      case "BlockStmt":
        for (const stmt of node.statements) {
          this.eval(stmt);
        }
        return undefined;
      case "BooleanLiteralExpr":
        return `${node.value}`;
      case "BreakStmt":
        return this.add("#break");
      case "CallExpr": {
        const serviceCall = findIntegration(node);
        if (serviceCall) {
          return serviceCall.appSyncVtl.request(node, this);
        } else if (
          // If the parent is a propAccessExpr
          node.expr.kind === "PropAccessExpr" &&
          (node.expr.name === "map" ||
            node.expr.name === "forEach" ||
            node.expr.name === "reduce")
        ) {
          if (node.expr.name === "map" || node.expr.name == "forEach") {
            // list.map(item => ..)
            // list.map((item, idx) => ..)
            // list.forEach(item => ..)
            // list.forEach((item, idx) => ..)
            const newList =
              node.expr.name === "map" ? this.var(`[]`) : undefined;

            const [value, index, array] = getMapForEachArgs(node);

            // Try to flatten any maps before this operation
            // returns the first variable to be used in the foreach of this operation (may be the `value`)
            const list = this.flattenListMapOperations(
              node.expr.expr,
              value,
              (firstVariable, list) => {
                this.add(`#foreach(${firstVariable} in ${list})`);
              },
              // If array is present, do not flatten the map, this option immediately evaluates the next expression
              !!array
            );

            // Render the body
            const tmp = this.renderMapOrForEachBody(
              node,
              list,
              // the return location will be generated
              undefined,
              index,
              array
            );

            // Add the final value to the array
            if (node.expr.name === "map") {
              this.quiet(`${newList}.add(${tmp})`);
            }

            this.add("#end");
            return newList ?? `$null`;
          } else if (node.expr.name === "reduce") {
            // list.reduce((result: string[], next) => [...result, next], []);
            // list.reduce((result, next) => [...result, next]);

            const fn = assertNodeKind<FunctionExpr>(
              node.getArgument("callbackfn")?.expr,
              "FunctionExpr"
            );
            const initialValue = node.getArgument("initialValue")?.expr;

            // (previousValue: string[], currentValue: string, currentIndex: number, array: string[])
            const previousValue = fn.parameters[0]?.name
              ? `$${fn.parameters[0].name}`
              : this.newLocalVarName();
            const currentValue = fn.parameters[1]?.name
              ? `$${fn.parameters[1].name}`
              : this.newLocalVarName();
            const currentIndex = fn.parameters[2]?.name
              ? `$${fn.parameters[2].name}`
              : undefined;
            const array = fn.parameters[3]?.name
              ? `$${fn.parameters[3].name}`
              : undefined;

            // create a new local variable name to hold the initial/previous value
            // this is because previousValue may not be unique and isn't contained within the loop
            const previousTmp = this.newLocalVarName();

            const list = this.flattenListMapOperations(
              node.expr.expr,
              currentValue,
              (firstVariable, list) => {
                if (initialValue !== undefined) {
                  this.set(previousTmp, initialValue);
                } else {
                  this.add(`#if(${list}.isEmpty())`);
                  this.add(
                    `$util.error('Reduce of empty array with no initial value')`
                  );
                  this.add(`#end`);
                }

                this.add(`#foreach(${firstVariable} in ${list})`);
              },
              // If array is present, do not flatten maps before the reduce, this option immediately evaluates the next expression
              !!array
            );

            if (currentIndex) {
              this.add(`#set(${currentIndex} = $foreach.index)`);
            }
            if (array) {
              this.add(`#set(${array} = ${list})`);
            }

            const body = () => {
              // set previousValue variable name to avoid remapping
              this.set(previousValue, previousTmp);
              const tmp = this.newLocalVarName();
              for (const stmt of fn.body.statements) {
                this.eval(stmt, { returnVar: tmp });
              }
              // set the previous temp to be used later
              this.set(previousTmp, `${tmp}`);

              this.add("#end");
            };

            if (initialValue === undefined) {
              this.add("#if($foreach.index == 0)");
              this.set(previousTmp, currentValue);
              this.add("#else");
              body();
              this.add("#end");
            } else {
              body();
            }

            return previousTmp;
          }
          // this is an array map, forEach, reduce call
        }
        return `${this.eval(node.expr)}(${Object.values(node.args)
          .map((arg) => this.eval(arg))
          .join(", ")})`;
      }
      case "ConditionExpr": {
        const val = this.newLocalVarName();
        this.add(`#if(${this.eval(node.when)})`);
        this.set(val, node.then);
        this.add("#else");
        this.set(val, node._else);
        this.add("#end");
        return val;
      }
      case "IfStmt": {
        this.add(`#if(${this.eval(node.when)})`);
        this.eval(node.then);
        if (node._else) {
          this.add("#else");
          this.eval(node._else);
        }
        this.add("#end");
        return undefined;
      }
      case "ExprStmt":
        return this.quiet(this.eval(node.expr));
      case "ForOfStmt":
      case "ForInStmt":
        this.add(
          `#foreach($${node.variableDecl.name} in ${this.eval(node.expr)}${
            node.kind === "ForInStmt" ? ".keySet()" : ""
          })`
        );
        this.eval(node.body);
        this.add(`#end`);
        return undefined;
      case "FunctionDecl":
        throw new Error(`cannot evaluate Expr kind: '${node.kind}'`);
      case "FunctionExpr":
        return this.eval(node.body);
      case "Identifier": {
        const ref = node.lookup();
        if (ref?.kind === "VariableStmt" && isInTopLevelScope(ref)) {
          return this.stashVariableName(node.name);
        }
        if (node.name.startsWith("$")) {
          return node.name;
        } else {
          return `$${node.name}`;
        }
      }
      case "NewExpr":
        throw new Error(`NewExpr is not supported by Velocity Templates`);
      case "PropAccessExpr": {
        let name = node.name;
        if (name === "push" && node.parent?.kind === "CallExpr") {
          // this is a push to an array, rename to 'addAll'
          // addAll because the var-args are converted to an ArrayLiteralExpr
          name = "addAll";
        }

        if (
          !props?.handlingInputParamAccess &&
          descendedFromFunctionParameter(node)
        ) {
          return this.inputParamAccess(node);
        }

        return `${this.eval(node.expr, props)}.${name}`;
      }
      case "ElementAccessExpr":
        return `${this.eval(node.expr)}[${this.eval(node.element)}]`;
      case "NullLiteralExpr":
      case "UndefinedLiteralExpr":
        return "$null";
      case "NumberLiteralExpr":
        return node.value.toString(10);
      case "ObjectLiteralExpr": {
        const obj = this.var("{}");
        for (const prop of node.properties) {
          if (prop.kind === "PropAssignExpr") {
            const name =
              prop.name.kind === "Identifier"
                ? this.str(prop.name.name)
                : this.eval(prop.name);
            this.put(obj, name, prop.expr);
          } else if (prop.kind === "SpreadAssignExpr") {
            this.putAll(obj, prop.expr);
          } else {
            assertNever(prop);
          }
        }
        return obj;
      }
      case "ComputedPropertyNameExpr":
        return this.eval(node.expr);
      case "ParameterDecl":
      case "PropAssignExpr":
      case "ReferenceExpr":
        throw new Error(`cannot evaluate Expr kind: '${node.kind}'`);
      case "ReturnStmt":
        if (props?.returnVar) {
          this.set(props.returnVar, node.expr ?? "$null");
        } else {
          this.set(this.stashVariableName("return__val"), node.expr ?? "$null");
          this.add(`#set(${this.stashVariableName("return__flag")} = true)`);
          this.return(this.stashVariableName("return__val"));
        }
        return undefined;
      case "SpreadAssignExpr":
      case "SpreadElementExpr":
        throw new Error(`cannot evaluate Expr kind: '${node.kind}'`);
      // handled as part of ObjectLiteral
      case "StringLiteralExpr":
        return this.str(node.value);
      case "TemplateExpr":
        return `"${node.exprs
          .map((expr) => {
            if (expr.kind === "StringLiteralExpr") {
              return expr.value;
            }
            const text = this.eval(expr, props);
            if (text.startsWith("$")) {
              return `\${${text.slice(1)}}`;
            } else {
              const varName = this.var(text);
              return `\${${varName.slice(1)}}`;
            }
          })
          .join("")}"`;
      case "UnaryExpr":
        // VTL fails to evaluate unary expressions inside an object put e.g. $obj.put('x', -$v1)
        // a workaround is to use a temp variable.
        // it also doesn't handle like - signs alone (e.g. - $v1) so we have to put a 0 in front
        // no such problem with ! signs though
        if (node.op === "-") {
          return this.var(`0 - ${this.eval(node.expr)}`);
        } else {
          return this.var(`${node.op}${this.eval(node.expr)}`);
        }
      case "VariableStmt":
        const varName = isInTopLevelScope(node)
          ? this.stashVariableName(node.name)
          : `$${node.name}`;

        if (node.expr) {
          return this.set(varName, node.expr);
        } else {
          return varName;
        }
      case "ThrowStmt":
        return `#throw(${this.eval(node.expr)})`;
      case "TryStmt":
      case "CatchClause":
      case "ContinueStmt":
      case "DoStmt":
      case "TypeOfExpr":
      case "WhileStmt":
        throw new Error(`${node.kind} is not yet supported in VTL`);
      case "Err":
        throw node.error;
      case "Argument":
        return this.eval(node.expr);
    }
  }

  /**
   * Adds the VTL required to execute the body of a single map or forEach.
   *
   * @param call the map or foreach to render
   * @param list the list to give to the `array` parameter, should be the same one used in the vtl foreach
   * @param returnVariable The variable to put the final map value into. If not provided, will be generated.
   *                       Should start with a '$'.
   * @param index The optional `index` variable name to add if present.
   *              Should start with a '$'.
   * @param array The optional `array` variable name to add if present.
   *              Should start with a '$'.
   * @returns The returnVariable or generated variable name.
   */
  private renderMapOrForEachBody(
    call: CallExpr,
    list: string,
    // Should start with $
    returnVariable?: string,
    index?: string,
    array?: string
  ) {
    if (index) {
      this.add(`#set(${index} = $foreach.index)`);
    }
    if (array) {
      this.add(`#set(${array} = ${list})`);
    }

    const fn = assertNodeKind<FunctionExpr>(
      call.getArgument("callbackfn")?.expr,
      "FunctionExpr"
    );

    const tmp = returnVariable ? returnVariable : this.newLocalVarName();

    for (const stmt of fn.body.statements) {
      this.eval(stmt, { returnVar: tmp });
    }

    return tmp;
  }

  /**
   * Recursively flattens map operations until a non-map or a map with `array` parameter is found.
   * Evaluates the expression after the last map.
   *
   * @param before a method which executes once the
   * @return [firstVariable, list variable, render function]
   */
  private flattenListMapOperations(
    expr: Expr,
    // Should start with $
    returnVariable: string,
    before: (firstVariable: string, list: string) => void,
    alwaysEvaluate?: boolean
  ): string {
    if (
      !alwaysEvaluate &&
      expr.kind === "CallExpr" &&
      expr.expr.kind === "PropAccessExpr" &&
      expr.expr.name === "map"
    ) {
      const [value, index, array] = getMapForEachArgs(expr);

      const next = expr.expr.expr;

      const list = this.flattenListMapOperations(
        next,
        value,
        before,
        // If we find array, the next expression should be evaluated.
        // A map which relies on `array` cannot be flattened further as the array will be inaccurate.
        !!array
      );

      this.renderMapOrForEachBody(expr, list, returnVariable, index, array);

      return list;
    }

    const list = this.eval(expr);

    before(returnVariable, list);

    // If the expression isn't a map, return the expression and return variable, render nothing
    return list;
  }
}

/**
 * Returns the [value, index, array] arguments if this CallExpr is a `forEach` or `map` call.
 */
const getMapForEachArgs = (call: CallExpr) => {
  const fn = assertNodeKind<FunctionExpr>(
    call.getArgument("callbackfn")?.expr,
    "FunctionExpr"
  );
  return fn.parameters.map((p) => (p.name ? `$${p.name}` : p.name));
};

/**
 * VTL interpreter for the AppSync VTL engine.
 */
export class AppsyncVTL extends VTL {
  public static readonly CircuitBreaker = `#if($context.stash.return__flag)
#return($context.stash.return__val)
#end`;

  // Appsync has an inbuilt stash on the $context object
  public stashVariableName(name: string): string {
    return `$context.stash.${name}`;
  }

  // Call the $util.qr utility
  public quiet(expr: string): void {
    this.add(`$util.qr(${expr})`);
  }

  // call the #return macro
  public return(expr: string | Expr): void {
    if (typeof expr === "string") {
      this.add(`#return(${expr})`);
    } else {
      return this.return(this.eval(expr));
    }
  }

  // Call the $util.toJson utility
  public json(reference: string): string {
    return `$util.toJson(${reference})`;
  }

  // Replace the first param with $context. Users can pass in whatever they want as the
  // AppsyncResolver function param name but it needs to be $context in the VTL.
  public inputParamAccess(node: PropAccessExpr): string {
    const param = this.eval(node, { handlingInputParamAccess: true });

    return `$context.${param.slice(param.indexOf(".") + 1)}`;
  }
}

/**
 * Does node represent a parameter of a function declaration?
 */
const isFunctionParameter = (node: FunctionlessNode) => {
  if (!isIdentifier(node)) return false;
  const ref = node.lookup();
  return ref?.kind === "ParameterDecl" && ref.parent?.kind === "FunctionDecl";
};

/**
 * Is node descended from a function function parameter?
 * e.g. `foo.bar.baz` is descended from function parameter `foo` in `function(foo: any) { ... }`
 */
const descendedFromFunctionParameter = (node: PropAccessExpr): boolean => {
  if (isFunctionParameter(node.expr)) return true;
  if (node.expr.kind === "PropAccessExpr")
    return descendedFromFunctionParameter(node.expr);
  return false;
};
