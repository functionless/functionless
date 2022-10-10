import type { NativeRuntimeInitializer } from "@functionless/aws-lambda";
import type Lambda from "aws-sdk/clients/lambda";

export const EventBridgeClient: NativeRuntimeInitializer<string, Lambda> = {
  key: "EventBridge",
  init: (key, props) =>
    new (require("aws-sdk/clients/eventbridge"))(
      props?.clientConfigRetriever?.(key)
    ),
};
