import {
  FunctionlessNode,
  isArgument,
  isArrayBinding,
  isArrayLiteralExpr,
  isAwaitExpr,
  isBigIntExpr,
  isBinaryExpr,
  isBindingElem,
  isBlockStmt,
  isBooleanLiteralExpr,
  isBreakStmt,
  isCallExpr,
  isCaseClause,
  isCatchClause,
  isClassDecl,
  isClassExpr,
  isClassStaticBlockDecl,
  isComputedPropertyNameExpr,
  isConditionExpr,
  isConstructorDecl,
  isContinueStmt,
  isDebuggerStmt,
  isDefaultClause,
  isDeleteExpr,
  isDoStmt,
  isElementAccessExpr,
  isEmptyStmt,
  isErr,
  isExprStmt,
  isForInStmt,
  isForOfStmt,
  isForStmt,
  isFunctionLike,
  isGetAccessorDecl,
  isIdentifier,
  isIfStmt,
  isImportKeyword,
  isLabelledStmt,
  isMethodDecl,
  isNewExpr,
  isNoSubstitutionTemplateLiteral,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectBinding,
  isObjectLiteralExpr,
  isOmittedExpr,
  isParameterDecl,
  isParenthesizedExpr,
  isPostfixUnaryExpr,
  isPrivateIdentifier,
  isPropAccessExpr,
  isPropAssignExpr,
  isPropDecl,
  isReferenceExpr,
  isRegexExpr,
  isReturnStmt,
  isSetAccessorDecl,
  isSpreadAssignExpr,
  isSpreadElementExpr,
  isStringLiteralExpr,
  isSuperKeyword,
  isSwitchStmt,
  isTaggedTemplateExpr,
  isTemplateExpr,
  isTemplateHead,
  isTemplateMiddle,
  isTemplateSpan,
  isTemplateTail,
  isThisExpr,
  isThrowStmt,
  isTryStmt,
  isTypeOfExpr,
  isUnaryExpr,
  isUndefinedLiteralExpr,
  isVariableDecl,
  isVariableDeclList,
  isVariableStmt,
  isVoidExpr,
  isWhileStmt,
  isWithStmt,
  isYieldExpr,
} from "@functionless/ast";
import { assertNever } from "@functionless/util";
import { SynthError, ErrorCodes } from "@functionless/error-code";

/**
 * Formats a stateName given a statement.
 *
 * If a different node is used to supply the name (ex: a block uses it's first statement) then that node is returned.
 *
 * @returns [state name, optionally updated cache key (node)]
 */
