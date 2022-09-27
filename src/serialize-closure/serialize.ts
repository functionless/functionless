import fs from "fs";
import path from "path";
import util from "util";
import { Token } from "aws-cdk-lib";
import { CodeWithSourceMap, SourceNode } from "source-map";

import { assertNever } from "../assert";
import {
  BindingName,
  ClassDecl,
  FunctionLike,
  GetAccessorDecl,
  MethodDecl,
  SetAccessorDecl,
  VariableDeclKind,
} from "../declaration";
import { ClassExpr } from "../expression";
import {
  isArgument,
  isArrayBinding,
  isArrayLiteralExpr,
  isArrowFunctionExpr,
  isAwaitExpr,
  isBigIntExpr,
  isBinaryExpr,
  isBindingElem,
  isBlockStmt,
  isBooleanLiteralExpr,
  isBreakStmt,
  isCallExpr,
  isCaseClause,
  isCatchClause,
  isClassDecl,
  isClassExpr,
  isClassStaticBlockDecl,
  isComputedPropertyNameExpr,
  isConditionExpr,
  isConstructorDecl,
  isContinueStmt,
  isDebuggerStmt,
  isDefaultClause,
  isDeleteExpr,
  isDoStmt,
  isElementAccessExpr,
  isEmptyStmt,
  isErr,
  isExprStmt,
  isForInStmt,
  isForOfStmt,
  isForStmt,
  isFunctionDecl,
  isFunctionExpr,
  isFunctionLike,
  isGetAccessorDecl,
  isIdentifier,
  isIfStmt,
  isImportKeyword,
  isLabelledStmt,
  isMethodDecl,
  isNewExpr,
  isNoSubstitutionTemplateLiteral,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectBinding,
  isObjectLiteralExpr,
  isOmittedExpr,
  isParameterDecl,
  isParenthesizedExpr,
  isPostfixUnaryExpr,
  isPrivateIdentifier,
  isPropAccessExpr,
  isPropAssignExpr,
  isPropDecl,
  isReferenceExpr,
  isRegexExpr,
  isReturnStmt,
  isSetAccessorDecl,
  isSpreadAssignExpr,
  isSpreadElementExpr,
  isStringLiteralExpr,
  isSuperKeyword,
  isSwitchStmt,
  isTaggedTemplateExpr,
  isTemplateExpr,
  isTemplateHead,
  isTemplateMiddle,
  isTemplateSpan,
  isTemplateTail,
  isThisExpr,
  isThrowStmt,
  isTryStmt,
  isTypeOfExpr,
  isUnaryExpr,
  isUndefinedLiteralExpr,
  isVariableDecl,
  isVariableDeclList,
  isVariableStmt,
  isVoidExpr,
  isWhileStmt,
  isWithStmt,
  isYieldExpr,
} from "../guards";
import { FunctionlessNode } from "../node";
import { reflect, reverseProxy, unbind } from "../reflect";
import { AnyClass, AnyFunction, evalToConstant } from "../util";
import { forEachChild } from "../visit";
import { Globals } from "./globals";
import {
  exprStmt,
  assignExpr,
  propAccessExpr,
  idExpr,
  stringExpr,
  undefinedExpr,
  nullExpr,
  trueExpr,
  falseExpr,
  numberExpr,
  objectExpr,
  definePropertyExpr,
  getOwnPropertyDescriptorExpr,
  callExpr,
  setPropertyStmt,
  newExpr,
  bigIntExpr,
  regExpr,
  SourceNodeOrString,
  createSourceNode,
  createSourceNodeWithoutSpan,
} from "./util";

export interface SerializeClosureProps {
  /**
   * A function to prevent serialization of certain values captured during the serialization.
   */
  serialize?: (o: any) => boolean | any;
  /**
   * A function to prevent serialization of a {@link property} on an {@link obj}
   *
   * @param obj the object containing the property
   * @param property the value of the property name
   */
  shouldCaptureProp?: (obj: any, property: string | number | symbol) => boolean;
  /**
   * If this is a function which, when invoked, will produce the actual entrypoint function.
   * Useful for when serializing a function that has high startup cost that only wants to be
   * run once. The signature of this function should be:  () => (provider_handler_args...) => provider_result
   *
   * This will then be emitted as: `exports.[exportName] = serialized_func_name();`
   *
   * In other words, the function will be invoked (once) and the resulting inner function will
   * be what is exported.
   */
  isFactoryFunction?: boolean;
}

/**
 * Serialize a {@link CodeWithSourceMap} to a JavaScript string with the source map
 * as a base64-encoded comment at the end of the file.
 *
 * @param code the code and source map
 * @returns a a JavaScript string with the source map as a base64-encoded comment at the end of the file.
 */
export function serializeCodeWithSourceMap(code: CodeWithSourceMap) {
  const map = Buffer.from(JSON.stringify(code.map.toJSON())).toString("base64");
  return `${code.code}\n//# sourceMappingURL=data:application/json;base64,${map}`;
}

// cache a map of directory -> module id
const moduleIdCache = new Map<string, string | null>();

/**
 * Serialize a closure to a bundle that can be remotely executed.
 * @param func
 * @param options ES Build options.
 * @returns a string
 */
