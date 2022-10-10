import type { NativeRuntimeInitializer } from "@functionless/aws-lambda";
import type EventBridge from "aws-sdk/clients/eventbridge";

export const EventBridgeClient: NativeRuntimeInitializer<string, EventBridge> =
  {
    key: "EventBridge",
    init: (key, props) =>
      new (require("aws-sdk/clients/eventbridge"))(
        props?.clientConfigRetriever?.(key)
      ),
  };
