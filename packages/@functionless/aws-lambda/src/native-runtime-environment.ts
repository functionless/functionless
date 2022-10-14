import type Lambda from "aws-sdk/clients/lambda";
import { NativeRuntimeInitializer } from "./native-context";

export interface NativeRuntimeEnvironmentProps {
  clientConfigRetriever?: (
    clientName: string | string
  ) => Omit<Lambda.ClientConfiguration, keyof Lambda.ClientApiVersions>;
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
export class NativeRuntimeEnvironment {
  private readonly cache: Record<string, any>;

  constructor(private props?: NativeRuntimeEnvironmentProps) {
    this.cache = {};
  }

  public get<T>(key: string): T | undefined {
    return this.cache[key];
  }

  public getOrInit<T>(client: NativeRuntimeInitializer<any, T>): T {
    if (!this.cache[client.key]) {
      this.cache[client.key] = client.init(client.key, this.props);
    }
    return this.cache[client.key];
  }
}
