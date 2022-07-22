import {
  BindingElem,
  BindingPattern,
  Decl,
  ParameterDecl,
  VariableDecl,
  VariableDeclList,
} from "./declaration";
import type { Err } from "./error";
import { Expr } from "./expression";
import {
  isBlockStmt,
  isTryStmt,
  isVariableStmt,
  isDoStmt,
  isWhileStmt,
  isFunctionExpr,
  isFunctionDecl,
  isForInStmt,
  isForOfStmt,
  isReturnStmt,
  isThrowStmt,
  isIfStmt,
  isCatchClause,
  isBindingPattern,
  isBindingElem,
  isIdentifier,
  isVariableDecl,
} from "./guards";
import { BlockStmt, CatchClause, Stmt } from "./statement";

export type FunctionlessNode =
  | Decl
  | Expr
  | Stmt
  | Err
  | BindingPattern
  | VariableDeclList;

export interface HasParent<Parent extends FunctionlessNode> {
  get parent(): Parent;
  set parent(parent: Parent);
}

export abstract class BaseNode<
  Kind extends FunctionlessNode["kind"],
  Parent extends FunctionlessNode | undefined = FunctionlessNode | undefined
> {
  abstract readonly nodeKind: "Err" | "Expr" | "Stmt" | "Decl" | "Node";

  // @ts-ignore
  parent: Parent;

  /**
   * The immediate Child nodes contained within this Node.
   */
  readonly children: FunctionlessNode[] = [];

  constructor(readonly kind: Kind) {}

  public abstract clone(): this;

  public setParent(parent: FunctionlessNode | undefined) {
    this.parent = parent as Parent;
    if (parent) {
      parent.children.push(this as unknown as FunctionlessNode);
    }
  }

  public as<K extends FunctionlessNode["kind"]>(
    kind: K
  ): Extract<this, { kind: K }> {
    // @ts-ignore
    if (this.kind !== kind) {
      throw new Error(`expected to be a ${kind} but was ${this.kind}`);
    }
    return this as any;
  }

  public is<N extends this>(is: (node: this) => node is N): this is N {
    return is(this);
  }

  public findChildren<N extends FunctionlessNode>(
    is: (node: FunctionlessNode) => node is N
  ): N[] {
    return this.children.filter(is);
  }

  public collectChildren<T>(f: (node: FunctionlessNode) => T[]): T[] {
    return this.children.reduce(
      (nodes: T[], child) => [...nodes, ...f(child)],
      []
    );
  }

  public findParent<N extends FunctionlessNode>(
    is: (node: FunctionlessNode) => node is N
  ): N | undefined {
    if (this.parent === undefined) {
      return undefined;
    } else if (is(this.parent)) {
      return this.parent;
    } else {
      return this.parent.findParent(is);
    }
  }

  public hasOnlyAncestors(
    cont: (node: FunctionlessNode) => boolean,
    stop?: (node: FunctionlessNode) => boolean
  ): boolean {
    if (!this.parent) {
      return true;
    } else if (stop && stop(this.parent)) {
      return true;
    } else if (!cont(this.parent)) {
      return false;
    }
    return this.parent.hasOnlyAncestors(cont, stop);
  }

  /**
   * Finds the {@link CatchClause} that this Node should throw to.
   */
  public findCatchClause(): CatchClause | undefined {
    if (isBlockStmt(this) && (this as unknown as BlockStmt).isFinallyBlock()) {
      return this.parent!.findCatchClause();
    }
    const scope = this.parent;
    if (scope === undefined) {
      return undefined;
    } else if (isTryStmt(scope)) {
      return scope.catchClause;
    } else if (isCatchClause(scope)) {
      // skip the try-block
      return scope.parent.findCatchClause();
    } else if (isBlockStmt(scope) && scope.isFinallyBlock()) {
      // skip the finally block
      return scope.parent.findCatchClause();
    } else {
      return scope.findCatchClause();
    }
  }

  public contains(node: FunctionlessNode, alg: "dfs" | "bfs" = "dfs"): boolean {
    if (alg === "dfs") {
      // depth-first search
      for (const child of this.children) {
        if (child === node) {
          return true;
        } else if (child.contains(node, alg)) {
          return true;
        }
      }
      return false;
    } else {
      // breadth-first search
      for (const child of this.children) {
        if (child === node) {
          return true;
        }
      }
      for (const child of this.children) {
        if (child.contains(node, alg)) {
          return true;
        }
      }
      return false;
    }
  }

  /**
   * @returns the {@link Stmt} that will be run immediately after this Node.
   */
  public step(): Stmt | undefined {
    const self = this as unknown as FunctionlessNode;

    if (isTryStmt(self)) {
      return self.tryBlock.step();
    } else if (isBlockStmt(self)) {
      if (self.isEmpty()) {
        return self.exit();
      } else {
        return self.firstStmt?.step();
      }
    } else if (isCatchClause(self)) {
      if (self.variableDecl) {
        return self.variableDecl.step();
      } else {
        return self.block.step();
      }
    } else if (isVariableStmt(self)) {
      if (self.next) {
        return self.next.step();
      } else {
        return self.exit();
      }
    } else if (isDoStmt(self)) {
      return self.block.step();
    } else if (self.nodeKind === "Stmt") {
      return self;
    } else {
      // is an Expr
      return self.exit();
    }
  }

  /**
   * @returns the {@link Stmt} that will be run after exiting the scope of this Node.
   */
  public exit(): Stmt | undefined {
    const node = this as unknown as FunctionlessNode;
    if (node.nodeKind === "Stmt" && node.next) {
      return node.next.step();
    }
    const scope = node.parent;
    if (scope === undefined) {
      return undefined;
    } else if (isWhileStmt(scope)) {
      return scope;
    } else if (isTryStmt(scope)) {
      if (scope.tryBlock === node || scope.catchClause === node) {
        if (scope.finallyBlock) {
          return scope.finallyBlock.step();
        } else {
          return scope.exit();
        }
      } else if (scope.finallyBlock === node) {
        // stepping out of the finallyBlock
        if (scope.next) {
          return scope.next.step();
        } else {
          return scope.exit();
        }
      }
    } else if (isCatchClause(scope)) {
      if (scope.parent.finallyBlock) {
        return scope.parent.finallyBlock.step();
      } else {
        return scope.parent.exit();
      }
    } else if (scope.nodeKind === "Stmt" && scope.next) {
      return scope.next.step();
    } else if (scope.nodeKind === "Expr") {
      return scope.parent?.step();
    }
    return scope.exit();
  }

  /**
   * @returns the {@link Stmt} that will be run if an error was raised from this Node.
   */
  public throw(): CatchClause | BlockStmt | undefined {
    // CatchClause that will handle the error
    const catchClause = this.findCatchClause();

    // CatchClause that contains the Node that is raising the error
    const surroundingCatch = this.findParent(isCatchClause);

    if (catchClause) {
      if (
        surroundingCatch &&
        // we're within a catch with a finally interception block
        surroundingCatch.parent.finallyBlock &&
        /*
         try {
           try {
           } catch {
             // error is happening within the nested catch block
             throw new Error("")
           } finally {
             // and there is a finally block which intercepts the error - goto here
             return "intercepted";
           }
         } catch {
           // so don't goto here
         }
         */
        catchClause.parent.tryBlock.contains(surroundingCatch)
      ) {
        // finally block intercepts the thrown error
        return surroundingCatch.parent.finallyBlock;
      }
    } else if (surroundingCatch?.parent.finallyBlock) {
      // there is no catch handler for this error, but there is a surrounding finally block to intercept us
      /*
      try {
      } catch {
        // error thrown with a catch
        throw new Error("")
      } finally {
        // and intercepted by this finally block
        return "intercepted";
      }
      */
      return surroundingCatch.parent.finallyBlock;
    }
    // default behavior is to use the catchClause to handle (if one exists)
    // otherwise return `undefined` - signalling that the error is terminal
    return catchClause;
  }

  /**
   * @returns an array of all the visible names in this node's scope.
   */
  public getVisibleNames(): string[] {
    return Array.from(this.getLexicalScope().keys());
  }

  /**
   * @returns a mapping of name to the node visible in this node's scope.
   */
  public getLexicalScope(): Map<string, Decl> {
    return new Map(getLexicalScope(this as unknown as FunctionlessNode));

    type Binding = [string, VariableDecl | ParameterDecl | BindingElem];

    function getLexicalScope(node: FunctionlessNode | undefined): Binding[] {
      if (node === undefined) {
        return [];
      }
      return getLexicalScope(
        node.nodeKind === "Stmt" && node.prev ? node.prev : node.parent
      ).concat(getNames(node));
    }

    function getNames(node: FunctionlessNode | undefined): Binding[] {
      if (node === undefined) {
        return [];
      } else if (isVariableStmt(node)) {
        return node.declList.decls.flatMap(getNames);
      } else if (isVariableDecl(node)) {
        if (isBindingPattern(node.name)) {
          return getNames(node.name);
        }
        return [[node.name, node]];
      } else if (isBindingElem(node)) {
        if (isIdentifier(node.name)) {
          return [[node.name.name, node]];
        }
        return getNames(node.name);
      } else if (isBindingPattern(node)) {
        return node.bindings.flatMap((b) => getNames(b));
      } else if (isFunctionExpr(node) || isFunctionDecl(node)) {
        return node.parameters.flatMap((param) =>
          typeof param.name === "string"
            ? [[param.name, param]]
            : getNames(param.name)
        );
      } else if (isForInStmt(node) || isForOfStmt(node)) {
        return getNames(node.variableDecl);
      } else if (isCatchClause(node) && node.variableDecl?.name) {
        return getNames(node.variableDecl);
      } else {
        return [];
      }
    }
  }

  /**
   * @returns checks if this Node is terminal - meaning all branches explicitly return a value
   */
  public isTerminal(): boolean {
    const stmt: FunctionlessNode = this as any;
    if (isReturnStmt(stmt) || isThrowStmt(stmt)) {
      return true;
    } else if (isTryStmt(stmt)) {
      if (stmt.finallyBlock) {
        return (
          stmt.finallyBlock.isTerminal() ||
          (!!stmt.catchClause &&
            stmt.tryBlock.isTerminal() &&
            stmt.catchClause.block.isTerminal())
        );
      } else {
        return (
          stmt.tryBlock.isTerminal() && stmt.catchClause!.block.isTerminal()
        );
      }
    } else if (isBlockStmt(stmt)) {
      if (stmt.isEmpty()) {
        return false;
      } else {
        return stmt.lastStmt!.isTerminal();
      }
    } else if (isIfStmt(stmt)) {
      return (
        stmt.then.isTerminal() &&
        stmt._else !== undefined &&
        stmt._else.isTerminal()
      );
    } else {
      return false;
    }
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
