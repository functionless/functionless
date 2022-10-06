import { EventBus } from "./event-bus";
import { LambdaFunction } from "./lambda-function";
import { Method } from "./method";
import { RestApi } from "./rest-api";
import { StepFunction } from "./step-function";
import { ExpressStepFunction } from "./express-step-function";
import { TableDecl } from "./table";

export type ResourceKind = Resource["kind"];

export function isResource(a: any): a is Resource {
  return "kind" in a;
}

export type Resource =
  | LambdaFunction
  | StepFunction
  | ExpressStepFunction
  | TableDecl
  | RestApi
  | Method
  | EventBus;
