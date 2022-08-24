/**
 * This client is used at runtime. Keep the dependencies to a minimal and analyze the lambda bundles on output.
 */
export interface PrewarmClientInitializer<T, O> {
  key: T;
  init: (key: string, props?: PrewarmProps) => O;
}

export type ClientName =
  | "DynamoDB"
  | "EventBridge"
  | "Lambda"
  | "SecretsManager"
  | "StepFunctions";

/**
 * Known, shared clients to use.
 *
 * Any object can be used by using the {@link PrewarmClientInitializer} interface directly.
 *
 * ```ts
 * context.getOrInit({
 *   key: 'customClient',
 *   init: () => new anyClient()
 * })
 * ```
 */
export const PrewarmClients: Record<
  ClientName,
  PrewarmClientInitializer<ClientName, any>
> = {
  Lambda: {
    key: "Lambda",
    init: (key, props) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
      new (require("aws-sdk").Lambda)(props?.clientConfigRetriever?.(key)),
  },
  EventBridge: {
    key: "EventBridge",
    init: (key, props) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
      new (require("aws-sdk").EventBridge)(props?.clientConfigRetriever?.(key)),
  },
  StepFunctions: {
    key: "StepFunctions",
    init: (key, props) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
      new (require("aws-sdk").StepFunctions)(
        props?.clientConfigRetriever?.(key)
      ),
  },
  DynamoDB: {
    key: "DynamoDB",
    init: (key, props) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
      new (require("aws-sdk/clients/dynamodb"))(
        props?.clientConfigRetriever?.(key)
      ),
  },
  SecretsManager: {
    key: "SecretsManager",
    init: (key, props) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
      new (require("aws-sdk").SecretsManager)(
        props?.clientConfigRetriever?.(key)
      ),
  },
};

export const SQSClient: PrewarmClientInitializer<"SQS", AWS.SQS> = {
  key: "SQS",
  init: (key, props) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
    new (require("aws-sdk/clients/sqs").SQS)(
      props?.clientConfigRetriever?.(key)
    ),
};

export interface PrewarmProps {
  clientConfigRetriever?: (
    clientName: ClientName | string
  ) => Omit<AWS.Lambda.ClientConfiguration, keyof AWS.Lambda.ClientApiVersions>;
}

/**
 * A client/object cache which Native Functions can use to
 * initialize objects once and before the handler is invoked.
 *
 * The same instance will be passed to both the `.call` and `.prewarm` methods
 * of a {@link NativeIntegration}. `prewarm` is called once when the function starts,
 * before the handler.
 *
 * Register and initialize clients by using `getOrInit` with a key and a initializer.
 *
 * ```ts
 * context.getOrInit(PrewarmClients.LAMBDA)
 * ```
 *
 * or register anything by doing
 *
 * ```ts
 * context.getOrInit({
 *   key: 'customClient',
 *   init: () => new anyClient()
 * })
 * ```
 *
 * To get without potentially initializing the client, use `get`:
 *
 * ```ts
 * context.get("LAMBDA")
 * context.get("customClient")
 * ```
 */
export class NativePreWarmContext {
  private readonly cache: Record<string, any>;

  constructor(private props?: PrewarmProps) {
    this.cache = {};
  }

  public get<T>(key: ClientName | string): T | undefined {
    return this.cache[key];
  }

  public getOrInit<T>(client: PrewarmClientInitializer<any, T>): T {
    if (!this.cache[client.key]) {
      this.cache[client.key] = client.init(client.key, this.props);
    }
    return this.cache[client.key];
  }
}
