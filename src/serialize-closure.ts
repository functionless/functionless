import fs from "fs";
import path from "path";
import util from "util";
import esbuild from "esbuild";
import ts from "typescript";

import { assertNever } from "./assert";
import {
  ClassDecl,
  FunctionLike,
  GetAccessorDecl,
  MethodDecl,
  SetAccessorDecl,
  VariableDeclKind,
} from "./declaration";
import { BinaryOp, ClassExpr } from "./expression";
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
} from "./guards";
import { FunctionlessNode } from "./node";
import { reflect, reverseProxy, unbind } from "./reflect";
import { Globals } from "./serialize-globals";
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
} from "./serialize-util";
import { AnyClass, AnyFunction } from "./util";

export interface SerializeClosureProps extends esbuild.BuildOptions {
  /**
   * Whether to favor require statements and es-build's tree-shaking over a pure
   * traversal of the in-memory graph.
   *
   * @default true
   */
  useESBuild?: boolean;

  /**
   * A function to prevent serialization of certain objects captured during the serialization.  Primarily used to
   * prevent potential cycles.
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
 * Serialize a closure to a bundle that can be remotely executed.
 * @param func
 * @param options ES Build options.
 * @returns a string
 */
export function serializeClosure(
  func: AnyFunction,
  options?: SerializeClosureProps
): string {
  interface RequiredModule {
    path: string;
    exportName?: string;
    exportValue: any;
    module: NodeModule;
  }

  const requireCache = new Map<any, RequiredModule>(
    Object.entries(require.cache).flatMap(([path, module]) => {
      try {
        return [
          [
            module?.exports as any,
            <RequiredModule>{
              path: module?.path,
              exportName: undefined,
              exportValue: module?.exports,
              module,
            },
          ],
          ...(Object.entries(
            Object.getOwnPropertyDescriptors(module?.exports ?? {})
          ).map(([exportName, exportValue]) => {
            try {
              return [
                exportValue.value,
                <RequiredModule>{
                  path,
                  exportName,
                  exportValue: exportValue.value,
                  module: module,
                },
              ];
            } catch (err) {
              throw err;
            }
          }) as [any, RequiredModule][]),
        ];
      } catch (err) {
        throw err;
      }
    })
  );

  let i = 0;
  const uniqueName = (scope?: FunctionlessNode) => {
    const names = scope?.getLexicalScope();
    let name;
    do {
      name = `v${i++}`;
    } while (names?.has(name));
    return name;
  };

  const statements: ts.Statement[] = [];

  // stores a map of value to a ts.Expression producing that value
  const valueIds = new Map<any, ts.Expression>();

  const singleton = (() => {
    return function <T extends ts.Expression>(value: any, produce: () => T): T {
      // optimize for number of map get/set operations as this is hot code
      let expr = valueIds.get(value);
      if (expr === undefined) {
        expr = produce();
        valueIds.set(value, expr);
      }
      return expr as T;
    };
  })();

  // stores a map of a `<variable-id>` to a ts.Identifier pointing to the unique location of that variable
  const referenceIds = new Map<string, ts.Identifier>();
  // map ReferenceExpr (syntactically) to the Closure Instance ID
  const referenceInstanceIDs = new Map<number, number>();

  const f = serialize(func);
  emit(
    exprStmt(
      assignExpr(
        propAccessExpr(idExpr("exports"), "handler"),
        options?.isFactoryFunction ? callExpr(f, []) : f
      )
    )
  );

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });

  const sourceFile = ts.factory.createSourceFile(
    statements,
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.JavaScriptFile
  );

  // looks like TS does not expose the source-map functionality
  // TODO: figure out how to generate a source map since we have all the information ...
  const script = printer.printFile(sourceFile);

  if (options?.useESBuild === false) {
    return script;
  } else {
    try {
      const bundle = esbuild.buildSync({
        stdin: {
          contents: script,
          resolveDir: process.cwd(),
        },
        bundle: true,
        write: false,
        metafile: true,
        platform: "node",
        target: "node14",
        external: [
          "aws-sdk",
          "aws-cdk-lib",
          "esbuild",
          ...(options?.external ?? []),
        ],
      });

      if (bundle.outputFiles[0] === undefined) {
        throw new Error("No output files after bundling with ES Build");
      }

      return bundle.outputFiles[0].text;
    } catch (err) {
      throw err;
    }
  }

  function emit(...stmts: ts.Statement[]) {
    statements.push(...stmts);
  }

  function emitVarDecl(
    varKind: "const" | "let" | "var",
    varName: string,
    expr?: ts.Expression | undefined
  ): ts.Identifier {
    emit(
      ts.factory.createVariableStatement(
        undefined,
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              varName,
              undefined,
              undefined,
              expr
            ),
          ],
          varKind === "var"
            ? ts.NodeFlags.None
            : varKind === "const"
            ? ts.NodeFlags.Const
            : ts.NodeFlags.Let
        )
      )
    );
    return ts.factory.createIdentifier(varName);
  }

  function emitRequire(mod: string) {
    // const vMod = require("module-name");
    return emitVarDecl(
      "const",
      uniqueName(),
      callExpr(idExpr("require"), [stringExpr(mod)])
    );
  }

  function getModuleId(jsFile: string): string {
    return findModuleName(path.dirname(jsFile));
    function findModuleName(dir: string): string {
      if (path.resolve(dir) === path.resolve(process.cwd())) {
        // reached the root workspace, import the absolute file path of the jsFile
        return jsFile;
      }
      const pkgJsonPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(
          fs.readFileSync(pkgJsonPath).toString("utf-8")
        );
        if (typeof pkgJson.name === "string") {
          return pkgJson.name;
        }
      }
      return findModuleName(path.join(dir, ".."));
    }
  }

  function serialize(value: any): ts.Expression {
    return valueIds.get(value) ?? serializeValue(value);
  }

  function serializeValue(value: any): ts.Expression {
    ts.SyntaxKind;
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
      return ts.factory.createBigIntLiteral(value.toString(10));
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
      if (options?.serialize) {
        const result = options.serialize(value);
        if (result === false) {
          return undefinedExpr();
        } else if (result === true) {
          return stringExpr(value);
        } else {
          return serialize(result);
        }
      }
      return stringExpr(value);
    } else if (value instanceof RegExp) {
      return singleton(value, () =>
        ts.factory.createRegularExpressionLiteral(
          `/${value.source}/${value.global ? "g" : ""}${
            value.ignoreCase ? "i" : ""
          }${value.multiline ? "m" : ""}`
        )
      );
    } else if (value instanceof Date) {
      return singleton(value, () =>
        ts.factory.createNewExpression(idExpr("Date"), undefined, [
          numberExpr(value.getTime()),
        ])
      );
    } else if (Array.isArray(value)) {
      // TODO: should we check the array's prototype?

      // emit an empty array
      // var vArr = []
      const arr = singleton(value, () =>
        emitVarDecl(
          "const",
          uniqueName(),
          ts.factory.createArrayLiteralExpression([])
        )
      );

      // for each item in the array, serialize the value and push it into the array
      // vArr.push(vItem1, vItem2)
      emit(
        exprStmt(callExpr(propAccessExpr(arr, "push"), value.map(serialize)))
      );

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
        return emitVarDecl("const", uniqueName(), Globals.get(value)!());
      }

      if (options?.serialize) {
        const result = options.serialize(value);
        if (!result) {
          // do not serialize
          return emitVarDecl("const", uniqueName(), undefinedExpr());
        } else if (value === true || typeof result === "object") {
          value = result;
        } else {
          return serialize(result);
        }
      }

      const mod = requireCache.get(value);

      if (mod && options?.useESBuild !== false) {
        return serializeModule(value, mod);
      }

      if (
        Object.hasOwn(value, "__defineGetter__") &&
        value !== Object.prototype
      ) {
        // heuristic to detect an Object that looks like the Object.prototype but isn't
        // we replace it with the actual Object.prototype since we don't know what to do
        // with its native functions.
        return serialize(Object.prototype);
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
      if (options?.serialize) {
        const result = options.serialize(value);
        if (result === false) {
          // do not serialize
          return undefinedExpr();
        } else if (result !== true) {
          value = result;
        }
      }

      if (Globals.has(value)) {
        return singleton(value, () =>
          emitVarDecl("const", uniqueName(), Globals.get(value)!())
        );
      }

      const exportedValue = requireCache.get(value);

      // if this is a reference to an exported value from a module
      // and we're using esbuild, then emit a require
      if (exportedValue && options?.useESBuild !== false) {
        return serializeModule(value, exportedValue);
      }

      // if this is a bound closure, try and reconstruct it from its components
      if (value.name.startsWith("bound ")) {
        const boundFunction = serializeBoundFunction(value);
        if (boundFunction) {
          return boundFunction;
        }
      }

      const ast = reflect(value);

      if (ast === undefined) {
        if (exportedValue) {
          return serializeModule(value, exportedValue);
        } else {
          return serializeUnknownFunction(value);
        }
      } else if (isFunctionLike(ast)) {
        return serializeFunction(value, ast);
      } else if (isClassDecl(ast) || isClassExpr(ast)) {
        return serializeClass(value, ast);
      } else if (isMethodDecl(ast)) {
        return serializeMethodAsFunction(ast);
      } else if (isErr(ast)) {
        throw ast.error;
      }
      throw new Error("not implemented");
    }

    // eslint-disable-next-line no-debugger
    throw new Error("not implemented");
  }

  function serializeModule(value: unknown, mod: RequiredModule) {
    const exports = mod.module?.exports;
    if (exports === undefined) {
      throw new Error(`undefined exports`);
    }
    const requireMod = singleton(exports, () =>
      emitRequire(getModuleId(mod.path))
    );
    return singleton(value, () =>
      emitVarDecl(
        "const",
        uniqueName(),
        mod.exportName ? propAccessExpr(requireMod, mod.exportName) : requireMod
      )
    );
  }

  function serializeFunction(value: AnyFunction, ast: FunctionLike) {
    // declare an empty var for this function
    const func = singleton(value, () => emitVarDecl("var", uniqueName()));

    emit(exprStmt(assignExpr(func, toTS(ast) as ts.Expression)));

    defineProperties(value, func);

    return func;
  }

  function serializeBoundFunction(func: AnyFunction) {
    const components = unbind(func);
    if (components) {
      const boundThis = serialize(components.boundThis);
      const boundArgs = serialize(components.boundArgs);
      const targetFuntion = serialize(components.targetFunction);

      return singleton(func, () =>
        emitVarDecl(
          "const",
          uniqueName(),
          callExpr(propAccessExpr(targetFuntion, "bind"), [
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
    } else if (
      value.toString() === `function ${value.name}() { [native code] }`
    ) {
      // eslint-disable-next-line no-debugger
    }

    // eslint-disable-next-line no-debugger
    throw new Error(
      `cannot serialize closures that were not compiled with Functionless unless they are exported by a module: ${func}`
    );
  }

  function serializeClass(
    classVal: AnyClass,
    classAST: ClassExpr | ClassDecl
  ): ts.Expression {
    // emit the class to the closure
    const classDecl = singleton(classVal, () =>
      emitVarDecl("var", uniqueName(classAST))
    );

    emit(exprStmt(assignExpr(classDecl, toTS(classAST) as ts.Expression)));

    monkeyPatch(classDecl, classVal, classVal, ["prototype"]);
    monkeyPatch(
      propAccessExpr(classDecl, "prototype"),
      classVal.prototype,
      classVal,
      ["constructor"]
    );

    return classDecl;
  }

  function defineProperties(
    value: unknown,
    expr: ts.Expression,
    ignore?: string[]
  ) {
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
    varName: ts.Expression,
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
              patched: ts.Expression;
              original?: never;
            }
          | {
              patched?: never;
              original: ts.Expression;
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
   * Serialize a {@link MethodDecl} as a {@link ts.FunctionExpression} so that it can be individually referenced.
   */
  function serializeMethodAsFunction(
    method: MethodDecl
  ): ts.FunctionExpression {
    return ts.factory.createFunctionExpression(
      method.isAsync
        ? [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)]
        : undefined,
      method.isAsterisk
        ? ts.factory.createToken(ts.SyntaxKind.AsteriskToken)
        : undefined,
      toTS(method.name) as ts.Identifier,
      undefined,
      method.parameters.map((param) => toTS(param) as ts.ParameterDeclaration),
      undefined,
      toTS(method.body) as ts.Block
    );
  }

  /**
   * Convert a {@link FunctionlessNode} into its TypeScript counter-part and set the Source Map Range.
   */
  function toTS(node: FunctionlessNode): ts.Node {
    const tsNode = _toTS(node);
    ts.setSourceMapRange(tsNode, {
      pos: node.span[0],
      end: node.span[1],
      source: undefined, // TODO: acquire this
    });
    return tsNode;
  }

  /**
   * Convert a {@link FunctionlessNode} into its TypeScript counter-part.
   */
  function _toTS(node: FunctionlessNode): ts.Node {
    if (isReferenceExpr(node)) {
      // get the set of ReferenceExpr instances for thisId
      let thisId = referenceInstanceIDs.get(node.thisId);
      thisId = thisId === undefined ? 0 : thisId + 1;
      referenceInstanceIDs.set(node.thisId, thisId);

      // a key that uniquely identifies the variable pointed to by this reference
      const varKey = `${node.getFileName()} ${node.name} ${node.id} ${thisId}`;

      // a ts.Identifier that uniquely references the memory location of this variable in the serialized closure
      let varId: ts.Identifier | undefined = referenceIds.get(varKey);
      if (varId === undefined) {
        const varName = uniqueName(node);
        varId = ts.factory.createIdentifier(varName);
        referenceIds.set(varKey, varId);

        const value = serialize(node.ref());

        // emit a unique variable with the current value
        emitVarDecl("var", varName, value);
      }
      return varId;
    } else if (isArrowFunctionExpr(node)) {
      return ts.factory.createArrowFunction(
        node.isAsync
          ? [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)]
          : undefined,
        undefined,
        node.parameters.map((param) => toTS(param) as ts.ParameterDeclaration),
        undefined,
        undefined,
        toTS(node.body) as ts.Block
      );
    } else if (isFunctionDecl(node)) {
      if (node.parent === undefined) {
        // if this is the root of a tree, then we must declare it as a FunctionExpression
        // so that it can be assigned to a variable in the serialized closure
        return ts.factory.createFunctionExpression(
          node.isAsync
            ? [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)]
            : undefined,
          node.isAsterisk
            ? ts.factory.createToken(ts.SyntaxKind.AsteriskToken)
            : undefined,
          node.name,
          undefined,
          node.parameters.map(
            (param) => toTS(param) as ts.ParameterDeclaration
          ),
          undefined,
          toTS(node.body) as ts.Block
        );
      } else {
        // if it's not the root, then maintain the FunctionDeclaration SyntaxKind
        return ts.factory.createFunctionDeclaration(
          undefined,
          node.isAsync
            ? [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)]
            : undefined,
          node.isAsterisk
            ? ts.factory.createToken(ts.SyntaxKind.AsteriskToken)
            : undefined,
          node.name,
          undefined,
          node.parameters.map(
            (param) => toTS(param) as ts.ParameterDeclaration
          ),
          undefined,
          toTS(node.body) as ts.Block
        );
      }
    } else if (isFunctionExpr(node)) {
      return ts.factory.createFunctionExpression(
        node.isAsync
          ? [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)]
          : undefined,
        node.isAsterisk
          ? ts.factory.createToken(ts.SyntaxKind.AsteriskToken)
          : undefined,
        node.name,
        undefined,
        node.parameters.map((param) => toTS(param) as ts.ParameterDeclaration),
        undefined,
        toTS(node.body) as ts.Block
      );
    } else if (isParameterDecl(node)) {
      return ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        node.isRest
          ? ts.factory.createToken(ts.SyntaxKind.DotDotDotToken)
          : undefined,
        toTS(node.name) as ts.BindingName,
        undefined,
        undefined,
        node.initializer ? (toTS(node.initializer) as ts.Expression) : undefined
      );
    } else if (isBlockStmt(node)) {
      return ts.factory.createBlock(
        node.statements.map((stmt) => toTS(stmt) as ts.Statement)
      );
    } else if (isThisExpr(node)) {
      return ts.factory.createThis();
    } else if (isSuperKeyword(node)) {
      return ts.factory.createSuper();
    } else if (isIdentifier(node)) {
      return ts.factory.createIdentifier(node.name);
    } else if (isPrivateIdentifier(node)) {
      return ts.factory.createPrivateIdentifier(node.name);
    } else if (isPropAccessExpr(node)) {
      return ts.factory.createPropertyAccessChain(
        toTS(node.expr) as ts.Expression,
        node.isOptional
          ? ts.factory.createToken(ts.SyntaxKind.QuestionDotToken)
          : undefined,
        toTS(node.name) as ts.MemberName
      );
    } else if (isElementAccessExpr(node)) {
      return ts.factory.createElementAccessChain(
        toTS(node.expr) as ts.Expression,
        node.isOptional
          ? ts.factory.createToken(ts.SyntaxKind.QuestionDotToken)
          : undefined,
        toTS(node.element) as ts.Expression
      );
    } else if (isCallExpr(node)) {
      return ts.factory.createCallExpression(
        toTS(node.expr) as ts.Expression,
        undefined,
        node.args.map((arg) => toTS(arg) as ts.Expression)
      );
    } else if (isNewExpr(node)) {
      return ts.factory.createNewExpression(
        toTS(node.expr) as ts.Expression,
        undefined,
        node.args.map((arg) => toTS(arg) as ts.Expression)
      );
    } else if (isArgument(node)) {
      return toTS(node.expr);
    } else if (isUndefinedLiteralExpr(node)) {
      return ts.factory.createIdentifier("undefined");
    } else if (isNullLiteralExpr(node)) {
      return ts.factory.createNull();
    } else if (isBooleanLiteralExpr(node)) {
      return node.value ? ts.factory.createTrue() : ts.factory.createFalse();
    } else if (isNumberLiteralExpr(node)) {
      return ts.factory.createNumericLiteral(node.value);
    } else if (isBigIntExpr(node)) {
      return ts.factory.createBigIntLiteral(node.value.toString(10));
    } else if (isStringLiteralExpr(node)) {
      return stringExpr(node.value);
    } else if (isArrayLiteralExpr(node)) {
      return ts.factory.createArrayLiteralExpression(
        node.items.map((item) => toTS(item) as ts.Expression),
        undefined
      );
    } else if (isSpreadElementExpr(node)) {
      return ts.factory.createSpreadElement(toTS(node.expr) as ts.Expression);
    } else if (isObjectLiteralExpr(node)) {
      return ts.factory.createObjectLiteralExpression(
        node.properties.map(
          (prop) => toTS(prop) as ts.ObjectLiteralElementLike
        ),
        undefined
      );
    } else if (isPropAssignExpr(node)) {
      return ts.factory.createPropertyAssignment(
        toTS(node.name) as ts.PropertyName,
        toTS(node.expr) as ts.Expression
      );
    } else if (isSpreadAssignExpr(node)) {
      return ts.factory.createSpreadElement(toTS(node.expr) as ts.Expression);
    } else if (isComputedPropertyNameExpr(node)) {
      return ts.factory.createComputedPropertyName(
        toTS(node.expr) as ts.Expression
      );
    } else if (isOmittedExpr(node)) {
      return ts.factory.createOmittedExpression();
    } else if (isVariableStmt(node)) {
      return ts.factory.createVariableStatement(
        undefined,
        toTS(node.declList) as ts.VariableDeclarationList
      );
    } else if (isVariableDeclList(node)) {
      return ts.factory.createVariableDeclarationList(
        node.decls.map((decl) => toTS(decl) as ts.VariableDeclaration),
        node.varKind === VariableDeclKind.Const
          ? ts.NodeFlags.Const
          : node.varKind === VariableDeclKind.Let
          ? ts.NodeFlags.Let
          : ts.NodeFlags.None
      );
    } else if (isVariableDecl(node)) {
      return ts.factory.createVariableDeclaration(
        toTS(node.name) as ts.BindingName,
        undefined,
        undefined,
        node.initializer ? (toTS(node.initializer) as ts.Expression) : undefined
      );
    } else if (isBindingElem(node)) {
      return ts.factory.createBindingElement(
        node.rest
          ? ts.factory.createToken(ts.SyntaxKind.DotDotDotToken)
          : undefined,
        node.propertyName
          ? (toTS(node.propertyName) as ts.PropertyName)
          : undefined,
        toTS(node.name) as ts.BindingName,
        node.initializer ? (toTS(node.initializer) as ts.Expression) : undefined
      );
    } else if (isObjectBinding(node)) {
      return ts.factory.createObjectBindingPattern(
        node.bindings.map((binding) => toTS(binding) as ts.BindingElement)
      );
    } else if (isArrayBinding(node)) {
      return ts.factory.createArrayBindingPattern(
        node.bindings.map((binding) => toTS(binding) as ts.BindingElement)
      );
    } else if (isClassDecl(node) || isClassExpr(node)) {
      return (
        isClassDecl(node) && node.parent !== undefined // if this is the root ClassDecl, it must be a ts.ClassExpression to be assigned to a variable
          ? ts.factory.createClassDeclaration
          : ts.factory.createClassExpression
      )(
        undefined,
        undefined,
        node.name?.name,
        undefined,
        node.heritage
          ? [
              ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
                ts.factory.createExpressionWithTypeArguments(
                  toTS(node.heritage) as ts.Expression,
                  []
                ),
              ]),
            ]
          : undefined,
        node.members.map((member) => toTS(member) as ts.ClassElement)
      );
    } else if (isClassStaticBlockDecl(node)) {
      return ts.factory.createClassStaticBlockDeclaration(
        undefined,
        undefined,
        toTS(node.block) as ts.Block
      );
    } else if (isConstructorDecl(node)) {
      return ts.factory.createConstructorDeclaration(
        undefined,
        undefined,
        node.parameters.map((param) => toTS(param) as ts.ParameterDeclaration),
        toTS(node.body) as ts.Block
      );
    } else if (isPropDecl(node)) {
      return ts.factory.createPropertyDeclaration(
        undefined,
        node.isStatic
          ? [ts.factory.createModifier(ts.SyntaxKind.StaticKeyword)]
          : undefined,
        toTS(node.name) as ts.PropertyName,
        undefined,
        undefined,
        node.initializer ? (toTS(node.initializer) as ts.Expression) : undefined
      );
    } else if (isMethodDecl(node)) {
      return ts.factory.createMethodDeclaration(
        undefined,
        node.isAsync
          ? [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)]
          : undefined,
        node.isAsterisk
          ? ts.factory.createToken(ts.SyntaxKind.AsteriskToken)
          : undefined,
        toTS(node.name) as ts.PropertyName,
        undefined,
        undefined,
        node.parameters.map((param) => toTS(param) as ts.ParameterDeclaration),
        undefined,
        toTS(node.body) as ts.Block
      );
    } else if (isGetAccessorDecl(node)) {
      return ts.factory.createGetAccessorDeclaration(
        undefined,
        undefined,
        toTS(node.name) as ts.PropertyName,
        [],
        undefined,
        toTS(node.body) as ts.Block
      );
    } else if (isSetAccessorDecl(node)) {
      return ts.factory.createSetAccessorDeclaration(
        undefined,
        undefined,
        toTS(node.name) as ts.PropertyName,
        node.parameter ? [toTS(node.parameter) as ts.ParameterDeclaration] : [],
        toTS(node.body) as ts.Block
      );
    } else if (isExprStmt(node)) {
      return ts.factory.createExpressionStatement(
        toTS(node.expr) as ts.Expression
      );
    } else if (isAwaitExpr(node)) {
      return ts.factory.createAwaitExpression(toTS(node.expr) as ts.Expression);
    } else if (isYieldExpr(node)) {
      if (node.delegate) {
        return ts.factory.createYieldExpression(
          ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
          node.expr
            ? (toTS(node.expr) as ts.Expression)
            : ts.factory.createIdentifier("undefined")
        );
      } else {
        return ts.factory.createYieldExpression(
          undefined,
          node.expr ? (toTS(node.expr) as ts.Expression) : undefined
        );
      }
    } else if (isUnaryExpr(node)) {
      return ts.factory.createPrefixUnaryExpression(
        node.op === "!"
          ? ts.SyntaxKind.ExclamationToken
          : node.op === "+"
          ? ts.SyntaxKind.PlusToken
          : node.op === "++"
          ? ts.SyntaxKind.PlusPlusToken
          : node.op === "-"
          ? ts.SyntaxKind.MinusToken
          : node.op === "--"
          ? ts.SyntaxKind.MinusMinusToken
          : node.op === "~"
          ? ts.SyntaxKind.TildeToken
          : assertNever(node.op),
        toTS(node.expr) as ts.Expression
      );
    } else if (isPostfixUnaryExpr(node)) {
      return ts.factory.createPostfixUnaryExpression(
        toTS(node.expr) as ts.Expression,
        node.op === "++"
          ? ts.SyntaxKind.PlusPlusToken
          : node.op === "--"
          ? ts.SyntaxKind.MinusMinusToken
          : assertNever(node.op)
      );
    } else if (isBinaryExpr(node)) {
      return ts.factory.createBinaryExpression(
        toTS(node.left) as ts.Expression,
        toTSOperator(node.op),
        toTS(node.right) as ts.Expression
      );
    } else if (isConditionExpr(node)) {
      return ts.factory.createConditionalExpression(
        toTS(node.when) as ts.Expression,
        undefined,
        toTS(node.then) as ts.Expression,
        undefined,
        toTS(node._else) as ts.Expression
      );
    } else if (isIfStmt(node)) {
      return ts.factory.createIfStatement(
        toTS(node.when) as ts.Expression,
        toTS(node.then) as ts.Statement,
        node._else ? (toTS(node._else) as ts.Statement) : undefined
      );
    } else if (isSwitchStmt(node)) {
      return ts.factory.createSwitchStatement(
        toTS(node.expr) as ts.Expression,
        ts.factory.createCaseBlock(
          node.clauses.map((clause) => toTS(clause) as ts.CaseOrDefaultClause)
        )
      );
    } else if (isCaseClause(node)) {
      return ts.factory.createCaseClause(
        toTS(node.expr) as ts.Expression,
        node.statements.map((stmt) => toTS(stmt) as ts.Statement)
      );
    } else if (isDefaultClause(node)) {
      return ts.factory.createDefaultClause(
        node.statements.map((stmt) => toTS(stmt) as ts.Statement)
      );
    } else if (isForStmt(node)) {
      return ts.factory.createForStatement(
        node.initializer
          ? (toTS(node.initializer) as ts.ForInitializer)
          : undefined,
        node.condition ? (toTS(node.condition) as ts.Expression) : undefined,
        node.incrementor
          ? (toTS(node.incrementor) as ts.Expression)
          : undefined,
        toTS(node.body) as ts.Statement
      );
    } else if (isForOfStmt(node)) {
      return ts.factory.createForOfStatement(
        node.isAwait
          ? ts.factory.createToken(ts.SyntaxKind.AwaitKeyword)
          : undefined,
        isVariableDecl(node.initializer)
          ? ts.factory.createVariableDeclarationList([
              toTS(node.initializer) as ts.VariableDeclaration,
            ])
          : (toTS(node.initializer) as ts.ForInitializer),
        toTS(node.expr) as ts.Expression,
        toTS(node.body) as ts.Statement
      );
    } else if (isForInStmt(node)) {
      return ts.factory.createForInStatement(
        isVariableDecl(node.initializer)
          ? ts.factory.createVariableDeclarationList([
              toTS(node.initializer) as ts.VariableDeclaration,
            ])
          : (toTS(node.initializer) as ts.ForInitializer),
        toTS(node.expr) as ts.Expression,
        toTS(node.body) as ts.Statement
      );
    } else if (isWhileStmt(node)) {
      return ts.factory.createWhileStatement(
        toTS(node.condition) as ts.Expression,
        toTS(node.block) as ts.Statement
      );
    } else if (isDoStmt(node)) {
      return ts.factory.createDoStatement(
        toTS(node.block) as ts.Statement,
        toTS(node.condition) as ts.Expression
      );
    } else if (isBreakStmt(node)) {
      return ts.factory.createBreakStatement(
        node.label ? (toTS(node.label) as ts.Identifier) : undefined
      );
    } else if (isContinueStmt(node)) {
      return ts.factory.createContinueStatement(
        node.label ? (toTS(node.label) as ts.Identifier) : undefined
      );
    } else if (isLabelledStmt(node)) {
      return ts.factory.createLabeledStatement(
        toTS(node.label) as ts.Identifier,
        toTS(node.stmt) as ts.Statement
      );
    } else if (isTryStmt(node)) {
      return ts.factory.createTryStatement(
        toTS(node.tryBlock) as ts.Block,
        node.catchClause
          ? (toTS(node.catchClause) as ts.CatchClause)
          : undefined,
        node.finallyBlock ? (toTS(node.finallyBlock) as ts.Block) : undefined
      );
    } else if (isCatchClause(node)) {
      return ts.factory.createCatchClause(
        node.variableDecl
          ? (toTS(node.variableDecl) as ts.VariableDeclaration)
          : undefined,
        toTS(node.block) as ts.Block
      );
    } else if (isThrowStmt(node)) {
      return ts.factory.createThrowStatement(toTS(node.expr) as ts.Expression);
    } else if (isDeleteExpr(node)) {
      return ts.factory.createDeleteExpression(
        toTS(node.expr) as ts.Expression
      );
    } else if (isParenthesizedExpr(node)) {
      return ts.factory.createParenthesizedExpression(
        toTS(node.expr) as ts.Expression
      );
    } else if (isRegexExpr(node)) {
      return ts.factory.createRegularExpressionLiteral(node.regex.toString());
    } else if (isTemplateExpr(node)) {
      return ts.factory.createTemplateExpression(
        toTS(node.head) as ts.TemplateHead,
        node.spans.map((span) => toTS(span) as ts.TemplateSpan)
      );
    } else if (isTaggedTemplateExpr(node)) {
      return ts.factory.createTaggedTemplateExpression(
        toTS(node.tag) as ts.Expression,
        undefined,
        toTS(node.template) as ts.TemplateLiteral
      );
    } else if (isNoSubstitutionTemplateLiteral(node)) {
      return ts.factory.createNoSubstitutionTemplateLiteral(node.text);
    } else if (isTemplateHead(node)) {
      return ts.factory.createTemplateHead(node.text);
    } else if (isTemplateSpan(node)) {
      return ts.factory.createTemplateSpan(
        toTS(node.expr) as ts.Expression,
        toTS(node.literal) as ts.TemplateMiddle | ts.TemplateTail
      );
    } else if (isTemplateMiddle(node)) {
      return ts.factory.createTemplateMiddle(node.text);
    } else if (isTemplateTail(node)) {
      return ts.factory.createTemplateTail(node.text);
    } else if (isTypeOfExpr(node)) {
      return ts.factory.createTypeOfExpression(
        toTS(node.expr) as ts.Expression
      );
    } else if (isVoidExpr(node)) {
      return ts.factory.createVoidExpression(toTS(node.expr) as ts.Expression);
    } else if (isDebuggerStmt(node)) {
      return ts.factory.createDebuggerStatement();
    } else if (isEmptyStmt(node)) {
      return ts.factory.createEmptyStatement();
    } else if (isReturnStmt(node)) {
      return ts.factory.createReturnStatement(
        node.expr ? (toTS(node.expr) as ts.Expression) : undefined
      );
    } else if (isImportKeyword(node)) {
      return ts.factory.createToken(ts.SyntaxKind.ImportKeyword);
    } else if (isWithStmt(node)) {
      return ts.factory.createWithStatement(
        toTS(node.expr) as ts.Expression,
        toTS(node.stmt) as ts.Statement
      );
    } else if (isErr(node)) {
      throw node.error;
    } else {
      return assertNever(node);
    }
  }
}

