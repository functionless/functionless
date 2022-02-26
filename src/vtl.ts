import { AnyFunction } from "./function";
import { Call, Expr } from "./expression";
import { isLambda } from "./function";
import { lookupIdentifier } from "./analysis";

export interface VTLContext {
  depth: number;
  generateUniqueName(): string;
}

function increment(context: VTLContext): VTLContext {
  return {
    ...context,
    depth: context.depth + 1,
  };
}

export function synthVTL(expr: Expr, context: VTLContext): string {
  if (expr.kind === "Call") {
    const serviceCall = findFunction(expr);
    if (serviceCall) {
      return serviceCall(expr, context);
    } else {
      return `${synthVTL(expr.expr, context)}(${Object.values(expr.args)
        .map((arg) => synthVTL(arg, context))
        .join(", ")})`;
    }
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
    const left = synthVTL(expr.expr, context);
    return `${left}.${expr.id}`;
  } else if (expr.kind === "NullLiteral") {
    return "$null";
  } else if (expr.kind === "BooleanLiteral") {
    return `${expr.value}`;
  } else if (expr.kind === "NumberLiteral") {
    return `${expr.value}`;
  } else if (expr.kind === "StringLiteral") {
    return `"${expr.value}"`;
  } else if (expr.kind === "VariableDecl") {
    return `#set( $context.stash.${expr.name} = ${synthVTL(
      expr.expr,
      context
    )} )`;
  } else if (expr.kind === "Binary") {
    return `${synthVTL(expr.left, context)} ${expr.op} ${synthVTL(
      expr.right,
      context
    )}`;
  } else if (expr.kind === "Unary") {
    return `${expr.op} ${synthVTL(expr.expr, context)}`;
  } else if (expr.kind === "Block") {
    return expr.exprs
      .map((expr) => synthVTL(expr, increment(context)))
      .join("\n");
  } else if (expr.kind === "FunctionDecl") {
    // ?
  } else if (expr.kind === "Condition") {
    return (
      (expr.parent?.kind === "Condition"
        ? // nested else-if, don't prepend #
          ""
        : // this is the first expr in the if-chain
          "#") +
      `if( ${synthVTL(expr.when, context)} )` +
      synthVTL(expr.then, increment(context)) +
      (expr._else?.kind === "Condition"
        ? `#else${synthVTL(expr._else, increment(context))}`
        : expr._else
        ? `#else ${synthVTL(expr._else, increment(context))} #end`
        : "#end")
    );
  } else if (expr.kind === "Map") {
    // TODO
  } else if (expr.kind === "ObjectLiteral") {
    if (Array.isArray(expr.properties)) {
      const properties = expr.properties.map((prop) =>
        synthVTL(prop, increment(context))
      );
      return `{\n${properties.join(`,\n `)}\n}`;
    } else {
      throw new Error("not implemented");
    }
  } else if (expr.kind === "PropertyAssignment") {
    return `"${expr.name}": ${$toJson(synthVTL(expr.expr, context))}`;
  } else if (expr.kind === "SpreadAssignment") {
    const mustStash =
      expr.expr.kind === "Identifier" || expr.expr.kind === "PropRef";
    const varName = mustStash
      ? synthVTL(expr.expr, context)
      : context.generateUniqueName();
    return `${
      mustStash ? "" : `#set( $${varName} = ${synthVTL(expr.expr, context)} )`
    }
#foreach( $key in ${$(varName)}.keySet() )
  "$key": $util.toJson(${$(varName)}.get($key))#if( $foreach.hasNext ),#end
#end`;
  } else if (expr.kind === "Reference") {
    const ref = expr.ref();
    // inject the ARN as a string into the template
    return `"${
      isLambda(ref) ? ref.resource.functionArn : ref.resource.tableArn
    }"`;
  } else if (expr.kind === "Return") {
    return `
#set($context.stash.return__flag = true)
#set($context.stash.return__val = ${synthVTL(expr.expr, context)})
#return($context.stash.return__val)`;
  }

  throw new Error(`cannot synthesize '${expr.kind}' expression to VTL`);
}

// https://velocity.apache.org/engine/devel/user-guide.html#conditionals
// https://cwiki.apache.org/confluence/display/VELOCITY/CheckingForNull
// https://velocity.apache.org/engine/devel/user-guide.html#set

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

export function $toJson(expr: string): string {
  if (expr.startsWith("$")) {
    return `$util.toJson(${expr})`;
  } else {
    return expr;
  }
}

export function $(varName: string): string {
  if (varName.startsWith("$")) {
    return varName;
  } else {
    return `$${varName}`;
  }
}
