import fs from "fs";
import path from "path";
import ts from "typescript";
// eslint-disable-next-line import/no-extraneous-dependencies
import prettier from "prettier";

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Parses the types of the aws-sdk and generates `src/sdk.generated.ts`.
 */
export async function main() {
  const projectRoot = process.cwd();
  const tsConfig = {
    files: ["scripts/sdk-gen-aws.ts"],
    compilerOptions: {
      rootDir: ".",
    },
  };

  const commandLine = ts.parseJsonConfigFileContent(
    tsConfig,
    ts.sys,
    projectRoot
  );

  const compilerHost = ts.createCompilerHost(commandLine.options, true);

  const program = ts.createProgram(
    commandLine.fileNames,
    commandLine.options,
    compilerHost
  );

  const checker = program.getTypeChecker();

  const awsFile = program.getSourceFile("scripts/sdk-gen-aws.ts")!;
  const awsStmt = (awsFile.statements[1] as any as ts.VariableStatement)
    .declarationList.declarations[0]?.initializer!;
  const awsType = checker.getTypeAtLocation(awsStmt);

  function getServiceType(type: ts.Type): ts.Type | undefined {
    const prototype = type.getProperty("prototype");
    if (prototype !== undefined) {
      const instanceType = checker.getTypeOfSymbolAtLocation(
        prototype,
        awsStmt
      );
      if (instanceType.getBaseTypes()?.some(isService)) {
        return instanceType;
      }
    }
    return undefined;
  }

  function isService(type: ts.Type): boolean {
    return (
      checker.typeToString(type) === "Service" ||
      (type.getBaseTypes()?.some(isService) ?? false)
    );
  }

  const serviceNames: string[] = [];
  const interfaces = awsType
    .getProperties()
    .flatMap((prop) => {
      const serviceName = prop.escapedName as string;

      const serviceClass = checker.getTypeOfSymbolAtLocation(prop, awsStmt);
      const serviceInstance = getServiceType(serviceClass);
      if (serviceInstance) {
        serviceNames.push(serviceName);
        return [
          ts.factory.createInterfaceDeclaration(
            undefined,
            [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
            serviceName,
            undefined,
            undefined,
            serviceInstance.getProperties().flatMap((method) => {
              const methodName = method.name;
              const methodType = checker.getTypeOfSymbolAtLocation(
                method,
                awsStmt
              );
              const methodSignatures = methodType.getCallSignatures();
              if (methodSignatures.length > 0) {
                const methodSignature = methodSignatures.find(
                  (method) =>
                    method.parameters.length > 1 &&
                    method.parameters[0]?.escapedName === "params"
                );
                if (methodSignature) {
                  const paramsType = checker.getTypeOfSymbolAtLocation(
                    methodSignature.parameters[0]!,
                    awsStmt
                  );
                  const paramsFqn = checker.getFullyQualifiedName(
                    paramsType.symbol
                  );
                  const [paramsServiceName, paramsTypeName] = paramsFqn.split(
                    ".",
                    2
                  );
                  const returnType = methodSignature.getReturnType();
                  const promiseSym = returnType.getProperty("promise");
                  if (promiseSym) {
                    // promise(): PromiseResult<Response<Payload, AWSErr>>
                    const promiseType = checker
                      .getTypeOfSymbolAtLocation(promiseSym, awsStmt)
                      .getCallSignatures()[0]
                      ?.getReturnType();

                    if (promiseType) {
                      // PromiseResult<Response<Payload, AWSErr>>
                      const promiseResult = checker.getTypeArguments(
                        promiseType as ts.TypeReference
                      )[0];
                      const $response = promiseResult?.getProperty("$response");
                      if ($response) {
                        // Response<Payload, AWSErr>
                        const responseType = checker.getTypeOfSymbolAtLocation(
                          $response,
                          awsStmt
                        );

                        const responsePayloadType = checker.getTypeArguments(
                          responseType as ts.TypeReference
                        )[0];
                        if (responsePayloadType) {
                          responsePayloadType;
                          const responseFqn = checker.getFullyQualifiedName(
                            responsePayloadType.symbol
                          );
                          let type: ts.TypeNode;
                          if (responseFqn === "__type") {
                            // empty object {}
                            type = ts.factory.createTypeLiteralNode([]);
                          } else if (
                            checker.typeToString(responsePayloadType) === "any"
                          ) {
                            type = ts.factory.createKeywordTypeNode(
                              ts.SyntaxKind.AnyKeyword
                            );
                          } else if (responseFqn.indexOf(".") !== -1) {
                            // <service-name>.<type-name>
                            const [serviceName, typeName] = responseFqn.split(
                              ".",
                              2
                            );
                            type = ts.factory.createTypeReferenceNode(
                              ts.factory.createQualifiedName(
                                ts.factory.createQualifiedName(
                                  ts.factory.createIdentifier("AWS"),
                                  ts.factory.createIdentifier(serviceName!)
                                ),
                                ts.factory.createIdentifier(typeName!)
                              )
                            );
                          } else {
                            return [];
                          }

                          const methodSig = ts.factory.createMethodSignature(
                            undefined,
                            methodName,
                            undefined,
                            undefined,
                            [
                              ts.factory.createParameterDeclaration(
                                undefined,
                                undefined,
                                undefined,
                                "input",
                                undefined,
                                ts.factory.createTypeReferenceNode(
                                  ts.factory.createQualifiedName(
                                    ts.factory.createQualifiedName(
                                      ts.factory.createIdentifier("AWS"),
                                      ts.factory.createIdentifier(
                                        paramsServiceName!
                                      )
                                    ),
                                    ts.factory.createIdentifier(paramsTypeName!)
                                  )
                                )
                              ),
                              ts.factory.createParameterDeclaration(
                                undefined,
                                undefined,
                                undefined,
                                "options",
                                undefined,
                                ts.factory.createTypeReferenceNode(
                                  "SdkCallOptions"
                                )
                              ),
                            ],
                            ts.factory.createTypeReferenceNode("Promise", [
                              type,
                            ])
                          );

                          const commentText = ts.displayPartsToString(
                            method.getDocumentationComment(checker)
                          );

                          if (commentText) {
                            ts.addSyntheticLeadingComment(
                              methodSig,
                              ts.SyntaxKind.MultiLineCommentTrivia,
                              `*\n* ${commentText}\n`,
                              true
                            );
                          }
                          return [methodSig];
                        }
                      }
                    }
                  }
                }
              }

              return [];
            })
          ),
        ];
      }

      return [];
    })
    .sort((ifaceA, ifaceB) => ifaceA.name.text.localeCompare(ifaceB.name.text));

  const sourceFile = ts.factory.createSourceFile(
    [
      ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(
          true,
          ts.factory.createIdentifier("AWS"),
          undefined
        ),
        ts.factory.createStringLiteral("aws-sdk"),
        undefined
      ),
      // import {SdkCallOptions} from "./types";
      ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(
          true,
          undefined,
          ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(
              false,
              undefined,
              ts.factory.createIdentifier("SdkCallOptions")
            ),
          ])
        ),
        ts.factory.createStringLiteral("./types"),
        undefined
      ),
      ts.factory.createInterfaceDeclaration(
        undefined,
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        "SDK",
        undefined,
        undefined,
        serviceNames
          .sort()
          .map((serviceName) =>
            ts.factory.createPropertySignature(
              [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
              ts.factory.createIdentifier(serviceName),
              undefined,
              ts.factory.createTypeReferenceNode(serviceName)
            )
          )
      ),
      ...interfaces,
    ],
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.JavaScriptFile
  );

  const printer = ts.createPrinter();

  const text = prettier.format(printer.printFile(sourceFile), {
    parser: "typescript",
  });

  await fs.promises.writeFile(
    path.join(__dirname, "..", "src", "sdk.generated.ts"),
    text
  );
}
