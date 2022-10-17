import type StepFunctions from "aws-sdk/clients/stepfunctions";
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
