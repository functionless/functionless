import { AnyFunction } from "./function";
import { Call, Expr } from "./expression";
import { isLambda } from "./lambda";
import { indent, lookupIdentifier } from "./util";

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

export function toVTL(expr: Expr, context: VTLContext): string {
  if (expr.kind === "Call") {
    const serviceCall = findFunction(expr);
    if (serviceCall) {
      return serviceCall(expr, context);
    } else {
      return `${toVTL(expr.expr, context)}(${Object.values(expr.args)
        .map((arg) => toVTL(arg, context))
        .join(", ")})`;
    }
  } else if (expr.kind === "Identifier") {
    if (expr.name.startsWith("$")) {
      return expr.name;
    }

    const ref = lookupIdentifier(expr);
    if (ref?.kind === "VariableDecl") {
      return `$context.stash.${expr.name}`;
    } else if (ref?.kind === "FunctionDecl") {
    }
    // determine is a stash or local variable
    return expr.name;
  } else if (expr.kind === "PropRef") {
    const left = toVTL(expr.expr, context);
    return `${left}.${expr.id}`;
  } else if (expr.kind === "NullLiteral") {
    return "null";
  } else if (expr.kind === "BooleanLiteral") {
    return `${expr.value}`;
  } else if (expr.kind === "NumberLiteral") {
    return `${expr.value}`;
  } else if (expr.kind === "StringLiteral") {
    return `"${expr.value}"`;
  } else if (expr.kind === "VariableDecl") {
    return `#set( $context.stash.${expr.name} = ${toVTL(expr.expr, context)} )`;
  } else if (expr.kind === "Binary") {
    return `${toVTL(expr.left, context)} ${expr.op} ${toVTL(
      expr.right,
      context
    )}`;
  } else if (expr.kind === "Unary") {
    return `${expr.op}${toVTL(expr.expr, context)}`;
  } else if (expr.kind === "Block") {
    return expr.exprs
      .map((expr) => toVTL(expr, increment(context)))
      .join(indent(context.depth + 1));
  } else if (expr.kind === "FunctionDecl") {
    // ?
  } else if (expr.kind === "If") {
    return (
      (expr.parent?.kind === "If"
        ? // nested else-if, don't prepend #
          ""
        : // this is the first expr in the if-chain
          "#") +
      `if( ${toVTL(expr.when, context)} )` +
      toVTL(expr.then, increment(context)) +
      (expr._else?.kind === "If"
        ? `#else${toVTL(expr._else, increment(context))}`
        : expr._else
        ? `#else ${toVTL(expr._else, increment(context))} #end`
        : "#end")
    );
  } else if (expr.kind === "Map") {
    // ?
  } else if (expr.kind === "ObjectLiteral") {
    if (Array.isArray(expr.properties)) {
      const properties = expr.properties.map((prop) =>
        toVTL(prop, increment(context))
      );
      return `{\n  ${properties.join(`,\n  ${indent(context.depth + 1)}`)}\n}`;
    } else {
      throw new Error("not implemented");
    }
  } else if (expr.kind === "PropertyAssignment") {
    return `"${expr.name}": ${$toJson(toVTL(expr.expr, context))}`;
  } else if (expr.kind === "SpreadAssignment") {
    const mustStash =
      expr.expr.kind === "Identifier" || expr.expr.kind === "PropRef";
    const varName = mustStash
      ? toVTL(expr.expr, context)
      : context.generateUniqueName();
    return `${
      mustStash ? "" : `#set( $${varName} = ${toVTL(expr.expr, context)} )`
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
    return `#return(${toVTL(expr.expr, context)})`;
  }

  throw new Error(`cannot synthesize '${expr.kind}' expression to VTL`);
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
function $toJson(expr: string): string {
  if (expr.startsWith("$util")) {
    return expr;
  } else if (expr.startsWith("$")) {
    return `$util.toJson(${expr})`;
  } else {
    return expr;
  }
}

function $(varName: string): string {
  if (varName.startsWith("$")) {
    return varName;
  } else {
    return `$${varName}`;
  }
}
