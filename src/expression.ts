import { Stmt } from "./statement";

export type Expr = Stmt | IntrinsicExpr | LiteralExpr;

export type LiteralExpr =
  | undefined
  | null
  | boolean
  | number
  | string
  | Expr[]
  | readonly Expr[]
  | {
      [key: string]: Expr;
    };

export type IntrinsicExpr =
  | Block
  | Call
  | Identifier
  | If
  | Map
  | PropRef
  | Return;

export const isIntrinsicExpr = guard(
  "Block",
  "Call",
  "Identifier",
  "If",
  "Map",
  "PropRef",
  "Return"
);

export class BaseExpr<Kind extends string> {
  constructor(readonly kind: Kind) {
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          return (target as any)[prop];
        } else if (typeof prop === "string") {
          return new PropRef(this as unknown as Expr, prop);
        } else {
          throw new Error();
        }
      },
      apply: (target, _thisArg, _args) => {
        if (isPropRef(target)) {
          if (target.id === "map") {
          }
        }
      },
    });
  }
}

export const isIdentifier = guard("Identifier");

export class Identifier extends BaseExpr<"Identifier"> {
  constructor(readonly id: string) {
    super("Identifier");
  }
}

export const isPropRef = guard("PropRef");

export class PropRef extends BaseExpr<"PropRef"> {
  constructor(readonly expr: Expr, readonly id: string) {
    super("PropRef");
  }
}

export const isCall = guard("Call");

export class Call extends BaseExpr<"Call"> {
  constructor(
    readonly expr: string,
    readonly args: {
      [argName: string]: Expr;
    }
  ) {
    super("Call");
  }
}

export const isMap = guard("Map");

export class Map extends BaseExpr<"Map"> {
  constructor(readonly expr: Expr) {
    super("Map");
  }
}

export const isReturn = guard("Return");

export class Return extends BaseExpr<"Return"> {
  constructor(readonly expr: Expr) {
    super("Return");
  }
}

export const isBlock = guard("Block");

export class Block extends BaseExpr<"Block"> {
  constructor(readonly exprs: Expr[]) {
    super("Block");
  }
}

export const isIf = guard("If");

export class If extends BaseExpr<"If"> {
  constructor(readonly when: Expr, readonly then: Expr, readonly _else?: Expr) {
    super("If");
  }
}

function guard<Kind extends IntrinsicExpr["kind"]>(
  ...kinds: Kind[]
): (a: any) => a is Extract<Expr, { kind: Kind }> {
  return (a: any): a is Extract<Expr, { kind: Kind }> =>
    kinds.find((kind) => a.kind === kind) !== undefined;
}
