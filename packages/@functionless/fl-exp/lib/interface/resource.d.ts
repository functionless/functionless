import { EventBus } from "./event-bus";
import { LambdaFunction } from "./lambda-function";
import { Method } from "./method";
import { RestApi } from "./rest-api";
import { StepFunction } from "./step-function";
import { ExpressStepFunction } from "./express-step-function";
import { TableDecl } from "./table";
export declare type ResourceKind = Resource["kind"];
export declare function isResource(a: any): a is Resource;
export declare type Resource = LambdaFunction | StepFunction | ExpressStepFunction | TableDecl | RestApi | Method | EventBus;
//# sourceMappingURL=resource.d.ts.map