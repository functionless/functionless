import type { StackProps } from "aws-cdk-lib/core/lib/stack";
export declare const StackKind = "fl.Stack";
export interface StackDecl {
    kind: typeof StackKind;
    props?: StackProps;
}
export declare function isStack(a: any): a is StackDecl;
export declare function Stack(props?: StackProps): StackDecl;
//# sourceMappingURL=stack.d.ts.map