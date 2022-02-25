import { AnyFunction } from "./function";
import { Call, Expr } from "./expression";
import { isLambda } from "./function";
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
    } else if (ref?.kind === "FunctionDecl") {
    }
    // determine is a stash or local variable
    return expr.name;
  } else if (expr.kind === "PropRef") {
    const left = synthVTL(expr.expr, context);
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
    return `${expr.op}${synthVTL(expr.expr, context)}`;
  } else if (expr.kind === "Block") {
    return expr.exprs
      .map((expr) => synthVTL(expr, increment(context)))
      .join(indent(context.depth + 1));
  } else if (expr.kind === "FunctionDecl") {
    // ?
  } else if (expr.kind === "Condition") {
    return (
      (expr.parent?.kind === "Condition"
        ? // nested else-if, don't prepend #
          ""
        : // this is the first expr in the if-chain
          "#") +
      `if( ${synthConditionExpr(expr.when, context)} )` +
      synthVTL(expr.then, increment(context)) +
      (expr._else?.kind === "Condition"
        ? `#else${synthVTL(expr._else, increment(context))}`
        : expr._else
        ? `#else ${synthVTL(expr._else, increment(context))} #end`
        : "#end")
    );
  } else if (expr.kind === "Map") {
    // ?
  } else if (expr.kind === "ObjectLiteral") {
    if (Array.isArray(expr.properties)) {
      const properties = expr.properties.map((prop) =>
        synthVTL(prop, increment(context))
      );
      return `{\n  ${properties.join(`,\n  ${indent(context.depth + 1)}`)}\n}`;
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
    if (expr.expr.kind === "NullLiteral") {
      return `#return`;
    } else {
      return `#return(${synthVTL(expr.expr, context)})`;
    }
  }

  throw new Error(`cannot synthesize '${expr.kind}' expression to VTL`);
}

// export function synthCondition(cond: Condition, context: VTLContext): string {
//   return "";
// }

export function synthConditionExpr(expr: Expr, context: VTLContext): string {
  if (
    expr.kind === "Identifier" ||
    expr.kind === "PropRef" ||
    expr.kind === "Call"
  ) {
    if (expr.parent?.kind === "Condition") {
      // truthy
      // https://cwiki.apache.org/confluence/display/VELOCITY/CheckingForNull
    }
    return synthVTL(expr, context);
  } else if (expr.kind === "NullLiteral") {
    return `""`;
  } else if (expr.kind === "Binary") {
  } else if (expr.kind === "Unary") {
  }
  return synthVTL(expr, context);
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
