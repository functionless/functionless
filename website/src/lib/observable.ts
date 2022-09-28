export class Observable<D> {
  private subscribers: Map<Symbol, (data: D)=>void> = new Map()

  public subscribe(subscriber: (data: D)=>void): Symbol {
    const key = Symbol()
    this.subscribers.set(key,subscriber)
    return key
  }

  public unsubscribe(key: Symbol) {
    this.subscribers.delete(key)
  }

  public onNext(data: D) {
    this.subscribers.forEach((s=>s(data)))
  }
}