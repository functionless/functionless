import path from "path";
import ts from "typescript";

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export async function main() {
  const projectRoot = process.cwd();
  const tsConfig = {
    files: ["src/sdk-gen-aws.ts"],
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

  const AWSStmt = (
    program.getSourceFile("src/sdk-gen-aws.ts")
      ?.statements[1] as any as ts.VariableStatement
  ).declarationList.declarations[0]?.initializer!;
  const AWS = checker.getTypeAtLocation(AWSStmt);

  function getServiceType(type: ts.Type): ts.Type | undefined {
    const prototype = type.getProperty("prototype");
    if (prototype !== undefined) {
      const instanceType = checker.getTypeOfSymbolAtLocation(
        prototype,
        AWSStmt
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

  AWS.getProperties().flatMap((prop) => {
    const serviceName = prop.escapedName;
    const serviceClass = checker.getTypeOfSymbolAtLocation(prop, AWSStmt);
    const serviceInstance = getServiceType(serviceClass);
    if (serviceInstance) {
      serviceInstance.getProperties().map((method) => {
        const methodType = checker.getTypeOfSymbolAtLocation(method, AWSStmt);
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
              AWSStmt
            );
            const returnType = methodSignature.getReturnType();
            const promiseSym = returnType.getProperty("promise");
            if (promiseSym) {
              // promise(): PromiseResult<Response<Payload, AWSErr>>
              const promiseType = checker
                .getTypeOfSymbolAtLocation(promiseSym, AWSStmt)
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
                    AWSStmt
                  );

                  const responsePayloadType = checker.getTypeArguments(
                    responseType as ts.TypeReference
                  )[0];
                  if (responsePayloadType) {
                    responsePayloadType;
                    const fqn = checker.getFullyQualifiedName(
                      responsePayloadType.symbol
                    );
                    console.log(fqn);
                    if (fqn === "__type") {
                      // empty object {}
                    } else if (
                      checker.typeToString(responsePayloadType) === "any"
                    ) {
                      // ignore?
                    } else if (fqn.indexOf(".") !== -1) {
                      // <service-name>.<type-name>
                      fqn;
                    }
                  }
                }
              }
            }
          }
        }
      });
    }

    return [];
  });
}
