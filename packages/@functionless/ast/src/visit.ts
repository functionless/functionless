import {
  VariableDecl,
  VariableDeclKind,
  VariableDeclList,
} from "./declaration";
import { Expr, Identifier } from "./expression";
import { isNode } from "./guards";
import type { FunctionlessNode } from "./node";
import { getCtor } from "./node-ctor";

import { BlockStmt, Stmt, VariableStmt } from "./statement";

import "./node-clone";
import { DeterministicNameGenerator } from "./util";

/**
 * Visits each child of a Node using the supplied visitor, possibly returning a new Node of the same kind in its place.
 *
 * @param node The Node whose children will be visited.
 * @param visitor The callback used to visit each child.
 * @param context A lexical environment context for the visitor.
 */
export function visitEachChild<T extends FunctionlessNode>(
  node: T,
  visit: (
    node: FunctionlessNode
  ) => FunctionlessNode | FunctionlessNode[] | undefined
): T {
  const ctor = getCtor(node.kind);
  const [span, ...rest] = node._arguments;
  const args = rest.map((argument) => {
    if (argument === null || typeof argument !== "object") {
      // all primitives are simply returned as-is
      return argument;
    } else if (isNode(argument)) {
      const transformed = visit(argument);
      if (transformed === undefined || isNode(transformed)) {
        return transformed;
      } else {
        throw new Error(
          `cannot spread nodes into an argument taking a single ${argument.kindName} node`
        );
      }
    } else if (Array.isArray(argument)) {
      // is an Array of nodes
      return argument.flatMap((item) => {
        const transformed = visit(item as FunctionlessNode);
        if (transformed === undefined) {
          // the item was deleted, so remove it from the array
          return [];
        } else if (isNode(transformed)) {
          return [transformed];
        } else {
          // spread the nodes into the array
          return transformed;
        }
      });
    } else {
      return argument;
    }
  });

  return new ctor(span, ...args) as T;
}

/**
 * Walks each of the children in {@link node} and calls {@link visit}.
 *
 * If {@link visit} returns a truthy value, then walking is immediately terminated.
 *
 * @param node the node to walk children of
 * @param visit callback to call with each child node
 */
export function forEachChild(
  node: FunctionlessNode,
  visit: (node: FunctionlessNode) => any
): void {
  for (let i = 0; i < node._arguments.length; i++) {
    const argument = node._arguments[i];
    if (i === 0) {
      // the first argument is always a span, so skip visiting it
    } else if (argument === null || typeof argument !== "object") {
      // all primitives are simply returned as-is
    } else if (isNode(argument)) {
      if (visit(argument)) {
        // if a truthy value is returned from visit, terminate the walk
        return;
      }
    } else if (Array.isArray(argument)) {
      // is an Array of nodes
      for (const item of argument) {
        if (visit(item as FunctionlessNode)) {
          // if a truthy value is returned from visit, terminate the walk
          return;
        }
      }
    }
  }
}

/**
 * Like {@link visitEachChild} but it only visits the statements of a block.
 *
 * Provides the hoist function that allows hoisting expressions into variable statements above the current statement.
 */
export function visitBlock(
  block: BlockStmt,
  cb: (stmt: Stmt, hoist: (expr: Expr) => Expr) => Stmt,
  nameGenerator: DeterministicNameGenerator
): BlockStmt {
  return visitEachChild(block, (stmt) => {
    const nestedTasks: FunctionlessNode[] = [];
    function hoist(expr: Expr): Identifier {
      const id = new Identifier(expr.span, nameGenerator.generateOrGet(expr));
      const stmt = new VariableStmt(
        expr.span,
        new VariableDeclList(
          expr.span,
          [new VariableDecl(expr.span, id.clone(), expr.clone())],
          VariableDeclKind.Const
        )
      );
      nestedTasks.push(stmt);
      return id;
    }

    const updatedNode = cb(stmt as Stmt, hoist);

    return nestedTasks.length === 0
      ? updatedNode
      : [...nestedTasks, updatedNode];
  });
}

/**
 * Starting at the root, explore the children without processing until one or more start nodes are found.
 *
 * For each Start nodes, apply {@link visitEachChild} to it with the given callback.
 */
export function visitSpecificChildren<T extends FunctionlessNode>(
  root: T,
  starts: Expr[],
  cb: (
    node: FunctionlessNode
  ) => FunctionlessNode | FunctionlessNode[] | undefined
): T {
  return visitEachChild(root, function dive(expr: FunctionlessNode):
    | FunctionlessNode
    | FunctionlessNode[]
    | undefined {
    return starts.includes(expr as Expr)
      ? visitEachChild(expr, cb)
      : visitEachChild(expr, dive);
  });
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
