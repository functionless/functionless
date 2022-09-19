import type {
  BindingElem,
  BindingPattern,
  ClassDecl,
  Decl,
  FunctionDecl,
  ParameterDecl,
  VariableDecl,
  VariableDeclList,
} from "./declaration";
import {
  Assertion,
  AssertionToInstance,
  ensure,
  ensureArrayOf,
} from "./ensure";
import type { Err } from "./error";
import type {
  ClassExpr,
  Expr,
  FunctionExpr,
  ImportKeyword,
  SuperKeyword,
  TemplateHead,
  TemplateMiddle,
  TemplateSpan,
  TemplateTail,
} from "./expression";
import {
  isBindingElem,
  isBindingPattern,
  isBlockStmt,
  isCatchClause,
  isClassDecl,
  isClassExpr,
  isClassLike,
  isDoStmt,
  isForInStmt,
  isForOfStmt,
  isForStmt,
  isFunctionDecl,
  isFunctionExpr,
  isFunctionLike,
  isIdentifier,
  isIfStmt,
  isMethodDecl,
  isNode,
  isParameterDecl,
  isReturnStmt,
  isThrowStmt,
  isTryStmt,
  isVariableDecl,
  isVariableDeclList,
  isVariableStmt,
  isWhileStmt,
} from "./guards";
import type { NodeCtor } from "./node-ctor";
import { NodeKind, NodeKindName, getNodeKindName } from "./node-kind";
import type { Span } from "./span";
import type { BlockStmt, CatchClause, Stmt } from "./statement";

export type FunctionlessNode =
  | Decl
  | Expr
  | Stmt
  | Err
  | BindingPattern
  | ImportKeyword
  | SuperKeyword
  | TemplateHead
  | TemplateMiddle
  | TemplateSpan
  | TemplateTail
  | VariableDeclList;

export interface HasParent<Parent extends FunctionlessNode> {
  get parent(): Parent;
  set parent(parent: Parent);
}

type Binding = [string, BindingDecl];
export type BindingDecl =
  | VariableDecl
  | ParameterDecl
  | BindingElem
  | ClassDecl
  | ClassExpr
  | FunctionDecl
  | FunctionExpr;

export abstract class BaseNode<
  Kind extends NodeKind,
  Parent extends FunctionlessNode | undefined = FunctionlessNode
