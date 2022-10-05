"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeProject = exports.FunctionlessNestedStack = exports.FunctionlessStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const constructs_1 = require("constructs");
const interface_1 = require("./interface");
const functionless_1 = require("functionless");
const functionless = __importStar(require("functionless"));
const visit_1 = require("functionless/lib/visit");
const logical_id_1 = require("./logical-id");
const bundle_lambda_1 = require("./bundle-lambda");
const util_1 = require("./util");
const file_1 = require("./tree/file");
const folder_1 = require("./tree/folder");
class FunctionlessStack extends aws_cdk_lib_1.Stack {
    allocateLogicalId(cfnElement) {
        return (0, logical_id_1.logicalIdForPath)(cfnElement.node.path);
    }
}
exports.FunctionlessStack = FunctionlessStack;
class FunctionlessNestedStack extends aws_cdk_lib_1.NestedStack {
    allocateLogicalId(cfnElement) {
        return (0, logical_id_1.logicalIdForPath)(cfnElement.node.path);
    }
}
exports.FunctionlessNestedStack = FunctionlessNestedStack;
async function synthesizeProject(project) {
    functionless.registerSubstitution(interface_1.StepFunction.waitSeconds, functionless.$SFN.waitFor);
    const app = new aws_cdk_lib_1.App({
        autoSynth: false,
    });
    const rootStack = new FunctionlessStack(app, project.projectName);
    await constructProject();
    connectProject(project, app);
    app.synth();
    async function constructProject() {
        for (const file of project.module.files) {
            if ((0, folder_1.isFolder)(file) && file._stack) {
                await synthesizeNode(app, file, undefined);
            }
            else {
                await synthesizeNode(rootStack, file, undefined);
            }
        }
    }
    async function synthesizeNode(scope, node, ctx, overrideId) {
        if ((0, file_1.isFile)(node)) {
            return synthesizeResource(scope, overrideId !== null && overrideId !== void 0 ? overrideId : node.name, node, ctx);
        }
        else {
            if (node._stack) {
                if (node.isSrcRoot) {
                    // Folders containing `_stack.ts` in a top-level folder are considered top-level stacks
                    // src/my-stack/_stack.ts => `my-stack` is a top-level stack
                    scope = new FunctionlessStack(app, overrideId !== null && overrideId !== void 0 ? overrideId : node.name);
                }
                else {
                    // src/my-stack/_stack.ts
                    //             /nested-stack/_stack.ts => `nested-stack` is nested within `my-stack`.
                    scope = new FunctionlessNestedStack(app, overrideId !== null && overrideId !== void 0 ? overrideId : node.name);
                }
            }
            else {
                // create a Construct to represent the Folder's scope
                scope = new constructs_1.Construct(scope, overrideId !== null && overrideId !== void 0 ? overrideId : node.name);
            }
            if (node._api) {
                // if this folder marks the beginning of a new RestApi, then instantiate the
                // RestApi Resource and set it as the surrounding scope and context of all children nodes.
                ctx = await synthesizeNode(scope, node._api, ctx);
            }
            const children = node.files.filter((file) => !["_api", "_stack"].includes(file.name));
            // synthesize all nodes that are not the `_stack` or `_api` special nodes
            for (const child of children) {
                await synthesizeNode(scope, child, ctx);
            }
            return scope;
        }
    }
    async function synthesizeResource(scope, id, file, ctx) {
        const construct = await _synthesizeResource(scope, id, file, ctx);
        if (construct instanceof constructs_1.Construct) {
            return construct;
        }
        else {
            functionless.registerSubstitution(file.resource, construct);
            // @ts-ignore
            return construct.resource;
        }
    }
    async function _synthesizeResource(scope, id, file, ctx) {
        if ((0, interface_1.isLambdaFunction)(file.resource)) {
            const outFolder = (0, bundle_lambda_1.getBundleOutFolder)(id);
            await (0, bundle_lambda_1.bundleLambdaFunction)(project, file.filePath, outFolder);
            const func = new aws_cdk_lib_1.aws_lambda.Function(scope, id, {
                runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_16_X,
                handler: "index.default",
                code: aws_cdk_lib_1.aws_lambda.Code.fromAsset(outFolder),
                environment: {
                    NODE_OPTIONS: "--enable-source-maps",
                },
            });
            func.addEnvironment("RESOURCE_ID", func.node.path);
            return functionless.Function.fromFunction(func);
        }
        else if ((0, interface_1.isStepFunction)(file.resource)) {
            return functionless.StepFunction.fromStateMachine(new aws_cdk_lib_1.aws_stepfunctions.StateMachine(scope, id, {
                ...file.resource.props,
                stateMachineType: aws_cdk_lib_1.aws_stepfunctions.StateMachineType.STANDARD,
                definition: new aws_cdk_lib_1.aws_stepfunctions.Pass(scope, "dummy"),
            }));
        }
        else if ((0, interface_1.isExpressStepFunction)(file.resource)) {
            return functionless.ExpressStepFunction.fromStateMachine(new aws_cdk_lib_1.aws_stepfunctions.StateMachine(scope, id, {
                ...file.resource.props,
                stateMachineType: aws_cdk_lib_1.aws_stepfunctions.StateMachineType.EXPRESS,
                definition: new aws_cdk_lib_1.aws_stepfunctions.Pass(scope, "dummy"),
            }));
        }
        else if ((0, interface_1.isTableDecl)(file.resource)) {
            return new functionless.Table(scope, id, file.resource.props);
            ``;
        }
        else if ((0, interface_1.isEventBus)(file.resource)) {
            return new functionless.EventBus(scope, id, file.resource.props);
            ``;
        }
        else if ((0, interface_1.isRestApi)(file.resource)) {
            return new aws_cdk_lib_1.aws_apigateway.RestApi(scope, id, file.resource.props);
            ``;
        }
        else if ((0, interface_1.isMethod)(file.resource)) {
            if (!(ctx instanceof aws_cdk_lib_1.aws_apigateway.RestApi)) {
                throw new Error(`cannot synthesize a Method outside the scope of a RestApi`);
            }
            const api = ctx;
            const handler = await synthesizeResource(scope, id, new file_1.File({
                ...file,
                resource: file.resource.handler,
            }), api);
            const resourcePath = formatResourcePath(api, handler);
            if (!((0, interface_1.isLambdaFunction)(file.resource.handler) ||
                (0, interface_1.isExpressStepFunction)(file.resource.handler))) {
                throw new Error(`Method handler must be a ${interface_1.LambdaFunctionKind} or ${interface_1.ExpressStepFunctionKind}, but was ${file.resource.handler.kind}`);
            }
            return api.root
                .resourceForPath(resourcePath)
                .addMethod(file.resource.props.httpMethod, (0, interface_1.isLambdaFunction)(file.resource.handler)
                ? new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(handler)
                : aws_cdk_lib_1.aws_apigateway.StepFunctionsIntegration.startExecution(handler));
        }
        throw new Error(`Resource not yet implemented: ${file.resource}`);
    }
}
exports.synthesizeProject = synthesizeProject;
function formatResourcePath(apiConstruct, handlerConstruct) {
    var _a, _b;
    const apiPath = (_a = apiConstruct.node.scope) === null || _a === void 0 ? void 0 : _a.node.path;
    if (!apiPath) {
        throw new Error("Expected a node path but found none.");
    }
    const handlerPath = (_b = handlerConstruct.node.scope) === null || _b === void 0 ? void 0 : _b.node.path;
    if (!handlerPath) {
        throw new Error("Expected a node path but found none.");
    }
    if (!handlerPath.startsWith(apiPath)) {
        throw new Error("Api and handler don't share a common root.");
    }
    const relativePath = handlerPath.replace(apiPath, "");
    return relativePath.replace(/\[/g, "{").replace(/\]/g, "}");
}
function synthesizeStepFunctionDefinition(resource, machine) {
    const decl = (0, functionless_1.validateFunctionLike)(resource.handler, resource.kind);
    try {
        const definition = new functionless_1.ASL(machine, machine.role, decl).definition;
        const resource = machine.node.findChild("Resource");
        resource.definitionString = aws_cdk_lib_1.Stack.of(resource).toJsonString(definition);
        return [definition, machine];
    }
    finally {
        // remove the dummy pass node because we don't need it.
        machine.node.tryRemoveChild("dummy");
    }
}
function synthesizeLambdaEnvironment(resource, lambdaFunction) {
    const ast = (0, functionless_1.validateFunctionLike)(resource.handler, resource.kind);
    (0, functionless_1.inferIamPolicies)(ast, lambdaFunction);
    const seen = new Set();
    (0, visit_1.forEachChild)(ast, function visit(node) {
        if ((0, functionless_1.isReferenceExpr)(node)) {
            let ref = node.ref();
            if (typeof ref === "function") {
                if (!seen.has(ref)) {
                    seen.add(ref);
                    const ast = (0, functionless_1.reflect)(ref);
                    if (ast) {
                        visit(ast);
                    }
                }
            }
            else {
                let resource = ref;
                if ((resource === null || resource === void 0 ? void 0 : resource.__esModule) === true && "default" in resource) {
                    resource = ref.default;
                }
                const construct = functionless.resolveSubstitution(resource);
                if (functionless.isTable(construct) ||
                    functionless.isFunction(construct) ||
                    functionless.isStepFunction(construct)) {
                    if (construct && !seen.has(construct)) {
                        const resourceID = construct.resource.node.path;
                        if (resourceID === undefined) {
                            console.error(`Could not look up Resource ID`, ref);
                            throw new Error(`Could not look up Resource ID`);
                        }
                        seen.add(construct);
                        const envKey = (0, util_1.getEnvironmentVariableName)(resourceID);
                        if (functionless.isTable(construct)) {
                            const table = construct.resource;
                            lambdaFunction.addEnvironment(`${envKey}_NAME`, table.tableName);
                            lambdaFunction.addEnvironment(`${envKey}_ARN`, table.tableArn);
                            lambdaFunction.addEnvironment("TODO", "TODO");
                        }
                        else if (functionless.isFunction(construct)) {
                            const func = construct.resource;
                            lambdaFunction.addEnvironment(`${envKey}_NAME`, func.functionName);
                            lambdaFunction.addEnvironment(`${envKey}_ARN`, func.functionArn);
                        }
                        else if (functionless.isStepFunction(construct)) {
                            const machine = construct.resource;
                            lambdaFunction.addEnvironment(`${envKey}_NAME`, machine.stateMachineName);
                            lambdaFunction.addEnvironment(`${envKey}_ARN`, machine.stateMachineArn);
                        }
                    }
                }
            }
        }
        (0, visit_1.forEachChild)(node, visit);
    });
}
function connectProject(project, scope) {
    if (scope instanceof aws_cdk_lib_1.aws_stepfunctions.StateMachine) {
        const resource = project.lookupResource(scope.node.path).resource;
        if ((0, interface_1.isMethod)(resource) &&
            ((0, interface_1.isStepFunction)(resource.handler) ||
                (0, interface_1.isExpressStepFunction)(resource.handler))) {
            synthesizeStepFunctionDefinition(resource.handler, scope);
        }
        else if ((0, interface_1.isStepFunction)(resource) || (0, interface_1.isExpressStepFunction)(resource)) {
            synthesizeStepFunctionDefinition(resource, scope);
        }
    }
    else if (scope instanceof aws_cdk_lib_1.aws_lambda.Function) {
        const resource = project.lookupResource(scope.node.path).resource;
        if ((0, interface_1.isMethod)(resource) && (0, interface_1.isLambdaFunction)(resource.handler)) {
            synthesizeLambdaEnvironment(resource.handler, scope);
        }
        else if ((0, interface_1.isLambdaFunction)(resource)) {
            synthesizeLambdaEnvironment(resource, scope);
        }
    }
    for (const child of scope.node.children) {
        connectProject(project, child);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ludGhlc2l6ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9zeW50aGVzaXplLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsNkNBUXFCO0FBQ3JCLDJDQUF1QztBQUN2QywyQ0FhcUI7QUFDckIsK0NBT3NCO0FBQ3RCLDJEQUE2QztBQUM3QyxrREFBc0Q7QUFDdEQsNkNBQWdEO0FBQ2hELG1EQUEyRTtBQUMzRSxpQ0FBb0Q7QUFFcEQsc0NBQTJDO0FBQzNDLDBDQUF5QztBQUV6QyxNQUFhLGlCQUFrQixTQUFRLG1CQUFLO0lBQ2hDLGlCQUFpQixDQUFDLFVBQXNCO1FBQ2hELE9BQU8sSUFBQSw2QkFBZ0IsRUFBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hELENBQUM7Q0FDRjtBQUpELDhDQUlDO0FBRUQsTUFBYSx1QkFBd0IsU0FBUSx5QkFBVztJQUM1QyxpQkFBaUIsQ0FBQyxVQUFzQjtRQUNoRCxPQUFPLElBQUEsNkJBQWdCLEVBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoRCxDQUFDO0NBQ0Y7QUFKRCwwREFJQztBQUVNLEtBQUssVUFBVSxpQkFBaUIsQ0FBQyxPQUFnQjtJQUN0RCxZQUFZLENBQUMsb0JBQW9CLENBQy9CLHdCQUFZLENBQUMsV0FBVyxFQUN4QixZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FDMUIsQ0FBQztJQUVGLE1BQU0sR0FBRyxHQUFHLElBQUksaUJBQUcsQ0FBQztRQUNsQixTQUFTLEVBQUUsS0FBSztLQUNqQixDQUFDLENBQUM7SUFDSCxNQUFNLFNBQVMsR0FBRyxJQUFJLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7SUFFbEUsTUFBTSxnQkFBZ0IsRUFBRSxDQUFDO0lBQ3pCLGNBQWMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFF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QWMsRUFBQyxRQUFRLENBQUMsT0FBTyxDQUFDO2dCQUMvQixJQUFBLGlDQUFxQixFQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUMxQztZQUNBLGdDQUFnQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDM0Q7YUFBTSxJQUFJLElBQUEsMEJBQWMsRUFBQyxRQUFRLENBQUMsSUFBSSxJQUFBLGlDQUFxQixFQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ3RFLGdDQUFnQyxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztTQUNuRDtLQUNGO1NBQU0sSUFBSSxLQUFLLFlBQVksd0JBQVUsQ0FBQyxRQUFRLEVBQUU7UUFDL0MsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQztRQUNsRSxJQUFJLElBQUEsb0JBQVEsRUFBQyxRQUFRLENBQUMsSUFBSSxJQUFBLDRCQUFnQixFQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUM1RCwyQkFBMkIsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ3REO2FBQU0sSUFBSSxJQUFBLDRCQUFnQixFQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ3JDLDJCQUEyQixDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztTQUM5QztLQUNGO0lBQ0QsS0FBSyxNQUFNLEtBQUssSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTtRQUN2QyxjQUFjLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ2hDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFByb2plY3QgfSBmcm9tIFwiLi9wcm9qZWN0XCI7XG5pbXBvcnQge1xuICBBcHAsXG4gIGF3c19hcGlnYXRld2F5LFxuICBhd3NfbGFtYmRhLFxuICBhd3Nfc3RlcGZ1bmN0aW9ucyxcbiAgQ2ZuRWxlbWVudCxcbiAgTmVzdGVkU3RhY2ssXG4gIFN0YWNrLFxufSBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQge1xuICBFeHByZXNzU3RlcEZ1bmN0aW9uLFxuICBFeHByZXNzU3RlcEZ1bmN0aW9uS2luZCxcbiAgaXNFdmVudEJ1cyxcbiAgaXNFeHByZXNzU3RlcEZ1bmN0aW9uLFxuICBpc0xhbWJkYUZ1bmN0aW9uLFxuICBpc01ldGhvZCxcbiAgaXNSZXN0QXBpLFxuICBpc1N0ZXBGdW5jdGlvbixcbiAgaXNUYWJsZURlY2wsXG4gIExhbWJkYUZ1bmN0aW9uLFxuICBMYW1iZGFGdW5jdGlvbktpbmQsXG4gIFN0ZXBGdW5jdGlvbixcbn0gZnJvbSBcIi4vaW50ZXJmYWNlXCI7XG5pbXBvcnQge1xuICBBU0wsXG4gIEZ1bmN0aW9ubGVzc05vZGUsXG4gIGluZmVySWFtUG9saWNpZXMsXG4gIGlzUmVmZXJlbmNlRXhwcixcbiAgcmVmbGVjdCxcbiAgdmFsaWRhdGVGdW5jdGlvbkxpa2UsXG59IGZyb20gXCJmdW5jdGlvbmxlc3NcIjtcbmltcG9ydCAqIGFzIGZ1bmN0aW9ubGVzcyBmcm9tIFwiZnVuY3Rpb25sZXNzXCI7XG5pbXBvcnQgeyBmb3JFYWNoQ2hpbGQgfSBmcm9tIFwiZnVuY3Rpb25sZXNzL2xpYi92aXNpdFwiO1xuaW1wb3J0IHsgbG9naWNhbElkRm9yUGF0aCB9IGZyb20gXCIuL2xvZ2ljYWwtaWRcIjtcbmltcG9ydCB7IGJ1bmRsZUxhbWJkYUZ1bmN0aW9uLCBnZXRCdW5kbGVPdXRGb2xkZXIgfSBmcm9tIFwiLi9idW5kbGUtbGFtYmRhXCI7XG5pbXBvcnQgeyBnZXRFbnZpcm9ubWVudFZhcmlhYmxlTmFtZSB9IGZyb20gXCIuL3V0aWxcIjtcbmltcG9ydCB7IFRyZWUgfSBmcm9tIFwiLi90cmVlL3RyZWVcIjtcbmltcG9ydCB7IGlzRmlsZSwgRmlsZSB9IGZyb20gXCIuL3RyZWUvZmlsZVwiO1xuaW1wb3J0IHsgaXNGb2xkZXIgfSBmcm9tIFwiLi90cmVlL2ZvbGRlclwiO1xuXG5leHBvcnQgY2xhc3MgRnVuY3Rpb25sZXNzU3RhY2sgZXh0ZW5kcyBTdGFjayB7XG4gIHByb3RlY3RlZCBhbGxvY2F0ZUxvZ2ljYWxJZChjZm5FbGVtZW50OiBDZm5FbGVtZW50KTogc3RyaW5nIHtcbiAgICByZXR1cm4gbG9naWNhbElkRm9yUGF0aChjZm5FbGVtZW50Lm5vZGUucGF0aCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZ1bmN0aW9ubGVzc05lc3RlZFN0YWNrIGV4dGVuZHMgTmVzdGVkU3RhY2sge1xuICBwcm90ZWN0ZWQgYWxsb2NhdGVMb2dpY2FsSWQoY2ZuRWxlbWVudDogQ2ZuRWxlbWVudCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGxvZ2ljYWxJZEZvclBhdGgoY2ZuRWxlbWVudC5ub2RlLnBhdGgpO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzeW50aGVzaXplUHJvamVjdChwcm9qZWN0OiBQcm9qZWN0KTogUHJvbWlzZTx2b2lkPiB7XG4gIGZ1bmN0aW9ubGVzcy5yZWdpc3RlclN1YnN0aXR1dGlvbihcbiAgICBTdGVwRnVuY3Rpb24ud2FpdFNlY29uZHMsXG4gICAgZnVuY3Rpb25sZXNzLiRTRk4ud2FpdEZvclxuICApO1xuXG4gIGNvbnN0IGFwcCA9IG5ldyBBcHAoe1xuICAgIGF1dG9TeW50aDogZmFsc2UsXG4gIH0pO1xuICBjb25zdCByb290U3RhY2sgPSBuZXcgRnVuY3Rpb25sZXNzU3RhY2soYXBwLCBwcm9qZWN0LnByb2plY3ROYW1lKTtcblxuICBhd2FpdCBjb25zdHJ1Y3RQcm9qZWN0KCk7XG4gIGNvbm5lY3RQcm9qZWN0KHByb2plY3QsIGFwcCk7XG5cbiAgYXBwLnN5bnRoKCk7XG5cbiAgYXN5bmMgZnVuY3Rpb24gY29uc3RydWN0UHJvamVjdCgpIHtcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgcHJvamVjdC5tb2R1bGUuZmlsZXMpIHtcbiAgICAgIGlmIChpc0ZvbGRlcihmaWxlKSAmJiBmaWxlLl9zdGFjaykge1xuICAgICAgICBhd2FpdCBzeW50aGVzaXplTm9kZShhcHAsIGZpbGUsIHVuZGVmaW5lZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBzeW50aGVzaXplTm9kZShyb290U3RhY2ssIGZpbGUsIHVuZGVmaW5lZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gc3ludGhlc2l6ZU5vZGUoXG4gICAgc2NvcGU6IENvbnN0cnVjdCxcbiAgICBub2RlOiBUcmVlLFxuICAgIGN0eDogQ29uc3RydWN0IHwgdW5kZWZpbmVkLFxuICAgIG92ZXJyaWRlSWQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxDb25zdHJ1Y3Q+IHtcbiAgICBpZiAoaXNGaWxlKG5vZGUpKSB7XG4gICAgICByZXR1cm4gc3ludGhlc2l6ZVJlc291cmNlKHNjb3BlLCBvdmVycmlkZUlkID8/IG5vZGUubmFtZSwgbm9kZSwgY3R4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG5vZGUuX3N0YWNrKSB7XG4gICAgICAgIGlmIChub2RlLmlzU3JjUm9vdCkge1xuICAgICAgICAgIC8vIEZvbGRlcnMgY29udGFpbmluZyBgX3N0YWNrLnRzYCBpbiBhIHRvcC1sZXZlbCBmb2xkZXIgYXJlIGNvbnNpZGVyZWQgdG9wLWxldmVsIHN0YWNrc1xuICAgICAgICAgIC8vIHNyYy9teS1zdGFjay9fc3RhY2sudHMgPT4gYG15LXN0YWNrYCBpcyBhIHRvcC1sZXZlbCBzdGFja1xuICAgICAgICAgIHNjb3BlID0gbmV3IEZ1bmN0aW9ubGVzc1N0YWNrKGFwcCwgb3ZlcnJpZGVJZCA/PyBub2RlLm5hbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHNyYy9teS1zdGFjay9fc3RhY2sudHNcbiAgICAgICAgICAvLyAgICAgICAgICAgICAvbmVzdGVkLXN0YWNrL19zdGFjay50cyA9PiBgbmVzdGVkLXN0YWNrYCBpcyBuZXN0ZWQgd2l0aGluIGBteS1zdGFja2AuXG4gICAgICAgICAgc2NvcGUgPSBuZXcgRnVuY3Rpb25sZXNzTmVzdGVkU3RhY2soYXBwLCBvdmVycmlkZUlkID8/IG5vZGUubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGNyZWF0ZSBhIENvbnN0cnVjdCB0byByZXByZXNlbnQgdGhlIEZvbGRlcidzIHNjb3BlXG4gICAgICAgIHNjb3BlID0gbmV3IENvbnN0cnVjdChzY29wZSwgb3ZlcnJpZGVJZCA/PyBub2RlLm5hbWUpO1xuICAgICAgfVxuXG4gICAgICBpZiAobm9kZS5fYXBpKSB7XG4gICAgICAgIC8vIGlmIHRoaXMgZm9sZGVyIG1hcmtzIHRoZSBiZWdpbm5pbmcgb2YgYSBuZXcgUmVzdEFwaSwgdGhlbiBpbnN0YW50aWF0ZSB0aGVcbiAgICAgICAgLy8gUmVzdEFwaSBSZXNvdXJjZSBhbmQgc2V0IGl0IGFzIHRoZSBzdXJyb3VuZGluZyBzY29wZSBhbmQgY29udGV4dCBvZiBhbGwgY2hpbGRyZW4gbm9kZXMuXG4gICAgICAgIGN0eCA9IGF3YWl0IHN5bnRoZXNpemVOb2RlKHNjb3BlLCBub2RlLl9hcGksIGN0eCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNoaWxkcmVuID0gbm9kZS5maWxlcy5maWx0ZXIoXG4gICAgICAgIChmaWxlKSA9PiAhW1wiX2FwaVwiLCBcIl9zdGFja1wiXS5pbmNsdWRlcyhmaWxlLm5hbWUpXG4gICAgICApO1xuXG4gICAgICAvLyBzeW50aGVzaXplIGFsbCBub2RlcyB0aGF0IGFyZSBub3QgdGhlIGBfc3RhY2tgIG9yIGBfYXBpYCBzcGVjaWFsIG5vZGVzXG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICAgIGF3YWl0IHN5bnRoZXNpemVOb2RlKHNjb3BlLCBjaGlsZCwgY3R4KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzY29wZTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBzeW50aGVzaXplUmVzb3VyY2UoXG4gICAgc2NvcGU6IENvbnN0cnVjdCxcbiAgICBpZDogc3RyaW5nLFxuICAgIGZpbGU6IEZpbGUsXG4gICAgY3R4OiBDb25zdHJ1Y3QgfCB1bmRlZmluZWRcbiAgKTogUHJvbWlzZTxDb25zdHJ1Y3Q+IHtcbiAgICBjb25zdCBjb25zdHJ1Y3QgPSBhd2FpdCBfc3ludGhlc2l6ZVJlc291cmNlKHNjb3BlLCBpZCwgZmlsZSwgY3R4KTtcbiAgICBpZiAoY29uc3RydWN0IGluc3RhbmNlb2YgQ29uc3RydWN0KSB7XG4gICAgICByZXR1cm4gY29uc3RydWN0O1xuICAgIH0gZWxzZSB7XG4gICAgICBmdW5jdGlvbmxlc3MucmVnaXN0ZXJTdWJzdGl0dXRpb24oZmlsZS5yZXNvdXJjZSwgY29uc3RydWN0KTtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIHJldHVybiBjb25zdHJ1Y3QucmVzb3VyY2U7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gX3N5bnRoZXNpemVSZXNvdXJjZShcbiAgICBzY29wZTogQ29uc3RydWN0LFxuICAgIGlkOiBzdHJpbmcsXG4gICAgZmlsZTogRmlsZSxcbiAgICBjdHg6IENvbnN0cnVjdCB8IHVuZGVmaW5lZFxuICApOiBQcm9taXNlPFN5bnRoZXNpemVkUmVzb3VyY2U+IHtcbiAgICBpZiAoaXNMYW1iZGFGdW5jdGlvbihmaWxlLnJlc291cmNlKSkge1xuICAgICAgY29uc3Qgb3V0Rm9sZGVyID0gZ2V0QnVuZGxlT3V0Rm9sZGVyKGlkKTtcbiAgICAgIGF3YWl0IGJ1bmRsZUxhbWJkYUZ1bmN0aW9uKHByb2plY3QsIGZpbGUuZmlsZVBhdGgsIG91dEZvbGRlcik7XG5cbiAgICAgIGNvbnN0IGZ1bmMgPSBuZXcgYXdzX2xhbWJkYS5GdW5jdGlvbihzY29wZSwgaWQsIHtcbiAgICAgICAgcnVudGltZTogYXdzX2xhbWJkYS5SdW50aW1lLk5PREVKU18xNl9YLFxuICAgICAgICBoYW5kbGVyOiBcImluZGV4LmRlZmF1bHRcIixcbiAgICAgICAgY29kZTogYXdzX2xhbWJkYS5Db2RlLmZyb21Bc3NldChvdXRGb2xkZXIpLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIE5PREVfT1BUSU9OUzogXCItLWVuYWJsZS1zb3VyY2UtbWFwc1wiLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBmdW5jLmFkZEVudmlyb25tZW50KFwiUkVTT1VSQ0VfSURcIiwgZnVuYy5ub2RlLnBhdGgpO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9ubGVzcy5GdW5jdGlvbi5mcm9tRnVuY3Rpb24oZnVuYyk7XG4gICAgfSBlbHNlIGlmIChpc1N0ZXBGdW5jdGlvbihmaWxlLnJlc291cmNlKSkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9ubGVzcy5TdGVwRnVuY3Rpb24uZnJvbVN0YXRlTWFjaGluZShcbiAgICAgICAgbmV3IGF3c19zdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZShzY29wZSwgaWQsIHtcbiAgICAgICAgICAuLi5maWxlLnJlc291cmNlLnByb3BzLFxuICAgICAgICAgIHN0YXRlTWFjaGluZVR5cGU6IGF3c19zdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZVR5cGUuU1RBTkRBUkQsXG4gICAgICAgICAgZGVmaW5pdGlvbjogbmV3IGF3c19zdGVwZnVuY3Rpb25zLlBhc3Moc2NvcGUsIFwiZHVtbXlcIiksXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH0gZWxzZSBpZiAoaXNFeHByZXNzU3RlcEZ1bmN0aW9uKGZpbGUucmVzb3VyY2UpKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb25sZXNzLkV4cHJlc3NTdGVwRnVuY3Rpb24uZnJvbVN0YXRlTWFjaGluZShcbiAgICAgICAgbmV3IGF3c19zdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZShzY29wZSwgaWQsIHtcbiAgICAgICAgICAuLi5maWxlLnJlc291cmNlLnByb3BzLFxuICAgICAgICAgIHN0YXRlTWFjaGluZVR5cGU6IGF3c19zdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZVR5cGUuRVhQUkVTUyxcbiAgICAgICAgICBkZWZpbml0aW9uOiBuZXcgYXdzX3N0ZXBmdW5jdGlvbnMuUGFzcyhzY29wZSwgXCJkdW1teVwiKSxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfSBlbHNlIGlmIChpc1RhYmxlRGVjbChmaWxlLnJlc291cmNlKSkge1xuICAgICAgcmV0dXJuIG5ldyBmdW5jdGlvbmxlc3MuVGFibGUoc2NvcGUsIGlkLCBmaWxlLnJlc291cmNlLnByb3BzKTtcbiAgICAgIGBgO1xuICAgIH0gZWxzZSBpZiAoaXNFdmVudEJ1cyhmaWxlLnJlc291cmNlKSkge1xuICAgICAgcmV0dXJuIG5ldyBmdW5jdGlvbmxlc3MuRXZlbnRCdXMoc2NvcGUsIGlkLCBmaWxlLnJlc291cmNlLnByb3BzKTtcbiAgICAgIGBgO1xuICAgIH0gZWxzZSBpZiAoaXNSZXN0QXBpKGZpbGUucmVzb3VyY2UpKSB7XG4gICAgICByZXR1cm4gbmV3IGF3c19hcGlnYXRld2F5LlJlc3RBcGkoc2NvcGUsIGlkLCBmaWxlLnJlc291cmNlLnByb3BzKTtcbiAgICAgIGBgO1xuICAgIH0gZWxzZSBpZiAoaXNNZXRob2QoZmlsZS5yZXNvdXJjZSkpIHtcbiAgICAgIGlmICghKGN0eCBpbnN0YW5jZW9mIGF3c19hcGlnYXRld2F5LlJlc3RBcGkpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgY2Fubm90IHN5bnRoZXNpemUgYSBNZXRob2Qgb3V0c2lkZSB0aGUgc2NvcGUgb2YgYSBSZXN0QXBpYFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgY29uc3QgYXBpID0gY3R4IGFzIGFueSBhcyBhd3NfYXBpZ2F0ZXdheS5SZXN0QXBpO1xuXG4gICAgICBjb25zdCBoYW5kbGVyID0gYXdhaXQgc3ludGhlc2l6ZVJlc291cmNlKFxuICAgICAgICBzY29wZSxcbiAgICAgICAgaWQsXG4gICAgICAgIG5ldyBGaWxlKHtcbiAgICAgICAgICAuLi5maWxlLFxuICAgICAgICAgIHJlc291cmNlOiBmaWxlLnJlc291cmNlLmhhbmRsZXIsXG4gICAgICAgIH0pLFxuICAgICAgICBhcGlcbiAgICAgICk7XG5cbiAgICAgIGNvbnN0IHJlc291cmNlUGF0aCA9IGZvcm1hdFJlc291cmNlUGF0aChhcGksIGhhbmRsZXIpO1xuXG4gICAgICBpZiAoXG4gICAgICAgICEoXG4gICAgICAgICAgaXNMYW1iZGFGdW5jdGlvbihmaWxlLnJlc291cmNlLmhhbmRsZXIpIHx8XG4gICAgICAgICAgaXNFeHByZXNzU3RlcEZ1bmN0aW9uKGZpbGUucmVzb3VyY2UuaGFuZGxlcilcbiAgICAgICAgKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgTWV0aG9kIGhhbmRsZXIgbXVzdCBiZSBhICR7TGFtYmRhRnVuY3Rpb25LaW5kfSBvciAke0V4cHJlc3NTdGVwRnVuY3Rpb25LaW5kfSwgYnV0IHdhcyAke2ZpbGUucmVzb3VyY2UuaGFuZGxlci5raW5kfWBcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGFwaS5yb290XG4gICAgICAgIC5yZXNvdXJjZUZvclBhdGgocmVzb3VyY2VQYXRoKVxuICAgICAgICAuYWRkTWV0aG9kKFxuICAgICAgICAgIGZpbGUucmVzb3VyY2UucHJvcHMuaHR0cE1ldGhvZCxcbiAgICAgICAgICBpc0xhbWJkYUZ1bmN0aW9uKGZpbGUucmVzb3VyY2UuaGFuZGxlcilcbiAgICAgICAgICAgID8gbmV3IGF3c19hcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGhhbmRsZXIgYXMgYW55KVxuICAgICAgICAgICAgOiBhd3NfYXBpZ2F0ZXdheS5TdGVwRnVuY3Rpb25zSW50ZWdyYXRpb24uc3RhcnRFeGVjdXRpb24oXG4gICAgICAgICAgICAgICAgaGFuZGxlciBhcyBhbnlcbiAgICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihgUmVzb3VyY2Ugbm90IHlldCBpbXBsZW1lbnRlZDogJHtmaWxlLnJlc291cmNlfWApO1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIFN5bnRoZXNpemVkUmVzb3VyY2UgPVxuICB8IGZ1bmN0aW9ubGVzcy5TdGVwRnVuY3Rpb248YW55LCBhbnk+XG4gIHwgZnVuY3Rpb25sZXNzLklTdGVwRnVuY3Rpb248YW55LCBhbnk+XG4gIHwgZnVuY3Rpb25sZXNzLkV4cHJlc3NTdGVwRnVuY3Rpb248YW55LCBhbnk+XG4gIHwgZnVuY3Rpb25sZXNzLklFeHByZXNzU3RlcEZ1bmN0aW9uPGFueSwgYW55PlxuICB8IGZ1bmN0aW9ubGVzcy5GdW5jdGlvbjxhbnksIGFueT5cbiAgfCBmdW5jdGlvbmxlc3MuVGFibGU8YW55LCBhbnksIGFueT5cbiAgfCBmdW5jdGlvbmxlc3MuRXZlbnRCdXM8YW55PlxuICB8IENvbnN0cnVjdDtcblxuZnVuY3Rpb24gZm9ybWF0UmVzb3VyY2VQYXRoKFxuICBhcGlDb25zdHJ1Y3Q6IGF3c19hcGlnYXRld2F5LklSZXN0QXBpLFxuICBoYW5kbGVyQ29uc3RydWN0OiBDb25zdHJ1Y3Rcbikge1xuICBjb25zdCBhcGlQYXRoID0gYXBpQ29uc3RydWN0Lm5vZGUuc2NvcGU/Lm5vZGUucGF0aDtcblxuICBpZiAoIWFwaVBhdGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBhIG5vZGUgcGF0aCBidXQgZm91bmQgbm9uZS5cIik7XG4gIH1cblxuICBjb25zdCBoYW5kbGVyUGF0aCA9IGhhbmRsZXJDb25zdHJ1Y3Qubm9kZS5zY29wZT8ubm9kZS5wYXRoO1xuXG4gIGlmICghaGFuZGxlclBhdGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBhIG5vZGUgcGF0aCBidXQgZm91bmQgbm9uZS5cIik7XG4gIH1cblxuICBpZiAoIWhhbmRsZXJQYXRoLnN0YXJ0c1dpdGgoYXBpUGF0aCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJBcGkgYW5kIGhhbmRsZXIgZG9uJ3Qgc2hhcmUgYSBjb21tb24gcm9vdC5cIik7XG4gIH1cblxuICBjb25zdCByZWxhdGl2ZVBhdGggPSBoYW5kbGVyUGF0aC5yZXBsYWNlKGFwaVBhdGgsIFwiXCIpO1xuXG4gIHJldHVybiByZWxhdGl2ZVBhdGgucmVwbGFjZSgvXFxbL2csIFwie1wiKS5yZXBsYWNlKC9cXF0vZywgXCJ9XCIpO1xufVxuXG5mdW5jdGlvbiBzeW50aGVzaXplU3RlcEZ1bmN0aW9uRGVmaW5pdGlvbihcbiAgcmVzb3VyY2U6IFN0ZXBGdW5jdGlvbiB8IEV4cHJlc3NTdGVwRnVuY3Rpb24sXG4gIG1hY2hpbmU6IGF3c19zdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZVxuKSB7XG4gIGNvbnN0IGRlY2wgPSB2YWxpZGF0ZUZ1bmN0aW9uTGlrZShyZXNvdXJjZS5oYW5kbGVyLCByZXNvdXJjZS5raW5kKTtcblxuICB0cnkge1xuICAgIGNvbnN0IGRlZmluaXRpb24gPSBuZXcgQVNMKG1hY2hpbmUsIG1hY2hpbmUucm9sZSwgZGVjbCkuZGVmaW5pdGlvbjtcblxuICAgIGNvbnN0IHJlc291cmNlID0gbWFjaGluZS5ub2RlLmZpbmRDaGlsZChcbiAgICAgIFwiUmVzb3VyY2VcIlxuICAgICkgYXMgYXdzX3N0ZXBmdW5jdGlvbnMuQ2ZuU3RhdGVNYWNoaW5lO1xuXG4gICAgcmVzb3VyY2UuZGVmaW5pdGlvblN0cmluZyA9IFN0YWNrLm9mKHJlc291cmNlKS50b0pzb25TdHJpbmcoZGVmaW5pdGlvbik7XG5cbiAgICByZXR1cm4gW2RlZmluaXRpb24sIG1hY2hpbmVdO1xuICB9IGZpbmFsbHkge1xuICAgIC8vIHJlbW92ZSB0aGUgZHVtbXkgcGFzcyBub2RlIGJlY2F1c2Ugd2UgZG9uJ3QgbmVlZCBpdC5cbiAgICBtYWNoaW5lLm5vZGUudHJ5UmVtb3ZlQ2hpbGQoXCJkdW1teVwiKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzeW50aGVzaXplTGFtYmRhRW52aXJvbm1lbnQoXG4gIHJlc291cmNlOiBMYW1iZGFGdW5jdGlvbixcbiAgbGFtYmRhRnVuY3Rpb246IGF3c19sYW1iZGEuRnVuY3Rpb25cbikge1xuICBjb25zdCBhc3QgPSB2YWxpZGF0ZUZ1bmN0aW9uTGlrZShyZXNvdXJjZS5oYW5kbGVyLCByZXNvdXJjZS5raW5kKTtcblxuICBpbmZlcklhbVBvbGljaWVzKGFzdCwgbGFtYmRhRnVuY3Rpb24pO1xuXG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XG4gIGZvckVhY2hDaGlsZChhc3QsIGZ1bmN0aW9uIHZpc2l0KG5vZGU6IEZ1bmN0aW9ubGVzc05vZGUpOiB2b2lkIHtcbiAgICBpZiAoaXNSZWZlcmVuY2VFeHByKG5vZGUpKSB7XG4gICAgICBsZXQgcmVmOiBhbnkgPSBub2RlLnJlZigpO1xuICAgICAgaWYgKHR5cGVvZiByZWYgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBpZiAoIXNlZW4uaGFzKHJlZikpIHtcbiAgICAgICAgICBzZWVuLmFkZChyZWYpO1xuICAgICAgICAgIGNvbnN0IGFzdCA9IHJlZmxlY3QocmVmKTtcbiAgICAgICAgICBpZiAoYXN0KSB7XG4gICAgICAgICAgICB2aXNpdChhc3QpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IHJlc291cmNlID0gcmVmO1xuICAgICAgICBpZiAocmVzb3VyY2U/Ll9fZXNNb2R1bGUgPT09IHRydWUgJiYgXCJkZWZhdWx0XCIgaW4gcmVzb3VyY2UpIHtcbiAgICAgICAgICByZXNvdXJjZSA9IHJlZi5kZWZhdWx0O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbnN0cnVjdCA9IGZ1bmN0aW9ubGVzcy5yZXNvbHZlU3Vic3RpdHV0aW9uKHJlc291cmNlKTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGZ1bmN0aW9ubGVzcy5pc1RhYmxlKGNvbnN0cnVjdCkgfHxcbiAgICAgICAgICBmdW5jdGlvbmxlc3MuaXNGdW5jdGlvbihjb25zdHJ1Y3QpIHx8XG4gICAgICAgICAgZnVuY3Rpb25sZXNzLmlzU3RlcEZ1bmN0aW9uKGNvbnN0cnVjdClcbiAgICAgICAgKSB7XG4gICAgICAgICAgaWYgKGNvbnN0cnVjdCAmJiAhc2Vlbi5oYXMoY29uc3RydWN0KSkge1xuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2VJRCA9IGNvbnN0cnVjdC5yZXNvdXJjZS5ub2RlLnBhdGg7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2VJRCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYENvdWxkIG5vdCBsb29rIHVwIFJlc291cmNlIElEYCwgcmVmKTtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgbG9vayB1cCBSZXNvdXJjZSBJRGApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2Vlbi5hZGQoY29uc3RydWN0KTtcbiAgICAgICAgICAgIGNvbnN0IGVudktleSA9IGdldEVudmlyb25tZW50VmFyaWFibGVOYW1lKHJlc291cmNlSUQpO1xuICAgICAgICAgICAgaWYgKGZ1bmN0aW9ubGVzcy5pc1RhYmxlKGNvbnN0cnVjdCkpIHtcbiAgICAgICAgICAgICAgY29uc3QgdGFibGUgPSBjb25zdHJ1Y3QucmVzb3VyY2U7XG4gICAgICAgICAgICAgIGxhbWJkYUZ1bmN0aW9uLmFkZEVudmlyb25tZW50KGAke2VudktleX1fTkFNRWAsIHRhYmxlLnRhYmxlTmFtZSk7XG4gICAgICAgICAgICAgIGxhbWJkYUZ1bmN0aW9uLmFkZEVudmlyb25tZW50KGAke2VudktleX1fQVJOYCwgdGFibGUudGFibGVBcm4pO1xuICAgICAgICAgICAgICBsYW1iZGFGdW5jdGlvbi5hZGRFbnZpcm9ubWVudChcIlRPRE9cIiwgXCJUT0RPXCIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChmdW5jdGlvbmxlc3MuaXNGdW5jdGlvbihjb25zdHJ1Y3QpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGZ1bmMgPSBjb25zdHJ1Y3QucmVzb3VyY2U7XG4gICAgICAgICAgICAgIGxhbWJkYUZ1bmN0aW9uLmFkZEVudmlyb25tZW50KFxuICAgICAgICAgICAgICAgIGAke2VudktleX1fTkFNRWAsXG4gICAgICAgICAgICAgICAgZnVuYy5mdW5jdGlvbk5hbWVcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgbGFtYmRhRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoYCR7ZW52S2V5fV9BUk5gLCBmdW5jLmZ1bmN0aW9uQXJuKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZnVuY3Rpb25sZXNzLmlzU3RlcEZ1bmN0aW9uKGNvbnN0cnVjdCkpIHtcbiAgICAgICAgICAgICAgY29uc3QgbWFjaGluZSA9IGNvbnN0cnVjdC5yZXNvdXJjZTtcbiAgICAgICAgICAgICAgbGFtYmRhRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoXG4gICAgICAgICAgICAgICAgYCR7ZW52S2V5fV9OQU1FYCxcbiAgICAgICAgICAgICAgICBtYWNoaW5lLnN0YXRlTWFjaGluZU5hbWVcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgbGFtYmRhRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoXG4gICAgICAgICAgICAgICAgYCR7ZW52S2V5fV9BUk5gLFxuICAgICAgICAgICAgICAgIG1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZvckVhY2hDaGlsZChub2RlLCB2aXNpdCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBjb25uZWN0UHJvamVjdChwcm9qZWN0OiBQcm9qZWN0LCBzY29wZTogQ29uc3RydWN0KSB7XG4gIGlmIChzY29wZSBpbnN0YW5jZW9mIGF3c19zdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZSkge1xuICAgIGNvbnN0IHJlc291cmNlID0gcHJvamVjdC5sb29rdXBSZXNvdXJjZShzY29wZS5ub2RlLnBhdGgpLnJlc291cmNlO1xuICAgIGlmIChcbiAgICAgIGlzTWV0aG9kKHJlc291cmNlKSAmJlxuICAgICAgKGlzU3RlcEZ1bmN0aW9uKHJlc291cmNlLmhhbmRsZXIpIHx8XG4gICAgICAgIGlzRXhwcmVzc1N0ZXBGdW5jdGlvbihyZXNvdXJjZS5oYW5kbGVyKSlcbiAgICApIHtcbiAgICAgIHN5bnRoZXNpemVTdGVwRnVuY3Rpb25EZWZpbml0aW9uKHJlc291cmNlLmhhbmRsZXIsIHNjb3BlKTtcbiAgICB9IGVsc2UgaWYgKGlzU3RlcEZ1bmN0aW9uKHJlc291cmNlKSB8fCBpc0V4cHJlc3NTdGVwRnVuY3Rpb24ocmVzb3VyY2UpKSB7XG4gICAgICBzeW50aGVzaXplU3RlcEZ1bmN0aW9uRGVmaW5pdGlvbihyZXNvdXJjZSwgc2NvcGUpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChzY29wZSBpbnN0YW5jZW9mIGF3c19sYW1iZGEuRnVuY3Rpb24pIHtcbiAgICBjb25zdCByZXNvdXJjZSA9IHByb2plY3QubG9va3VwUmVzb3VyY2Uoc2NvcGUubm9kZS5wYXRoKS5yZXNvdXJjZTtcbiAgICBpZiAoaXNNZXRob2QocmVzb3VyY2UpICYmIGlzTGFtYmRhRnVuY3Rpb24ocmVzb3VyY2UuaGFuZGxlcikpIHtcbiAgICAgIHN5bnRoZXNpemVMYW1iZGFFbnZpcm9ubWVudChyZXNvdXJjZS5oYW5kbGVyLCBzY29wZSk7XG4gICAgfSBlbHNlIGlmIChpc0xhbWJkYUZ1bmN0aW9uKHJlc291cmNlKSkge1xuICAgICAgc3ludGhlc2l6ZUxhbWJkYUVudmlyb25tZW50KHJlc291cmNlLCBzY29wZSk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgY2hpbGQgb2Ygc2NvcGUubm9kZS5jaGlsZHJlbikge1xuICAgIGNvbm5lY3RQcm9qZWN0KHByb2plY3QsIGNoaWxkKTtcbiAgfVxufVxuIl19