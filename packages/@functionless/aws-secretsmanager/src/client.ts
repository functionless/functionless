import type { NativeRuntimeInitializer } from "@functionless/aws-lambda";
import type SecretsManager from "aws-sdk/clients/secretsmanager";

export const SecretsManagerClient: NativeRuntimeInitializer<
  string,
  SecretsManager
> = {
  key: "SecretsManager",
  init: (key, props) =>
    new (require("aws-sdk/clients/secretsmanager"))(
      props?.clientConfigRetriever?.(key)
    ),
};