> {
  abstract readonly nodeKind: "Decl" | "Err" | "Expr" | "Node" | "Stmt";

  // @ts-ignore - we have a convention to set this in the parent constructor
  readonly parent: Parent;

  /**
   * The immediate Child nodes contained within this Node.
   */
  readonly children: FunctionlessNode[] = [];

  readonly _arguments: ConstructorParameters<NodeCtor<this["kind"]>>;

  constructor(
    readonly kind: Kind,
    readonly span: Span,
    _arguments: IArguments
  ) {
    this._arguments = Array.from(_arguments) as any;
    const setParent = (node: any) => {
      if (isNode(node)) {
        // @ts-ignore
        node.parent = this;
        this.children.push(node);
      } else if (Array.isArray(node)) {
        node.forEach(setParent);
      }
    };
    for (const arg of _arguments) {
      setParent(arg);
    }
  }

  public get kindName(): NodeKindName<Kind> {
    return getNodeKindName(this.kind);
  }

  public toSExpr(): [kind: this["kind"], ...args: any[]] {
    const [span, ...rest] = this._arguments;
    return [
      this.kind,
      span,
      ...rest.map(function toSExpr(arg: any): any {
        if (isNode(arg)) {
          return arg.toSExpr();
        } else if (Array.isArray(arg)) {
          return arg.map(toSExpr);
        } else {
          return arg;
        }
      }),
    ];
  }

  /**
   * Forks the tree starting from `this` node with {@link node} as its child
   *
   * This function simply sets the {@link node}'s parent and returns it.
   */
  public fork<N extends FunctionlessNode>(node: N): N {
    // @ts-ignore
    node.parent = this;
    return node;
  }

  /**
   * @returns the name of the file this node originates from.
   */
  public getFileName(): string {
    if (
      (isFunctionLike(this) || isClassLike(this) || isMethodDecl(this)) &&
      this.filename
    ) {
      return this.filename;
    } else if (this.parent === undefined) {
      throw new Error(`cannot get filename of orphaned node`);
    } else {
      return this.parent.getFileName();
    }
  }

  protected ensureArrayOf<Assert extends Assertion>(
    arr: any[],
    fieldName: string,
    assertion: Assert[] | readonly Assert[]
  ): asserts arr is AssertionToInstance<Assert>[] {
    return ensureArrayOf(this.kind, arr, fieldName, assertion);
  }

  protected ensure<Assert extends Assertion>(
    item: any,
    fieldName: string,
    assertion: Assert[] | readonly Assert[]
  ): asserts item is AssertionToInstance<Assert> {
    return ensure(this.kind, item, fieldName, assertion);
  }

  public as<T>(guard: (a: any) => a is T): T | undefined {
    if (guard(this)) {
      return this;
    }
    return undefined;
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
      return this.parent as unknown as N;
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
      return this.parent.findCatchClause();
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
      //if a variableStmt has a declaration with an initializer, return the variableStmt.
      if (self.declList.decls.find((x) => x.initializer)) {
        return self;
      } else if (self.next) {
        return self.next.step();
      } else {
        return self.exit();
      }
    } else if (isDoStmt(self)) {
      return self.stmt.step();
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
  public getLexicalScope(): Map<string, BindingDecl> {
    return new Map(
      getLexicalScope(this as unknown as FunctionlessNode, "scope")
    );

    /**
     * @param kind the relation between the current `node` and the requesting `node`.
     */
    function getLexicalScope(
      node: FunctionlessNode | undefined,
      /**
       * the relation between the current `node` and the requesting `node`.
       * * `scope` - the current node is an ancestor of the requesting node
       * * `sibling` - the current node is the sibling of the requesting node
       *
       * ```ts
       * for(const i in []) { // scope - emits i=self
       *    const a = ""; // sibling - emits a=self
       *    for(const a of []) {} // sibling emits []
       *    a // requesting node
       * }
       * ```
       *
       * some nodes only emit names to their `scope` (ex: for) and
       * other nodes emit names to all of their `sibling`s (ex: variableStmt)
       */
      kind: "scope" | "sibling"
    ): Binding[] {
      if (node === undefined) {
        return [];
      }
      return getLexicalScope(
        node.nodeKind === "Stmt" && node.prev ? node.prev : node.parent,
        node.nodeKind === "Stmt" && node.prev ? "sibling" : "scope"
      ).concat(getNames(node, kind));
    }

    /**
     * @see getLexicalScope
     */
    function getNames(
      node: FunctionlessNode | undefined,
      kind: "scope" | "sibling"
    ): Binding[] {
      if (node === undefined) {
        return [];
      } else if (isParameterDecl(node)) {
        return isIdentifier(node.name)
          ? [[node.name.name, node]]
          : getNames(node.name, kind);
      } else if (isVariableDeclList(node)) {
        return node.decls.flatMap((d) => getNames(d, kind));
      } else if (isVariableStmt(node)) {
        return getNames(node.declList, kind);
      } else if (isVariableDecl(node)) {
        if (isBindingPattern(node.name)) {
          return getNames(node.name, kind);
        }
        return [[node.name.name, node]];
      } else if (isBindingElem(node)) {
        if (isIdentifier(node.name)) {
          return [[node.name.name, node]];
        }
        return getNames(node.name, kind);
      } else if (isBindingPattern(node)) {
        return node.bindings.flatMap((b) => getNames(b, kind));
      } else if (isFunctionLike(node)) {
        if (kind === "sibling" && isFunctionDecl(node)) {
          if (node.name) {
            return [[node.name, node]];
          } else {
            return [];
          }
        }
        const parameters = node.parameters.flatMap((param) =>
          getNames(param, kind)
        );
        if ((isFunctionExpr(node) || isFunctionDecl(node)) && node.name) {
          return [[node.name, node], ...parameters];
        } else {
          return parameters;
        }
      } else if (isForInStmt(node) || isForOfStmt(node) || isForStmt(node)) {
        if (kind === "sibling") return [];
        return getNames(node.initializer, kind);
      } else if (isCatchClause(node) && node.variableDecl?.name) {
        if (kind === "sibling") return [];
        return getNames(node.variableDecl, kind);
      } else if (isClassDecl(node) || (isClassExpr(node) && node.name)) {
        if (kind === "sibling" && isClassDecl(node)) {
          if (node.name) {
            return [[node.name.name, node]];
          } else {
            return [];
          }
        }
        return [[node.name!.name, node]];
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
