export const SecretsManagerClient = {
  key: "SecretsManager",
  init: (key, props) =>
    new (require("aws-sdk/clients/secretsmanager"))(
      props?.clientConfigRetriever?.(key)
    ),
};
