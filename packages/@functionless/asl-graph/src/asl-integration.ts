import { CallExpr } from "@functionless/ast";
import { ASL } from "./asl";
import { ASLGraph } from "./asl-graph";

export function isASLIntegration(a: any): a is ASLIntegration {
  return (
    a &&
    typeof a === "object" &&
    typeof a.kind === "string" &&
    typeof a.asl === "function"
  );
}

export interface ASLIntegration {
  kind: string;
  asl: (call: CallExpr, context: ASL) => ASLGraph.NodeResults;
}