function toTSOperator(op: BinaryOp): ts.BinaryOperator {
  return op === "!="
    ? ts.SyntaxKind.ExclamationEqualsToken
    : op === "!=="
    ? ts.SyntaxKind.ExclamationEqualsEqualsToken
    : op === "=="
    ? ts.SyntaxKind.EqualsEqualsToken
    : op === "==="
    ? ts.SyntaxKind.EqualsEqualsEqualsToken
    : op === "%"
    ? ts.SyntaxKind.PercentToken
    : op === "%="
    ? ts.SyntaxKind.PercentEqualsToken
    : op === "&&"
    ? ts.SyntaxKind.AmpersandAmpersandToken
    : op === "&"
    ? ts.SyntaxKind.AmpersandAmpersandToken
    : op === "*"
    ? ts.SyntaxKind.AsteriskToken
    : op === "**"
    ? ts.SyntaxKind.AsteriskToken
    : op === "&&="
    ? ts.SyntaxKind.AmpersandAmpersandEqualsToken
    : op === "&="
    ? ts.SyntaxKind.AmpersandEqualsToken
    : op === "**="
    ? ts.SyntaxKind.AsteriskAsteriskEqualsToken
    : op === "*="
    ? ts.SyntaxKind.AsteriskEqualsToken
    : op === "+"
    ? ts.SyntaxKind.PlusToken
    : op === "+="
    ? ts.SyntaxKind.PlusEqualsToken
    : op === ","
    ? ts.SyntaxKind.CommaToken
    : op === "-"
    ? ts.SyntaxKind.MinusToken
    : op === "-="
    ? ts.SyntaxKind.MinusEqualsToken
    : op === "/"
    ? ts.SyntaxKind.SlashToken
    : op === "/="
    ? ts.SyntaxKind.SlashEqualsToken
    : op === "<"
    ? ts.SyntaxKind.LessThanToken
    : op === "<="
    ? ts.SyntaxKind.LessThanEqualsToken
    : op === "<<"
    ? ts.SyntaxKind.LessThanLessThanToken
    : op === "<<="
    ? ts.SyntaxKind.LessThanLessThanEqualsToken
    : op === "="
    ? ts.SyntaxKind.EqualsToken
    : op === ">"
    ? ts.SyntaxKind.GreaterThanToken
    : op === ">>"
    ? ts.SyntaxKind.GreaterThanGreaterThanToken
    : op === ">>>"
    ? ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken
    : op === ">="
    ? ts.SyntaxKind.GreaterThanEqualsToken
    : op === ">>="
    ? ts.SyntaxKind.GreaterThanGreaterThanEqualsToken
    : op === ">>>="
    ? ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken
    : op === "??"
    ? ts.SyntaxKind.QuestionQuestionToken
    : op === "??="
    ? ts.SyntaxKind.QuestionQuestionEqualsToken
    : op === "^"
    ? ts.SyntaxKind.CaretToken
    : op === "^="
    ? ts.SyntaxKind.CaretEqualsToken
    : op === "in"
    ? ts.SyntaxKind.InKeyword
    : op === "instanceof"
    ? ts.SyntaxKind.InstanceOfKeyword
    : op === "|"
    ? ts.SyntaxKind.BarToken
    : op === "||"
    ? ts.SyntaxKind.BarBarToken
    : op === "|="
    ? ts.SyntaxKind.BarEqualsToken
    : op === "||="
    ? ts.SyntaxKind.BarBarEqualsToken
    : assertNever(op);
}
