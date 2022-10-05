import type * as functionless from "functionless";
export declare type StepFunctionHandler<In extends Record<string, unknown> = any, Out = any> = (input: In) => Promise<Out>;
export declare const StepFunctionKind = "fl.StepFunction";
export interface StepFunction<F extends StepFunctionHandler = StepFunctionHandler> {
    (...args: Parameters<F>): ReturnType<F>;
    kind: typeof StepFunctionKind;
    handler: F;
    props?: functionless.StepFunctionProps;
}
export declare function isStepFunction<F extends StepFunctionHandler>(decl: any): decl is StepFunction<F>;
export declare function StepFunction<F extends StepFunctionHandler>(handler: F): StepFunction<F>;
export declare function StepFunction<F extends StepFunctionHandler>(props: functionless.StepFunctionProps, handler: F): StepFunction<F>;
export declare namespace StepFunction {
    function waitSeconds(seconds: number): Promise<void>;
}
//# sourceMappingURL=step-function.d.ts.map