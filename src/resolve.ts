export type Resolved<T> = ResolvedResponse<T> | TransformedResponse<any, T>;

class BaseResolved<TReturn> implements Generator<unknown, TReturn> {
  constructor(readonly generator: Generator<unknown, TReturn>) {}

  public [Symbol.iterator]() {
    return this.generator[Symbol.iterator]();
  }

  public next(...args: [] | [unknown]) {
    return this.generator.next(...args);
  }

  public throw(e: any) {
    return this.generator.throw(e);
  }

  public return(value: TReturn) {
    return this.generator.return(value);
  }
}

export class ResolvedResponse<TReturn> extends BaseResolved<TReturn> {
  readonly kind: "Response" = "Response";

  public map<U>(fn: (value: TReturn) => U): TransformedResponse<TReturn, U> {
    return new TransformedResponse(this, fn);
  }
}

export class TransformedResponse<T, U> extends BaseResolved<U> {
  readonly kind: "MappedResponse" = "MappedResponse";

  constructor(
    readonly response: ResolvedResponse<T>,
    readonly fn: (value: T) => U
  ) {
    super(
      (function* () {
        return null as any as U;
      })()
    );
  }
}
