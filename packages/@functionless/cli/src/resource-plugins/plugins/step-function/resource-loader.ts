import {
  StepFunction,
  ExpressStepFunction,
} from "@functionless/aws-stepfunctions-constructs";
import { ResourceLoader } from "../../loader";
import {
  call,
  environmentVariable,
  exportDefault,
  import_,
  module,
} from "../../loader/ast";

const envKeys = ["stateMachineArn"] as const;

type StepFunctionType = StepFunction<any, any> | ExpressStepFunction<any, any>;

export const resourceLoader: ResourceLoader<typeof envKeys, StepFunctionType> =
  {
    envKeys,

    targets: {
      local: async () => ({
        env: async () => ({
          stateMachineArn: "",
        }),
      }),

      synth: async () => ({
        env: async (p) => ({
          stateMachineArn: p.resource.resource.stateMachineArn,
        }),

        //Replace the import with an invoking function
        transform: (env) => ({
          visitModule: () =>
            module(
              import_(["_invokeStepFunction"], {
                from: "@functionless/aws-stepfunctions",
              }),
              exportDefault(
                call("_invokeStepFunction", [
                  environmentVariable(env.stateMachineArn),
                ])
              )
            ),
        }),
      }),
    },
  };
