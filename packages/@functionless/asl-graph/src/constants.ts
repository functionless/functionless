/**
 * The name of the functionless context data node used in {@link FUNCTIONLESS_CONTEXT_JSON_PATH}.
 */
export const FUNCTIONLESS_CONTEXT_NAME = "fnl_context";
/**
 * A json path which stores functionless context data like the input and a hard to manufacture null value
 *
 * This path/variable must start with a letter.
 * https://twitter.com/sussmansa/status/1542777348616990720?s=20&t=2PepSKvzPhojs_x01WoQVQ
 */
export const FUNCTIONLESS_CONTEXT_JSON_PATH = `$.${FUNCTIONLESS_CONTEXT_NAME}`;
