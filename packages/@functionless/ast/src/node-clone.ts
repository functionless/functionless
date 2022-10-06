import { isNode } from "./guards";
import { BaseNode } from "./node";
import { getCtor } from "./node-ctor";
import type { NodeKind } from "./node-kind";

declare module "./node" {
  interface BaseNode<Kind extends NodeKind> {
    /**
     * Clones the node and all of its children into a new copy.
     */
    clone(): this;
  }
}

// we use module augmentation to inject this method to avoid circular module imports between node <-> node-ctor
BaseNode.prototype.clone = function () {
  const ctor = getCtor(this.kind);
  return new ctor(
    ...Array.from(this._arguments).map(function clone(arg: any): any {
      if (isNode(arg)) {
        return arg.clone();
      } else if (Array.isArray(arg)) {
        return arg.map(clone);
      } else {
        return arg;
      }
    })
  );
};
