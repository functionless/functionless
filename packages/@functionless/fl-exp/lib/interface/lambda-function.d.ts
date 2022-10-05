import type * as functionless from "functionless";
export declare type FunctionHandler<In = any, Out = any> = (input: In) => Promise<Out>;
export declare const LambdaFunctionKind = "fl.Function";
export interface LambdaFunction<F extends FunctionHandler = FunctionHandler> {
    (...args: Parameters<F>): ReturnType<F>;
    kind: typeof LambdaFunctionKind;
    handler: F;
    props: functionless.FunctionProps;
}
export declare function isLambdaFunction<F extends FunctionHandler>(decl: any): decl is LambdaFunction<F>;
export declare function LambdaFunction<F extends (input: any) => Promise<any>>(handler: F): LambdaFunction<F>;
export declare function LambdaFunction<F extends (input: any) => Promise<any>>(props: functionless.FunctionProps, handler: F): LambdaFunction<F>;
//# sourceMappingURL=lambda-function.d.ts.map