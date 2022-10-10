import StepFunctions from "aws-sdk/clients/stepfunctions";
import { createClientFactory } from "@functionless/aws-util";
import { NativeRuntimeInitializer } from "@functionless/aws-lambda";

export const StepFunctionsClient: NativeRuntimeInitializer<
  "StepFunctions",
  StepFunctions
> = {
  key: "StepFunctions",
  init: (key, props) =>
    new (require("aws-sdk/clients/stepfunctions"))(
      props?.clientConfigRetriever?.(key)
    ),
};

export const stepFunctionClient = createClientFactory(StepFunctions);
