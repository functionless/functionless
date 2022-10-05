import type * as functionless from "functionless";
export declare type ExpressStepFunctionHandler<In extends Record<string, unknown> = any, Out = any> = (input: In) => Promise<Out>;
export declare const ExpressStepFunctionKind = "fl.ExpressStepFunction";
export interface ExpressStepFunction<F extends ExpressStepFunctionHandler = ExpressStepFunctionHandler> {
    (...args: Parameters<F>): ReturnType<F>;
    kind: typeof ExpressStepFunctionKind;
    handler: F;
    props?: functionless.StepFunctionProps;
}
export declare function isExpressStepFunction<F extends ExpressStepFunctionHandler>(decl: any): decl is ExpressStepFunction<F>;
export declare function ExpressStepFunction<F extends ExpressStepFunctionHandler>(handler: F): ExpressStepFunction<F>;
export declare function ExpressStepFunction<F extends ExpressStepFunctionHandler>(props: functionless.StepFunctionProps, handler: F): ExpressStepFunction<F>;
//# sourceMappingURL=express-step-function.d.ts.map