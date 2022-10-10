import { NativeRuntimeInitializer } from "./native-context";
import type Lambda from "aws-sdk/clients/lambda";

export const LambdaClient: NativeRuntimeInitializer<string, Lambda> = {
  key: "Lambda",
  init: (key, props) =>
    new (require("aws-sdk/clients/lambda"))(
      props?.clientConfigRetriever?.(key)
    ),
};
