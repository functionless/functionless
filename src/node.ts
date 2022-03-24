import type { Decl } from "./declaration";
import type { Expr } from "./expression";
import type { CatchClause, Stmt } from "./statement";

export type FunctionlessNode = Decl | Expr | Stmt;

export function isNode(a: any): a is FunctionlessNode {
  return typeof a?.kind === "string";
}

export interface HasParent<Parent extends FunctionlessNode> {
  get parent(): Parent;
  set parent(parent: Parent);
}

export class BaseNode<
  Kind extends FunctionlessNode["kind"],
  Parent extends FunctionlessNode | undefined = FunctionlessNode | undefined
> {
  // @ts-ignore
  parent: Parent;

  /**
   * The immediate Child nodes contained within this Node.
   */
  readonly children: FunctionlessNode[] = [];

  constructor(readonly kind: Kind) {}

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

  /**
   * Finds the {@link CatchClause} that this Node should throw to.
   */
  public findCatchClause(): CatchClause | undefined {
    const scope = this.parent;
    if (scope === undefined) {
      return undefined;
    } else if (scope.kind === "TryStmt") {
      return scope.catchClause;
    } else if (scope.kind === "CatchClause") {
      // skip the try-block
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

  public stepIn(): Stmt | undefined {
    const self = this as unknown as FunctionlessNode;

    if (self.kind === "TryStmt") {
      return self.tryBlock.stepIn();
    } else if (self.kind === "BlockStmt") {
      if (self.isEmpty()) {
        return self.stepOut();
      } else {
        return self.firstStmt?.stepIn();
      }
    } else if (self.kind === "CatchClause") {
      if (self.variableDecl) {
        return self.variableDecl.stepIn();
      } else {
        return self.block.stepIn();
      }
    } else if ("next" in self) {
      // isStmt
      return self;
    } else {
      return undefined;
    }
  }

  public stepOut(): Stmt | undefined {
    const node = this as unknown as FunctionlessNode;
    if ("next" in node && node.next) {
      return node.next.stepIn();
    }
    const scope = node.parent;
    if (scope === undefined) {
      return undefined;
    } else if (scope.kind === "TryStmt") {
      if (scope.tryBlock === node) {
      } else if (scope.finallyBlock === node) {
        // stepping out of the finallyBlock
        if (scope.next) {
          return scope.next.stepIn();
        } else {
          return scope.stepOut();
        }
      }
    } else if (scope.kind === "CatchClause") {
      if (scope.parent.finallyBlock) {
        return scope.parent.finallyBlock.stepIn();
      } else {
        return scope.parent.stepOut();
      }
    } else if ("next" in scope && scope.next) {
      return scope.next.stepIn();
    }
    return scope.stepOut();
  }
}

// generates type guards
export function typeGuard<Kind extends FunctionlessNode["kind"]>(
  ...kinds: Kind[]
): (a: any) => a is Extract<FunctionlessNode, { kind: Kind }> {
  return (a: any): a is Extract<FunctionlessNode, { kind: Kind }> =>
    kinds.find((kind) => a?.kind === kind) !== undefined;
}
