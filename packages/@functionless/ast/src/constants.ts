/**
 * A CRC-32 hash of the word "functionless".
 *
 * Used to give generated functions a predictable name is that is highly-likely
 * to be unique within a module.
 *
 * If we ever have collisions (highly improbable) we can simply change this to
 * a hash with higher entropy such as a SHA256. For now, CRC-32 is chosen for its
 * relatively small size.
 */
const FunctionlessSalt = "8269d1a8";

/**
 * Name of the `register` function that is injected into all compiled source files.
 *
 * ```ts
 * function register_8269d1a8(func, ast) {
 *   func[Symbol.for("functionless:AST")] = ast;
 *   return func;
 * }
 * ```
 *
 * All Function Declarations, Expressions and Arrow Expressions are decorated with
 * the `register` function which attaches its AST as a property.
 */
export const RegisterFunctionName = `register_${FunctionlessSalt}`;

/**
 * Name of the `bind` function that is injected into all compiled source files.
 *
 * ```ts
 * function bind_8269d1a8(func, self, ...args) {
 *   const tmp = func.bind(self, ...args);
 *   if (typeof func === "function") {
 *     func[Symbol.for("functionless:BoundThis")] = self;
 *     func[Symbol.for("functionless:BoundArgs")] = args;
 *     func[Symbol.for("functionless:TargetFunction")] = func;
 *   }
 *   return tmp;
 * }
 * ```
 *
 * All CallExpressions with the shape `<expr>.bind(...<args>)` are re-written as calls
 * to this special function which intercepts the call.
 * ```ts
 * <expr>.bind(...<args>)
 * // =>
 * bind_8269d1a8(<expr>, ...<args>)
 * ```
 *
 * If `<expr>` is a Function, then the values of BoundThis, BoundArgs and TargetFunction
 * are added to the bound Function.
 *
 * If `<expr>` is not a Function, then the call is proxied without modification.
 */
export const BindFunctionName = `bind_${FunctionlessSalt}`;
