import type { StackProps } from "aws-cdk-lib/core/lib/stack";

export const StackKind = "fl.Stack";

export interface StackDecl {
  kind: typeof StackKind;
  props?: StackProps;
}

export function isStack(a: any): a is StackDecl {
  return a?.kind === StackKind;
}

export function Stack(props?: StackProps) {
  return <StackDecl>{
    kind: StackKind,
    props,
  };
}
