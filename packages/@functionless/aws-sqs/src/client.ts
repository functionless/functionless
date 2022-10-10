import type { NativeRuntimeInitializer } from "@functionless/aws-lambda";
import type SQS from "aws-sdk/clients/sqs";

export const SQSClient: NativeRuntimeInitializer<"SQS", SQS> = {
  key: "SQS",
  init: (key, props) => {
    const SQS = require("aws-sdk/clients/sqs");
    return new SQS(props?.clientConfigRetriever?.(key));
  },
};
