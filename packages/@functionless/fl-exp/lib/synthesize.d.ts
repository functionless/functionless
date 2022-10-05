import { Project } from "./project";
import { CfnElement, NestedStack, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as functionless from "functionless";
export declare class FunctionlessStack extends Stack {
    protected allocateLogicalId(cfnElement: CfnElement): string;
}
export declare class FunctionlessNestedStack extends NestedStack {
    protected allocateLogicalId(cfnElement: CfnElement): string;
}
export declare function synthesizeProject(project: Project): Promise<void>;
export declare type SynthesizedResource = functionless.StepFunction<any, any> | functionless.IStepFunction<any, any> | functionless.ExpressStepFunction<any, any> | functionless.IExpressStepFunction<any, any> | functionless.Function<any, any> | functionless.Table<any, any, any> | functionless.EventBus<any> | Construct;
//# sourceMappingURL=synthesize.d.ts.map