export function serializeClosure(
  func: AnyFunction,
  options?: SerializeClosureProps
): CodeWithSourceMap {
  interface RequiredModule {
    path: string;
    exportName?: string;
    exportValue: any;
    module: NodeModule;
  }

  // walk the entire require.cache and store a map of value
  //   -> the module that exported it
  //   -> the name of the exported value
  //   -> the path of the module
  const requireCache = new Map<any, RequiredModule>(
    Object.entries(require.cache).flatMap(([path, module]) => {
      try {
        return [
          [
            module?.exports as any,
            <RequiredModule>{
              path,
              exportName: undefined,
              exportValue: module?.exports,
              module,
            },
          ],
          ...(Object.entries(
            Object.getOwnPropertyDescriptors(module?.exports ?? {})
          ).map(([exportName, exportValue]) => {
            return [
              exportValue.value,
              <RequiredModule>{
                path,
                exportName,
                exportValue: exportValue.value,
                module: module,
              },
            ];
          }) as [any, RequiredModule][]),
        ];
      } catch (err) {
        throw err;
      }
    })
  );

  const uniqueName = (() => {
    let i = 0;

    return (illegalNames?: Set<string>) => {
      let name;
      do {
        name = `v${i++}`;
      } while (illegalNames?.has(name));
      return name;
    };
  })();

  const statements: (SourceNode | string)[] = [];

  // stores a map of value to a ts.Expression producing that value
  const valueIds = new Map<any, string>();

  const singleton = (() => {
    return function (value: any, produce: () => string): string {
      // optimize for number of map get/set operations as this is hot code
      let expr = valueIds.get(value);
      if (expr === undefined) {
        expr = produce();
        valueIds.set(value, expr);
      }
      return expr;
    };
  })();

  // stores a map of a `<variable-id>` to a ts.Identifier pointing to the unique location of that variable
  const referenceIds = new Map<string, string>();
  // map ReferenceExpr (syntactically) to the Closure Instance ID
  const referenceInstanceIDs = new Map<number, number>();

  const funcAst = reflect(func)!;
  const handler = serialize(func);
  emit(
    createSourceNode(
      funcAst,
      `exports.handler = ${handler}${options?.isFactoryFunction ? "()" : ""}`
    )
  );

  // looks like TS does not expose the source-map functionality
  // TODO: figure out how to generate a source map since we have all the information ...
  const script = new SourceNode(1, 0, "index.js", statements);

  return script.toStringWithSourceMap();

  function emit(...stmts: (string | SourceNode)[]) {
    statements.push(...stmts.flatMap((stmt) => [stmt, "\n"]));
  }

  function emitVarDecl(
    varKind: "const" | "let" | "var",
    varName: string,
    expr?: SourceNodeOrString | undefined
  ): string {
    emit(
      createSourceNodeWithoutSpan(
        varKind,
        " ",
        varName,
        ...(expr ? [" = ", expr] : []),
        ";"
      )
    );
    return varName;
  }

  function emitRequire(mod: string) {
    // const vMod = require("module-name");
    return emitVarDecl(
      "const",
      uniqueName(),
      callExpr(idExpr("require"), [stringExpr(mod)])
    );
  }

  function serialize(value: any): string {
    let serializedVal = valueIds.get(value);
    if (serializedVal === undefined) {
      serializedVal = serializeHook(value);
      valueIds.set(value, serializedVal);
    }
    return serializedVal;
  }

  function serializeHook(value: any) {
    if (options?.serialize) {
      const result = options.serialize(value);
      if (result === false) {
        // do not serialize - emit `undefined`.
        return undefinedExpr();
      } else if (result === true) {
        // `true` means serialize the original value
        return serializeValue(value);
      } else {
        // otherwise, serialize the modified value
        return serializeValue(result);
      }
    } else {
      // there is no serialize hook, so just serialize the original value
      return serializeValue(value);
    }
  }

  function serializeValue(value: any): string {
    if (value === undefined) {
      return undefinedExpr();
    } else if (value === null) {
      return nullExpr();
    } else if (value === true) {
      return trueExpr();
    } else if (value === false) {
      return falseExpr();
    } else if (typeof value === "number") {
      return numberExpr(value);
    } else if (typeof value === "bigint") {
      return bigIntExpr(value);
    } else if (typeof value === "symbol") {
      const symbol = serialize(Symbol);
      return singleton(value, () => {
        if (typeof value.description === "string") {
          if (value === Symbol.for(value.description)) {
            // Symbol.for(description)
            return callExpr(propAccessExpr(symbol, "for"), [
              stringExpr(value.description),
            ]);
          } else {
            // Symbol(description)
            return callExpr(symbol, [stringExpr(value.description)]);
          }
        } else {
          // Symbol()
          return callExpr(symbol, []);
        }
      });
    } else if (typeof value === "string") {
      return stringExpr(value);
    } else if (value instanceof RegExp) {
      return singleton(value, () => regExpr(value));
    } else if (value instanceof Date) {
      return singleton(value, () =>
        newExpr(idExpr("Date"), [numberExpr(value.getTime())])
      );
    } else if (Array.isArray(value)) {
      // TODO: should we check the array's prototype?

      // emit an empty array
      // var vArr = []
      const arr = singleton(value, () =>
        emitVarDecl("const", uniqueName(), `[]`)
      );

      if (value.length > 0) {
        // for each item in the array, serialize the value and push it into the array
        // vArr.push(vItem1, vItem2)
        emit(
          exprStmt(callExpr(propAccessExpr(arr, "push"), value.map(serialize)))
        );
      }

      return arr;
    } else if (util.types.isProxy(value)) {
      const components = reverseProxy(value);
      if (components) {
        const target = serialize(components.target);
        const handler = serialize(components.handler);
        return emitVarDecl(
          "const",
          uniqueName(),
          newExpr(idExpr("Proxy"), [target, handler])
        );
      }
      throw new Error(
        `cannot reverse Proxy - make sure you are compiling with Functionless`
      );
    } else if (typeof value === "object") {
      if (Globals.has(value)) {
        return Globals.get(value)!();
      }

      const mod = requireCache.get(value);

      if (mod) {
        return serializeModule(value, mod);
      }

      if (
        Object.hasOwn(value, "constructor") &&
        typeof value.constructor === "function" &&
        value.constructor.prototype === value
      ) {
        // this is the prototype value of a Function/class
        const clazz = serialize(value.constructor);
        return singleton(value, () => propAccessExpr(clazz, "prototype"));
      }

      const prototype = Object.getPrototypeOf(value);

      // serialize the prototype first
      // there should be no circular references between an object instance and its prototype
      // if we need to handle circular references between an instance and prototype, then we can
      // switch to a strategy of emitting an object and then calling Object.setPrototypeOf
      const serializedPrototype =
        prototype !== Object.prototype ? serialize(prototype) : undefined;

      // emit an empty object with the correct prototype
      // e.g. `var vObj = Object.create(vPrototype);`
      const obj = singleton(value, () =>
        emitVarDecl(
          "const",
          uniqueName(),
          serializedPrototype
            ? callExpr(propAccessExpr(idExpr("Object"), "create"), [
                serializedPrototype,
              ])
            : objectExpr({})
        )
      );

      defineProperties(value, obj);

      return obj;
    } else if (typeof value === "function") {
      if (Globals.has(value)) {
        return singleton(value, () =>
          emitVarDecl("const", uniqueName(), Globals.get(value)!())
        );
      }

      const exportedValue = requireCache.get(value);

      // if this is a reference to an exported value from a module
      // and we're using esbuild, then emit a require
      if (exportedValue) {
        return serializeModule(value, exportedValue);
      }

      // if this is a bound closure, try and reconstruct it from its components
      const boundFunction = serializeBoundFunction(value);
      if (boundFunction) {
        return boundFunction;
      }

      const ast = reflect(value);

      if (ast === undefined) {
        // this function does not have its AST available, so apply some heuristics
        // to serialize it or fail
        return serializeUnknownFunction(value);
      } else if (isFunctionLike(ast)) {
        return serializeFunction(value, ast);
      } else if (isClassDecl(ast) || isClassExpr(ast)) {
        return serializeClass(value, ast);
      } else if (isMethodDecl(ast)) {
        /**
         * This is a reference to a method - pull it out as an individual function
         *
         * This occurs in two cases:
         * 1. a reference to a method on an object
         * ```ts
         * class Foo {
         *   method() { }
         * }
         *
         * const method = Foo.prototype.method;
         *
         * serialize(() => {
         *   // serialize method as a function
         *   method();
         * })
         * ```
         * 2. a reference to a method on an object
         *
         * ```ts
         * const o = {
         *   prop: "value";
         *   method() {
         *     return this.prop;
         *   }
         * }
         * ```
         */
        return serializeMethodAsFunction(ast);
      } else if (isErr(ast)) {
        throw ast.error;
      }
      console.error("cannot serialize node:", ast);
      throw new Error(`cannot serialize node: ${ast.nodeKind}`);
    }

    console.error("cannot serialize value:", value);
    throw new Error(`cannot serialize value: ${value}`);
  }

  /**
   * Require a module and import the exported value.
   *
   * ```ts
   * const mod = require("module-id").<export-name>
   * ```
   *
   * CAVEAT: only importing values exported by the module's index.
   *
   * ```ts
   * // will map to require("aws-sdk").DynamoDB;
   * const DynamoDB = require("aws-sdk/clients/dynamodb");
   * ```
   */
  function serializeModule(value: unknown, mod: RequiredModule) {
    const exports = mod.module?.exports;
    if (exports === undefined) {
      throw new Error(`undefined exports`);
    }
    const requireMod = singleton(exports, () => {
      const moduleId = getModuleId(mod.path);
      return emitRequire(moduleId);
    });
    return singleton(value, () =>
      emitVarDecl(
        "const",
        uniqueName(),
        mod.exportName ? propAccessExpr(requireMod, mod.exportName) : requireMod
      )
    );
  }

  /**
   * Find the module-id of a jsFile by recursively walking back until
   * finding the `package.json`.
   *
   * If the `package.json` isn't found, then the direct path of the file is returned.
   */
  function getModuleId(jsFile: string): string {
    return findModuleName(path.dirname(jsFile)) ?? jsFile;

    function findModuleName(dir: string): string | null {
      let moduleId = moduleIdCache.get(dir);
      if (moduleId !== undefined) {
        return moduleId;
      }
      moduleIdCache.set(dir, (moduleId = _findModuleName(dir)));
      return moduleId;
    }

    function _findModuleName(dir: string): string | null {
      if (path.resolve(dir) === path.resolve(process.cwd())) {
        // reached the root workspace - could not resolve the module ID
        return null;
      }
      const pkgJsonPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(
          fs.readFileSync(pkgJsonPath).toString("utf-8")
        );
        if (typeof pkgJson.name === "string") {
          if (pkgJson.name === "functionless") {
            // always in-memory serialize functionless
            return null;
          }
          return pkgJson.name;
        }
      }
      return findModuleName(path.join(dir, ".."));
    }
  }

  function serializeFunction(value: AnyFunction, ast: FunctionLike) {
    // declare an empty var for this function
    const func = singleton(value, () => emitVarDecl("var", uniqueName()));

    emit(exprStmt(assignExpr(func, toSourceNode(ast, getIllegalNames(ast)))));

    defineProperties(value, func);

    return func;
  }

  function getIllegalNames(ast: FunctionlessNode): Set<string> {
    const names = new Set<string>();
    forEachChild(ast, function visit(node) {
      if (isParameterDecl(node) || isVariableDecl(node)) {
        getNames(node.name).forEach((name) => names.add(name));
      } else if (
        (isFunctionDecl(node) ||
          isFunctionExpr(node) ||
          isClassDecl(node) ||
          isClassExpr(node)) &&
        node.name
      ) {
        if (typeof node.name === "string") {
          names.add(node.name);
        } else {
          names.add(node.name.name);
        }
      }
      forEachChild(node, visit);
    });
    return names;
  }

  function getNames(name: BindingName): string[] {
    if (isIdentifier(name)) {
      return [name.name];
    } else {
      return name.bindings.flatMap((binding) =>
        isBindingElem(binding) ? getNames(binding.name) : []
      );
    }
  }

  function serializeBoundFunction(func: AnyFunction) {
    const components = unbind(func);
    if (components) {
      const boundThis = serialize(components.boundThis);
      const boundArgs = serialize(components.boundArgs);
      const targetFunction = serialize(components.targetFunction);

      return singleton(func, () =>
        emitVarDecl(
          "const",
          uniqueName(),
          callExpr(propAccessExpr(targetFunction, "bind"), [
            boundThis,
            boundArgs,
          ])
        )
      );
    }
    return undefined;
  }

  function serializeUnknownFunction(value: AnyFunction) {
    if (value.name === "bound requireModuleOrMock") {
      // heuristic to catch Jest's hacked-up require
      return idExpr("require");
    } else if (value.name === "Object") {
      return serialize(Object);
    }

    throw new Error(
      `cannot serialize closures that were not compiled with Functionless unless they are exported by a module: ${func}`
    );
  }

  function serializeClass(
    classVal: AnyClass,
    classAST: ClassExpr | ClassDecl
  ): string {
    // emit the class to the closure
    const classDecl = singleton(classVal, () =>
      emitVarDecl("var", uniqueName())
    );

    emit(
      exprStmt(
        assignExpr(classDecl, toSourceNode(classAST, getIllegalNames(classAST)))
      )
    );

    monkeyPatch(classDecl, classVal, classVal, ["prototype"]);
    monkeyPatch(
      propAccessExpr(classDecl, "prototype"),
      classVal.prototype,
      classVal,
      ["constructor"]
    );

    return classDecl;
  }

  function defineProperties(value: unknown, expr: string, ignore?: string[]) {
    const ignoreSet = ignore ? new Set() : undefined;
    // for each of the object's own properties, emit a statement that assigns the value of that property
    // vObj.propName = vValue
    Object.getOwnPropertyNames(value)
      .filter(
        (propName) =>
          ignoreSet?.has(propName) !== true &&
          (options?.shouldCaptureProp?.(value, propName) ?? true)
      )
      .forEach((propName) => {
        const propDescriptor = Object.getOwnPropertyDescriptor(
          value,
          propName
        )!;

        if (
          !propDescriptor.writable &&
          (propName === "length" ||
            propName === "name" ||
            propName === "arguments" ||
            propName === "caller")
        ) {
          // don't attempt to write Function's length and name properties
          return;
        }

        if (
          propDescriptor.get === undefined &&
          propDescriptor.set === undefined
        ) {
          emit(
            setPropertyStmt(expr, propName, serialize(propDescriptor.value))
          );
        } else {
          const getter = propDescriptor.get
            ? serialize(propDescriptor.get)
            : undefinedExpr();
          const setter = propDescriptor.set
            ? serialize(propDescriptor.set)
            : undefinedExpr();

          emit(
            exprStmt(
              definePropertyExpr(
                expr,
                stringExpr(propName),
                objectExpr({
                  get: getter,
                  set: setter,
                })
              )
            )
          );
        }
      });
  }

  /**
   * Detect properties that have been patched on the original class and
   * emit statements to re-apply the patched values.
   */
  function monkeyPatch(
    /**
     * A ts.Expression pointing to the value within the closure that contains the
     * patched properties.
     */
    varName: SourceNodeOrString,
    /**
     * The value being serialized.
     */
    varValue: any,
    /**
     * The class that "owns" this value.
     */
    ownedBy: AnyClass,
    /**
     * A list of names that should not be considered, such as `prototype` or `constructor`.
     */
    exclude: string[] = []
  ) {
    // discover any properties that have been monkey-patched and overwrite them
    for (const [propName, propDescriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(varValue)
    ).filter(([propName]) => !exclude.includes(propName))) {
      if (propDescriptor.get || propDescriptor.set) {
        const get = propAccessor("get", propDescriptor);
        const set = propAccessor("set", propDescriptor);

        if (get?.patched || set?.patched) {
          emit(
            exprStmt(
              definePropertyExpr(
                varName,
                stringExpr(propName),
                objectExpr({
                  ...(get
                    ? {
                        get: get.patched ?? get.original,
                      }
                    : {}),
                  ...(set
                    ? {
                        set: set.patched ?? set.original,
                      }
                    : {}),
                })
              )
            )
          );
        }

        type PatchedPropAccessor =
          | {
              patched: SourceNodeOrString;
              original?: never;
            }
          | {
              patched?: never;
              original: SourceNodeOrString;
            };

        /**
         * If this getter/setter has changed from the original declaration, then
         * serialize its value and monkey-patch it back in.
         */
        function propAccessor(
          kind: "get" | "set",
          propDescriptor: PropertyDescriptor
        ): PatchedPropAccessor | undefined {
          const getterOrSetter = propDescriptor[kind];
          if (getterOrSetter === undefined) {
            return undefined;
          }
          const ast = reflect(getterOrSetter);
          if (ast === undefined) {
            throw new Error(
              `${`${kind}ter`} was not compiled with functionless`
            );
          }
          if (
            (kind === "get" && isGetAccessorDecl(ast)) ||
            (kind === "set" && isSetAccessorDecl(ast))
          ) {
            const owner = (
              ast as GetAccessorDecl | SetAccessorDecl
            ).ownedBy!.ref();
            if (owner === ownedBy) {
              return {
                original: propAccessExpr(
                  getOwnPropertyDescriptorExpr(varName, stringExpr(propName)),
                  kind
                ),
              };
            } else {
              // a monkey-patched getter/setter
              return {
                patched: serialize(getterOrSetter),
              };
            }
          } else if (isFunctionLike(ast) || isMethodDecl(ast)) {
            return {
              patched: serialize(getterOrSetter),
            };
          }
          return undefined;
        }
      } else if (typeof propDescriptor.value === "function") {
        // method
        const method = propDescriptor.value;
        const methodAST = reflect(method);
        if (methodAST === undefined) {
          throw new Error(`method ${method.toString()} cannot be reflected`);
        } else if (isMethodDecl(methodAST)) {
          if (methodAST.ownedBy!.ref() !== ownedBy) {
            // this is a monkey-patched method, overwrite the value
            emit(setPropertyStmt(varName, propName, serialize(method)));
          } else {
            // this is the same method as declared in the class, so do nothing
          }
        } else if (isFunctionLike(methodAST)) {
          // a method that has been patched with a function decl/expr or arrow expr.
          emit(setPropertyStmt(varName, propName, serialize(method)));
        } else {
          throw new Error(
            `Cannot monkey-patch a method with a ${methodAST.kindName}`
          );
        }
      } else if (propDescriptor.writable) {
        // this is a literal value, like an object, so let's serialize it and set
        emit(
          setPropertyStmt(varName, propName, serialize(propDescriptor.value))
        );
      }
    }
  }

  /**
   * Serialize a {@link MethodDecl} as a Function so that it can be individually referenced.
   */
  function serializeMethodAsFunction(node: MethodDecl): string {
    // find all names used as identifiers in the AST
    // we must ensure that no free variables collide with these names
    const illegalNames = getIllegalNames(node);

    const methodName = uniqueName();

    emit(
      createSourceNode(node, [
        `const ${methodName} = `,
        ...(node.isAsync ? ["async "] : []),
        "function ",
        ...(node.name ? [toSourceNode(node.name, illegalNames)] : []),
        ...(node.isAsterisk ? ["*"] : []),
        "(",
        ...commaSeparatedListSourceNode(node.parameters, illegalNames),
        ")",
        toSourceNode(node.body, illegalNames),
      ])
    );

    return methodName;
  }

  /**
   * Serialize a {@link FunctionlessNode} to a {@link SourceNode} representing the JavaScript.
   *
   * The {@link SourceNode} contains strings and other nested {@link SourceNode}s. Together,
   * they form an entire JS file. Whenever a {@link FunctionlessNode} is mapped to a {@link SourceNode},
   * the {@link FunctionlessNode.span} and {@link FunctionlessNode.getFileName} are included
   * in the {@link SourceNode} so that a source map can be generated mapping the serialized
   * JS back to the source code that created it.
   *
   * @param node
   * @param illegalNames names used within the {@link node} that should not be used
   *                     as free variable names.
   */
  function toSourceNode(
    node: FunctionlessNode,
    illegalNames: Set<string>
  ): SourceNode {
    if (isReferenceExpr(node)) {
      if (isRequire(node.ref())) {
        return createSourceNode(node, "require");
      }
      // get the set of ReferenceExpr instances for thisId
      let thisId =
        node.referenceId !== undefined
          ? referenceInstanceIDs.get(node.referenceId)
          : undefined;
      thisId = thisId === undefined ? 0 : thisId + 1;
      if (node.referenceId) {
        referenceInstanceIDs.set(node.referenceId, thisId);
      }

      // a key that uniquely identifies the variable pointed to by this reference
      const varKey = `${node.getFileName()} ${node.name} ${node.id} ${thisId}`;

      // a ts.Identifier that uniquely references the memory location of this variable in the serialized closure
      let varId: string | undefined = referenceIds.get(varKey);
      if (varId === undefined) {
        varId = uniqueName(illegalNames);
        referenceIds.set(varKey, varId);

        const value = serialize(node.ref());

        // emit a unique variable with the current value
        emitVarDecl("var", varId, value);
      }
      return createSourceNode(node, varId);
    } else if (isArrowFunctionExpr(node)) {
      return createSourceNode(node, [
        ...(node.isAsync ? ["async "] : []),
        "(",
        ...commaSeparatedListSourceNode(node.parameters, illegalNames),
        ") => ",
        toSourceNode(node.body, illegalNames),
      ]);
    } else if (isFunctionDecl(node) || isFunctionExpr(node)) {
      return createSourceNode(node, [
        ...(node.isAsync ? ["async "] : []),
        "function ",
        ...(node.isAsterisk ? ["*"] : []),
        ...(node.name ? [node.name] : []),
        "(",
        ...commaSeparatedListSourceNode(node.parameters, illegalNames),
        ")",
        toSourceNode(node.body, illegalNames),
      ]);
    } else if (isParameterDecl(node)) {
      return createSourceNode(node, [
        ...(node.isRest ? ["..."] : []),
        toSourceNode(node.name, illegalNames),
        ...(node.initializer
          ? ["=", toSourceNode(node.initializer, illegalNames)]
          : []),
      ]);
    } else if (isBlockStmt(node)) {
      return createSourceNode(node, [
        "{\n",
        ...node.statements.flatMap((stmt) => [
          toSourceNode(stmt, illegalNames),
          "\n",
        ]),
        "}\n",
      ]);
    } else if (isThisExpr(node)) {
      return createSourceNode(node, ["this"]);
    } else if (isSuperKeyword(node)) {
      return createSourceNode(node, ["super"]);
    } else if (isIdentifier(node)) {
      return createSourceNode(node, [node.name]);
    } else if (isPrivateIdentifier(node)) {
      return createSourceNode(node, [node.name]);
    } else if (isPropAccessExpr(node)) {
      const val = evalToConstant(node);
      if (val?.constant) {
        if (Token.isUnresolved(val.constant)) {
          // if this is a reference to a Token, pluck it
          return createSourceNode(node, [serialize(val.constant)]);
        }
      }
      return createSourceNode(node, [
        toSourceNode(node.expr, illegalNames),
        ...(node.isOptional ? ["?."] : ["."]),
        toSourceNode(node.name, illegalNames),
      ]);
    } else if (isElementAccessExpr(node)) {
      const val = evalToConstant(node);
      if (val?.constant) {
        if (Token.isUnresolved(val.constant)) {
          // if this is a reference to a Token, pluck it
          return createSourceNode(node, [serialize(val.constant)]);
        }
      }
      return createSourceNode(node, [
        toSourceNode(node.expr, illegalNames),
        ...(node.isOptional ? ["?."] : []),
        "[",
        toSourceNode(node.element, illegalNames),
        "]",
      ]);
    } else if (isCallExpr(node)) {
      return createSourceNode(node, [
        toSourceNode(node.expr, illegalNames),
        ...(node.isOptional ? ["?."] : []),
        "(",
        ...commaSeparatedListSourceNode(node.args, illegalNames),
        ")",
      ]);
    } else if (isNewExpr(node)) {
      return createSourceNode(node, [
        "new ",
        toSourceNode(node.expr, illegalNames),
        "(",
        ...node.args.flatMap((arg) => [toSourceNode(arg, illegalNames), ","]),
        ")",
      ]);
    } else if (isArgument(node)) {
      return toSourceNode(node.expr, illegalNames);
    } else if (isUndefinedLiteralExpr(node)) {
      return createSourceNode(node, "undefined");
    } else if (isNullLiteralExpr(node)) {
      return createSourceNode(node, "null");
    } else if (isBooleanLiteralExpr(node)) {
      return createSourceNode(node, node.value ? "true" : "false");
    } else if (isNumberLiteralExpr(node)) {
      return createSourceNode(node, node.value.toString(10));
    } else if (isBigIntExpr(node)) {
      return createSourceNode(node, `${node.value.toString(10)}n`);
    } else if (isStringLiteralExpr(node)) {
      return createSourceNode(node, stringExpr(node.value));
    } else if (isArrayLiteralExpr(node)) {
      return createSourceNode(node, [
        "[",
        ...node.items.flatMap((item) => [
          toSourceNode(item, illegalNames),
          ",",
        ]),
        "]",
      ]);
    } else if (isSpreadElementExpr(node)) {
      return createSourceNode(node, [
        "...",
        toSourceNode(node.expr, illegalNames),
      ]);
    } else if (isObjectLiteralExpr(node)) {
      return createSourceNode(node, [
        "{",
        ...commaSeparatedListSourceNode(node.properties, illegalNames),
        "}",
      ]);
    } else if (isPropAssignExpr(node)) {
      return createSourceNode(node, [
        toSourceNode(node.name, illegalNames),
        ":",
        toSourceNode(node.expr, illegalNames),
      ]);
    } else if (isSpreadAssignExpr(node)) {
      return createSourceNode(node, [
        "...",
        toSourceNode(node.expr, illegalNames),
      ]);
    } else if (isComputedPropertyNameExpr(node)) {
      return createSourceNode(node, [
        "[",
        toSourceNode(node.expr, illegalNames),
        "]",
      ]);
    } else if (isOmittedExpr(node)) {
      return createSourceNode(node, "");
    } else if (isVariableStmt(node)) {
      return toSourceNode(node.declList, illegalNames);
    } else if (isVariableDeclList(node)) {
      return createSourceNode(node, [
        node.varKind === VariableDeclKind.Const
          ? "const"
          : node.varKind === VariableDeclKind.Let
          ? "let"
          : "var",
        " ",
        ...node.decls.flatMap((decl, i) => [
          toSourceNode(decl, illegalNames),
          ...(i < node.decls.length - 1 ? [","] : []),
        ]),
      ]);
    } else if (isVariableDecl(node)) {
      return createSourceNode(node, [
        toSourceNode(node.name, illegalNames),
        ...(node.initializer
          ? ["=", toSourceNode(node.initializer, illegalNames)]
          : []),
      ]);
    } else if (isBindingElem(node)) {
      return createSourceNode(node, [
        ...(node.rest ? ["..."] : []),
        ...(node.propertyName
          ? [toSourceNode(node.propertyName, illegalNames), ":"]
          : []),
        toSourceNode(node.name, illegalNames),
        ...(node.initializer
          ? ["=", toSourceNode(node.initializer, illegalNames)]
          : []),
      ]);
    } else if (isObjectBinding(node)) {
      return createSourceNode(node, [
        "{",
        ...commaSeparatedListSourceNode(node.bindings, illegalNames),
        "}",
      ]);
    } else if (isArrayBinding(node)) {
      return createSourceNode(node, [
        "[",
        ...commaSeparatedListSourceNode(node.bindings, illegalNames),
        "]",
      ]);
    } else if (isClassDecl(node) || isClassExpr(node)) {
      return createSourceNode(node, [
        "class ",
        ...(node.name ? [toSourceNode(node.name, illegalNames)] : []),
        ...(node.heritage
          ? [" extends ", toSourceNode(node.heritage, illegalNames)]
          : []),
        "{\n",
        ...node.members.flatMap((member) => [
          toSourceNode(member, illegalNames),
          "\n",
        ]),
        "}",
      ]);
    } else if (isClassStaticBlockDecl(node)) {
      return createSourceNode(node, [
        "static ",
        toSourceNode(node.block, illegalNames),
      ]);
    } else if (isConstructorDecl(node)) {
      return createSourceNode(node, [
        "constructor(",
        ...node.parameters.flatMap((param, i) => [
          toSourceNode(param, illegalNames),
          ...(i < node.parameters.length ? [","] : []),
        ]),
        ")",
        toSourceNode(node.body, illegalNames),
      ]);
    } else if (isPropDecl(node)) {
      return createSourceNode(node, [
        ...(node.isStatic ? ["static "] : [""]),
        toSourceNode(node.name, illegalNames),
        ...(node.initializer
          ? [" = ", toSourceNode(node.initializer, illegalNames)]
          : []),
      ]);
    } else if (isMethodDecl(node)) {
      return createSourceNode(node, [
        ...(node.isAsync ? [" async "] : []),
        ...(node.isAsterisk ? ["*"] : []),
        toSourceNode(node.name, illegalNames),
        "(",
        ...commaSeparatedListSourceNode(node.parameters, illegalNames),
        ")",
        toSourceNode(node.body, illegalNames),
      ]);
    } else if (isGetAccessorDecl(node)) {
      return createSourceNode(node, [
        "get ",
        toSourceNode(node.name, illegalNames),
        "()",
        toSourceNode(node.body, illegalNames),
      ]);
    } else if (isSetAccessorDecl(node)) {
      return createSourceNode(node, [
        "set ",
        toSourceNode(node.name, illegalNames),
        "(",
        ...(node.parameter ? [toSourceNode(node.parameter, illegalNames)] : []),
        ")",
        toSourceNode(node.body, illegalNames),
      ]);
    } else if (isExprStmt(node)) {
      return createSourceNode(node, [
        toSourceNode(node.expr, illegalNames),
        ";",
      ]);
    } else if (isAwaitExpr(node)) {
      return createSourceNode(node, [
        "await ",
        toSourceNode(node.expr, illegalNames),
      ]);
    } else if (isYieldExpr(node)) {
      return createSourceNode(node, [
        "yield",
        ...(node.delegate ? ["*"] : []),
        " ",
        toSourceNode(node.expr, illegalNames),
      ]);
    } else if (isUnaryExpr(node)) {
      return createSourceNode(node, [
        node.op,
        toSourceNode(node.expr, illegalNames),
      ]);
    } else if (isPostfixUnaryExpr(node)) {
      return createSourceNode(node, [
        toSourceNode(node.expr, illegalNames),
        node.op,
      ]);
    } else if (isBinaryExpr(node)) {
      return createSourceNode(node, [
        toSourceNode(node.left, illegalNames),
        " ",
        node.op,
        " ",
        toSourceNode(node.right, illegalNames),
      ]);
    } else if (isConditionExpr(node)) {
      return createSourceNode(node, [
        toSourceNode(node.when, illegalNames),
        " ? ",
        toSourceNode(node.then, illegalNames),
        " : ",
        toSourceNode(node._else, illegalNames),
      ]);
    } else if (isIfStmt(node)) {
      return createSourceNode(node, [
        "if (",
        toSourceNode(node.when, illegalNames),
        ")",
        ...(isBlockStmt(node.then)
          ? [toSourceNode(node.then, illegalNames)]
          : [toSourceNode(node.then, illegalNames), ";"]),

        ...(node._else
          ? ["else ", toSourceNode(node._else, illegalNames)]
          : []),
      ]);
    } else if (isSwitchStmt(node)) {
      return createSourceNode(node, [
        "switch (",
        toSourceNode(node.expr, illegalNames),
        ") {\n",
        ...node.clauses.flatMap((clause) => [
          toSourceNode(clause, illegalNames),
          "\n",
        ]),
        "}",
      ]);
    } else if (isCaseClause(node)) {
      return createSourceNode(node, [
        "case ",
        toSourceNode(node.expr, illegalNames),
        ":",
        ...node.statements.flatMap((stmt) => [
          toSourceNode(stmt, illegalNames),
          "\n",
        ]),
      ]);
    } else if (isDefaultClause(node)) {
      return createSourceNode(node, [
        "default:\n",
        ...node.statements.flatMap((stmt) => [
          toSourceNode(stmt, illegalNames),
          "\n",
        ]),
      ]);
    } else if (isForStmt(node)) {
      return createSourceNode(node, [
        "for (",
        ...(node.initializer
          ? [toSourceNode(node.initializer, illegalNames)]
          : []),
        ";",
        ...(node.condition ? [toSourceNode(node.condition, illegalNames)] : []),
        ";",
        ...(node.incrementor
          ? [toSourceNode(node.incrementor, illegalNames)]
          : []),
        ")",
        toSourceNode(node.stmt, illegalNames),
      ]);
    } else if (isForOfStmt(node)) {
      return createSourceNode(node, [
        "for",
        ...(node.isAwait ? [" await "] : []),
        "(",
        toSourceNode(node.initializer, illegalNames),
        " of ",
        toSourceNode(node.expr, illegalNames),
        ")",
        toSourceNode(node.stmt, illegalNames),
      ]);
    } else if (isForInStmt(node)) {
      return createSourceNode(node, [
        "for",
        toSourceNode(node.initializer, illegalNames),
        " in ",
        toSourceNode(node.expr, illegalNames),
        ")",
        toSourceNode(node.stmt, illegalNames),
      ]);
    } else if (isWhileStmt(node)) {
      return createSourceNode(node, [
        "while (",
        toSourceNode(node.condition, illegalNames),
        ")",
        toSourceNode(node.stmt, illegalNames),
      ]);
    } else if (isDoStmt(node)) {
      return createSourceNode(node, [
        "do",
        toSourceNode(node.stmt, illegalNames),
        "while (",
        toSourceNode(node.condition, illegalNames),
        ");",
      ]);
    } else if (isBreakStmt(node)) {
      return createSourceNode(node, "break;");
    } else if (isContinueStmt(node)) {
      return createSourceNode(node, "continue;");
    } else if (isLabelledStmt(node)) {
      return createSourceNode(node, [
        `${node.label.name}:`,
        toSourceNode(node.stmt, illegalNames),
      ]);
    } else if (isTryStmt(node)) {
      return createSourceNode(node, [
        `try `,
        toSourceNode(node.tryBlock, illegalNames),
        ...(node.catchClause
          ? [toSourceNode(node.catchClause, illegalNames)]
          : []),
        ...(node.finallyBlock
          ? ["finally ", toSourceNode(node.finallyBlock, illegalNames)]
          : []),
      ]);
    } else if (isCatchClause(node)) {
      return createSourceNode(node, [
        `catch`,
        ...(node.variableDecl
          ? ["(", toSourceNode(node.variableDecl, illegalNames), ")"]
          : []),
        toSourceNode(node.block, illegalNames),
      ]);
    } else if (isThrowStmt(node)) {
      return createSourceNode(node, [
        `throw `,
        toSourceNode(node.expr, illegalNames),
        ";",
      ]);
    } else if (isDeleteExpr(node)) {
      return createSourceNode(node, [
        `delete `,
        toSourceNode(node.expr, illegalNames),
        ";",
      ]);
    } else if (isParenthesizedExpr(node)) {
      return createSourceNode(node, [
        `(`,
        toSourceNode(node.expr, illegalNames),
        ")",
      ]);
    } else if (isRegexExpr(node)) {
      return createSourceNode(node, [
        "/",
        node.regex.source,
        "/",
        node.regex.flags,
      ]);
    } else if (isTemplateExpr(node)) {
      return createSourceNode(node, [
        "`",
        node.head.text,
        ...node.spans.map((span) => toSourceNode(span, illegalNames)),
        "`",
      ]);
    } else if (isTaggedTemplateExpr(node)) {
      return createSourceNode(node, [
        toSourceNode(node.tag, illegalNames),
        toSourceNode(node.template, illegalNames),
      ]);
    } else if (isNoSubstitutionTemplateLiteral(node)) {
      return createSourceNode(node, ["`", node.text, "`"]);
    } else if (
      isTemplateHead(node) ||
      isTemplateMiddle(node) ||
      isTemplateTail(node)
    ) {
      return createSourceNode(node, node.text);
    } else if (isTemplateSpan(node)) {
      return createSourceNode(node, [
        createSourceNode(node, [
          "${",
          toSourceNode(node.expr, illegalNames),
          "}",
        ]),
        toSourceNode(node.literal, illegalNames),
      ]);
    } else if (isTypeOfExpr(node)) {
      return createSourceNode(node, [
        "typeof ",
        toSourceNode(node.expr, illegalNames),
      ]);
    } else if (isVoidExpr(node)) {
      return createSourceNode(node, [
        "void ",
        toSourceNode(node.expr, illegalNames),
      ]);
    } else if (isDebuggerStmt(node)) {
      return createSourceNode(node, "debugger;");
    } else if (isEmptyStmt(node)) {
      return createSourceNode(node, ";");
    } else if (isReturnStmt(node)) {
      return createSourceNode(
        node,
        node.expr
          ? ["return ", toSourceNode(node.expr, illegalNames), ";"]
          : "return;"
      );
    } else if (isImportKeyword(node)) {
      return createSourceNode(node, "import");
    } else if (isWithStmt(node)) {
      return createSourceNode(node, [
        "with(",
        toSourceNode(node.expr, illegalNames),
        ")",
        toSourceNode(node.stmt, illegalNames),
      ]);
    } else if (isErr(node)) {
      throw node.error;
    } else {
      return assertNever(node);
    }
  }

  function commaSeparatedListSourceNode(
    nodes: FunctionlessNode[],
    illegalNames: Set<string>
  ): (string | SourceNode)[] {
    return nodes.flatMap((node, i) => [
      toSourceNode(node, illegalNames),
      ...(i < nodes.length - 1 ? [","] : []),
    ]);
  }
}

/**
 * Heuristic for detecting whether a value is the require function.
 *
 * Detects both the intrinsic require and jest's patched require.
 */
function isRequire(a: any): boolean {
  return (
    a === require ||
    (typeof a === "function" && a.name === "bound requireModuleOrMock")
  );
}
