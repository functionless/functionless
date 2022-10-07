import type { Construct } from "constructs";

export const singletonConstruct = <T extends Construct, S extends Construct>(
  scope: S,
  id: string,
  create: (scope: S, id: string) => T
): T => {
  const child = scope.node.tryFindChild(id);
  return child ? (child as T) : create(scope, id);
};