export function toStateName(node?: FunctionlessNode): string {
  /**
   * Special case that updates the statement used (cache key)
   */
  if (!node) {
    return "";
  } else if (isBlockStmt(node)) {
    if (node.isFinallyBlock()) {
      return "finally";
    } else {
      const step = node.step();
      return step ? toStateName(step) : "<block>";
    }
  } else if (isIfStmt(node)) {
    return `if(${toStateName(node.when)})`;
  } else if (isExprStmt(node)) {
    return toStateName(node.expr);
  } else if (isBreakStmt(node)) {
    return "break";
  } else if (isContinueStmt(node)) {
    return "continue";
  } else if (isCatchClause(node)) {
    return `catch${
      node.variableDecl ? `(${toStateName(node.variableDecl)})` : ""
    }`;
  } else if (isDoStmt(node)) {
    return `while (${toStateName(node.condition)})`;
  } else if (isForInStmt(node)) {
    return `for(${
      isIdentifier(node.initializer)
        ? toStateName(node.initializer)
        : isVariableDeclList(node.initializer)
        ? toStateName(node.initializer.decls[0]!.name)
        : toStateName(node.initializer)
    } in ${toStateName(node.expr)})`;
  } else if (isForOfStmt(node)) {
    return `for(${toStateName(node.initializer)} of ${toStateName(node.expr)})`;
  } else if (isForStmt(node)) {
    // for(;;)
    return `for(${
      node.initializer && isVariableDeclList(node.initializer)
        ? toStateName(node.initializer)
        : toStateName(node.initializer)
    };${toStateName(node.condition)};${toStateName(node.incrementor)})`;
  } else if (isReturnStmt(node)) {
    if (node.expr) {
      return `return ${toStateName(node.expr)}`;
    } else {
      return "return";
    }
  } else if (isThrowStmt(node)) {
    return `throw ${toStateName(node.expr)}`;
  } else if (isTryStmt(node)) {
    return "try";
  } else if (isVariableStmt(node)) {
    return toStateName(node.declList);
  } else if (isVariableDeclList(node)) {
    return `${node.decls.map((v) => toStateName(v)).join(",")}`;
  } else if (isVariableDecl(node)) {
    return node.initializer
      ? `${toStateName(node.name)} = ${toStateName(node.initializer)}`
      : toStateName(node.name);
  } else if (isWhileStmt(node)) {
    return `while (${toStateName(node.condition)})`;
  } else if (isBindingElem(node)) {
    const binding = node.propertyName
      ? `${toStateName(node.propertyName)}: ${toStateName(node.name)}`
      : `${toStateName(node.name)}`;
    return node.initializer
      ? `${binding} = ${toStateName(node.initializer)}`
      : binding;
  } else if (isObjectBinding(node)) {
    return `{ ${node.bindings.map(toStateName).join(", ")} }`;
  } else if (isArrayBinding(node)) {
    return `[ ${node.bindings
      .map((b) => (!b ? "" : toStateName(b)))
      .join(", ")} ]`;
  } else if (isFunctionLike(node)) {
    return `function (${node.parameters.map(toStateName).join(",")})`;
  } else if (isParameterDecl(node)) {
    return toStateName(node.name);
  } else if (isErr(node)) {
    throw node.error;
  } else if (isEmptyStmt(node)) {
    return ";";
  } else if (isTemplateHead(node)) {
    return node.text;
  } else if (isTemplateMiddle(node)) {
    return node.text;
  } else if (isTemplateTail(node)) {
    return node.text;
  } else if (isTemplateSpan(node)) {
    return `${toStateName(node.literal)}${toStateName(node.expr)}`;
  } else if (isArgument(node)) {
    return toStateName(node.expr);
  } else if (isArrayLiteralExpr(node)) {
    return `[${node.items
      .map((item) => (item ? toStateName(item) : "null"))
      .join(", ")}]`;
  } else if (isBigIntExpr(node)) {
    return node.value.toString(10);
  } else if (isBinaryExpr(node)) {
    return `${toStateName(node.left)} ${node.op} ${toStateName(node.right)}`;
  } else if (isBooleanLiteralExpr(node)) {
    return `${node.value}`;
  } else if (isCallExpr(node) || isNewExpr(node)) {
    if (isImportKeyword(node.expr)) {
      throw new Error(`calling ${node.expr.kindName} is unsupported in ASL`);
    }
    return `${isNewExpr(node) ? "new " : ""}${toStateName(
      node.expr
    )}(${node.args
      // Assume that undefined args are in order.
      .filter((arg) => arg && !isUndefinedLiteralExpr(arg))
      .map(toStateName)
      .join(", ")})`;
  } else if (isConditionExpr(node)) {
    return `if(${toStateName(node.when)})`;
  } else if (isComputedPropertyNameExpr(node)) {
    return `[${toStateName(node.expr)}]`;
  } else if (isElementAccessExpr(node)) {
    return `${toStateName(node.expr)}[${toStateName(node.element)}]`;
  } else if (isIdentifier(node)) {
    return node.name;
  } else if (isNullLiteralExpr(node)) {
    return "null";
  } else if (isNumberLiteralExpr(node)) {
    return `${node.value}`;
  } else if (isObjectLiteralExpr(node)) {
    return `{${node.properties
      .map((prop) => {
        if (
          isSetAccessorDecl(prop) ||
          isGetAccessorDecl(prop) ||
          isMethodDecl(prop)
        ) {
          throw new SynthError(
            ErrorCodes.Unsupported_Feature,
            `${prop.kindName} is not supported by Step Functions`
          );
        }
        return toStateName(prop);
      })
      .join(", ")}}`;
  } else if (isPropAccessExpr(node)) {
    return `${toStateName(node.expr)}.${node.name.name}`;
  } else if (isPropAssignExpr(node)) {
    return `${
      isIdentifier(node.name) || isPrivateIdentifier(node.name)
        ? node.name.name
        : isStringLiteralExpr(node.name)
        ? node.name.value
        : isNumberLiteralExpr(node.name)
        ? node.name.value
        : isComputedPropertyNameExpr(node.name)
        ? isStringLiteralExpr(node.name.expr)
          ? node.name.expr.value
          : toStateName(node.name.expr)
        : assertNever(node.name)
    }: ${toStateName(node.expr)}`;
  } else if (isReferenceExpr(node)) {
    return node.name;
  } else if (isSpreadAssignExpr(node)) {
    return `...${toStateName(node.expr)}`;
  } else if (isSpreadElementExpr(node)) {
    return `...${toStateName(node.expr)}`;
  } else if (isStringLiteralExpr(node)) {
    return `"${node.value}"`;
  } else if (isTemplateExpr(node)) {
    return `${toStateName(node.head)}${node.spans.map(toStateName).join("")}`;
  } else if (isNoSubstitutionTemplateLiteral(node)) {
    return `\`${node.text}\``;
  } else if (isTypeOfExpr(node)) {
    return `typeof ${toStateName(node.expr)}`;
  } else if (isUnaryExpr(node)) {
    return `${node.op}${toStateName(node.expr)}`;
  } else if (isPostfixUnaryExpr(node)) {
    return `${toStateName(node.expr)}${node.op}`;
  } else if (isUndefinedLiteralExpr(node)) {
    return "undefined";
  } else if (isAwaitExpr(node)) {
    return `await ${toStateName(node.expr)}`;
  } else if (isThisExpr(node)) {
    return "this";
  } else if (isClassExpr(node)) {
    throw new SynthError(
      ErrorCodes.Unsupported_Feature,
      `ClassDecl is not supported in StepFunctions`
    );
  } else if (isPrivateIdentifier(node)) {
    return node.name;
  } else if (isYieldExpr(node)) {
    return `yield${node.delegate ? "*" : ""} ${toStateName(node.expr)}`;
  } else if (isRegexExpr(node)) {
    return node.regex.source;
  } else if (isDeleteExpr(node)) {
    return `delete ${toStateName(node.expr)}`;
  } else if (isVoidExpr(node)) {
    return `void ${toStateName(node.expr)}`;
  } else if (isParenthesizedExpr(node)) {
    return toStateName(node.expr);
  } else if (isTaggedTemplateExpr(node)) {
    throw new SynthError(
      ErrorCodes.Unsupported_Feature,
      `${node.kindName} is not supported by Step Functions`
    );
  } else if (isOmittedExpr(node)) {
    return "";
  } else if (
    isCaseClause(node) ||
    isClassDecl(node) ||
    isClassStaticBlockDecl(node) ||
    isConstructorDecl(node) ||
    isDebuggerStmt(node) ||
    isDefaultClause(node) ||
    isGetAccessorDecl(node) ||
    isImportKeyword(node) ||
    isLabelledStmt(node) ||
    isMethodDecl(node) ||
    isPropDecl(node) ||
    isSetAccessorDecl(node) ||
    isSuperKeyword(node) ||
    isSwitchStmt(node) ||
    isWithStmt(node) ||
    isYieldExpr(node)
  ) {
    throw new SynthError(
      ErrorCodes.Unsupported_Feature,
      `Unsupported kind: ${node.kindName}`
    );
  }
  return assertNever(node);
}
