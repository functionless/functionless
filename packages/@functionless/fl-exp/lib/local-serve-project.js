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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localServeProject = void 0;
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const interface_1 = require("./interface");
const http_1 = __importDefault(require("http"));
const bundle_lambda_1 = require("./bundle-lambda");
const logical_id_1 = require("./logical-id");
const lambda_1 = __importDefault(require("aws-sdk/clients/lambda"));
const stepfunctions_1 = __importDefault(require("aws-sdk/clients/stepfunctions"));
const sts_1 = __importDefault(require("aws-sdk/clients/sts"));
const iam_1 = __importDefault(require("aws-sdk/clients/iam"));
const functionless_1 = require("functionless");
const credentials_1 = require("./credentials");
const util_1 = require("./util");
const file_1 = require("./tree/file");
const lambda = new lambda_1.default((0, credentials_1.getClientProps)());
const stepFunctions = new stepfunctions_1.default((0, credentials_1.getClientProps)());
const sts = new sts_1.default((0, credentials_1.getClientProps)());
const iam = new iam_1.default((0, credentials_1.getClientProps)());
function isLocalRunnableFunction(resource) {
    return ((0, interface_1.isLambdaFunction)(resource) ||
        (0, functionless_1.isStepFunction)(resource) ||
        (0, interface_1.isExpressStepFunction)(resource));
}
async function localServeProject(project) {
    const functionArns = new Map();
    await Promise.all(Object.values(project.module.tree).map(async (file) => {
        await setEnvironment(file);
        (await getFunctionArns(file)).forEach(([func, functionArn]) => functionArns.set(func, functionArn));
    }));
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.env.FL_LOCAL = "true";
    const app = (0, express_1.default)().use(express_1.default.json());
    Object.values(project.module.tree)
        .flatMap((stack) => Object.values(stack).flatMap((resource) => "_resource" in resource &&
        "kind" in resource._resource.resource &&
        resource._resource.resource.kind === "fl.RestApi"
        ? expandResourceTree(resource)
        : []))
        .forEach((r) => route(project, app, "", "", r, functionArns));
    http_1.default.createServer(app).listen(3000);
    console.log("server running on port 3000");
}
exports.localServeProject = localServeProject;
async function setEnvironment(node) {
    var _a;
    if ((0, file_1.isFile)(node)) {
        if ((0, interface_1.isTableDecl)(node.resource)) {
            const resourceId = node.address;
            const logicalId = (0, logical_id_1.logicalIdForPath)(resourceId);
            const envKey = (0, util_1.getEnvironmentVariableName)(resourceId);
            const tableArn = (_a = (await (0, logical_id_1.resolveStackDetail)(node.stackName, logicalId))) === null || _a === void 0 ? void 0 : _a.PhysicalResourceId;
            const tableName = path_1.default.basename(tableArn);
            process.env[`${envKey}_NAME`] = tableName;
            process.env[`${envKey}_ARN`] = tableArn;
        }
    }
    else {
        await Promise.all(node.files.map(setEnvironment));
    }
}
async function getRoleArn(resource, functionArn) {
    var _a;
    if ((0, interface_1.isLambdaFunction)(resource)) {
        const functionResponse = await lambda
            .getFunction({
            FunctionName: path_1.default.basename(functionArn),
        })
            .promise();
        return (_a = functionResponse.Configuration) === null || _a === void 0 ? void 0 : _a.Role;
    }
    else if ((0, functionless_1.isStepFunction)(resource) || (0, interface_1.isExpressStepFunction)(resource)) {
        const response = await stepFunctions
            .describeStateMachine({ stateMachineArn: functionArn })
            .promise();
        return response.roleArn;
    }
    return undefined;
}
async function getFunctionArns(node) {
    var _a, _b;
    if ((0, file_1.isFile)(node)) {
        if ((0, interface_1.isMethod)(node.resource)) {
            return getFunctionArns(node);
        }
        else if (isLocalRunnableFunction(node.resource)) {
            const logicalId = (0, logical_id_1.logicalIdForPath)(node.address);
            const functionArn = (_a = (await (0, logical_id_1.resolveStackDetail)(node.stackName, logicalId))) === null || _a === void 0 ? void 0 : _a.PhysicalResourceId;
            const roleArn = await getRoleArn(node.resource, functionArn);
            if (!roleArn) {
                console.error(`Couldn't get role arn for ${functionArn}`);
                return [];
            }
            const roleName = path_1.default.basename(roleArn);
            const [role, whoami] = await Promise.all([
                iam
                    .getRole({
                    RoleName: roleName,
                })
                    .promise(),
                sts.getCallerIdentity().promise(),
            ]);
            const assumeRolePolicyDocument = JSON.parse(decodeURIComponent(role.Role.AssumeRolePolicyDocument));
            const existing = (_b = assumeRolePolicyDocument.Statement) === null || _b === void 0 ? void 0 : _b.find((stmt) => whoami.Arn && stmt.Principal.AWS === whoami.Arn);
            if (!existing) {
                assumeRolePolicyDocument.Statement.push({
                    Action: "sts:AssumeRole",
                    Effect: "Allow",
                    Principal: {
                        AWS: whoami.Arn,
                    },
                });
                await iam
                    .updateAssumeRolePolicy({
                    RoleName: roleName,
                    PolicyDocument: JSON.stringify(assumeRolePolicyDocument),
                })
                    .promise();
                await (async function wait(waitTime) {
                    try {
                        await sts
                            .assumeRole({
                            RoleArn: roleArn,
                            RoleSessionName: "FL_LOCAL",
                        })
                            .promise();
                    }
                    catch (err) {
                        if (err.code === "AccessDenied") {
                            console.log(`waiting ${waitTime}ms for Role`);
                            await new Promise((resolve) => setTimeout(resolve, waitTime));
                            await wait(Math.min(waitTime * 1.5, 10 * 1000));
                        }
                    }
                })(100);
            }
            return [
                [
                    node.resource,
                    {
                        functionArn,
                        roleArn,
                    },
                ],
            ];
        }
        return [];
    }
    else {
        return (await Promise.all(node.files.map(getFunctionArns))).flat();
    }
}
function expandResourceTree(tree) {
    return Object.entries(tree).filter(([path]) => path != "_resource");
}
function expressifyPathSegment(segment) {
    return segment.replace(/\[(.*)\]/, ":$1");
}
async function route(project, router, id, path, [segment, resource], functionArns) {
    var _a;
    if ((0, file_1.isFile)(resource)) {
        if ((0, interface_1.isMethod)(resource.resource)) {
            if (isLocalRunnableFunction(resource.resource.handler)) {
                const isLambda = (0, interface_1.isLambdaFunction)(resource.resource.handler);
                const method = resource.resource;
                const handlers = {
                    GET: router.get,
                    POST: router.post,
                    PUT: router.put,
                    DELETE: router.delete,
                };
                console.log(`${path} - ${method.props.httpMethod}`);
                const outFolder = (0, bundle_lambda_1.getBundleOutFolder)(`${id}_${segment}`);
                const bundle = await (0, bundle_lambda_1.bundleLambdaFunction)(project, resource.filePath, outFolder, (_a = functionArns.get(resource.resource.handler)) === null || _a === void 0 ? void 0 : _a.roleArn);
                handlers[method.props.httpMethod].bind(router)(path, async (req, res) => {
                    try {
                        const { default: wrapper } = await Promise.resolve().then(() => __importStar(require(bundle)));
                        const event = {
                            body: JSON.stringify(req.body),
                            headers: req.headers,
                            httpMethod: req.method,
                            path,
                            queryStringParameters: req.query,
                            pathParameters: req.params,
                        };
                        if (isLambda) {
                            const result = await wrapper(event);
                            setExpressResult(res, result);
                        }
                        else {
                            const result = await wrapper.handler.handler(event);
                            setExpressResult(res, result);
                        }
                    }
                    catch (e) {
                        console.error(e);
                    }
                });
            }
        }
    }
    else {
        expandResourceTree(resource).forEach((r) => route(project, router, `${id ? `${id}_` : ""}${r[0]}`, `${path}/${expressifyPathSegment(segment)}`, r, functionArns));
    }
}
function setExpressResult(res, result) {
    res.status(result.statusCode);
    if (result.headers) {
        Object.entries(result.headers).forEach(([header, value]) => {
            res.header(header, value.toString());
        });
    }
    res.send(result.body);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWwtc2VydmUtcHJvamVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9sb2NhbC1zZXJ2ZS1wcm9qZWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsZ0RBQXdCO0FBQ3hCLHNEQUFvRDtBQUNwRCwyQ0FTcUI7QUFPckIsZ0RBQXdCO0FBQ3hCLG1EQUEyRTtBQUMzRSw2Q0FBb0U7QUFFcEUsb0VBQTRDO0FBQzVDLGtGQUEwRDtBQUMxRCw4REFBc0M7QUFDdEMsOERBQXNDO0FBQ3RDLCtDQUE4QztBQUM5QywrQ0FBK0M7QUFDL0MsaUNBQW9EO0FBRXBELHNDQUFxQztBQUVyQyxNQUFNLE1BQU0sR0FBRyxJQUFJLGdCQUFNLENBQUMsSUFBQSw0QkFBYyxHQUFFLENBQUMsQ0FBQztBQUM1QyxNQUFNLGFBQWEsR0FBRyxJQUFJLHVCQUFhLENBQUMsSUFBQSw0QkFBYyxHQUFFLENBQUMsQ0FBQztBQUUxRCxNQUFNLEdBQUcsR0FBRyxJQUFJLGFBQUcsQ0FBQyxJQUFBLDRCQUFjLEdBQUUsQ0FBQyxDQUFDO0FBRXRDLE1BQU0sR0FBRyxHQUFHLElBQUksYUFBRyxDQUFDLElBQUEsNEJBQWMsR0FBRSxDQUFDLENBQUM7QUFZdEMsU0FBUyx1QkFBdUIsQ0FDOUIsUUFBa0I7SUFFbEIsT0FBTyxDQUNMLElBQUEsNEJBQWdCLEVBQUMsUUFBUSxDQUFDO1FBQzFCLElBQUEsNkJBQWMsRUFBQyxRQUFRLENBQUM7UUFDeEIsSUFBQSxpQ0FBcUIsRUFBQyxRQUFRLENBQUMsQ0FDaEMsQ0FBQztBQUNKLENBQUM7QUFFTSxLQUFLLFVBQVUsaUJBQWlCLENBQUMsT0FBZ0I7SUFDdEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQTJDLENBQUM7SUFDeEUsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENB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SyxDQUNILE9BQU8sRUFDUCxNQUFNLEVBQ04sR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFDOUIsR0FBRyxJQUFJLElBQUkscUJBQXFCLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFDM0MsQ0FBQyxFQUNELFlBQVksQ0FDYixDQUNGLENBQUM7S0FDSDtBQUNILENBQUM7QUFDRCxTQUFTLGdCQUFnQixDQUFDLEdBQWtCLEVBQUUsTUFBNkI7SUFDekUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDOUIsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFO1FBQ2xCLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUU7WUFDekQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDdkMsQ0FBQyxDQUFDLENBQUM7S0FDSjtJQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IGV4cHJlc3MsIHsgUm91dGVyLCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQge1xuICBFeHByZXNzU3RlcEZ1bmN0aW9uLFxuICBpc0V4cHJlc3NTdGVwRnVuY3Rpb24sXG4gIGlzTGFtYmRhRnVuY3Rpb24sXG4gIGlzTWV0aG9kLFxuICBpc1RhYmxlRGVjbCxcbiAgTGFtYmRhRnVuY3Rpb24sXG4gIFJlc291cmNlLFxuICBTdGVwRnVuY3Rpb24sXG59IGZyb20gXCIuL2ludGVyZmFjZVwiO1xuaW1wb3J0IHsgUHJvamVjdCB9IGZyb20gXCIuL3Byb2plY3RcIjtcbmltcG9ydCB0eXBlIHtcbiAgQVBJR2F0ZXdheVByb3h5RXZlbnRRdWVyeVN0cmluZ1BhcmFtZXRlcnMsXG4gIEFQSUdhdGV3YXlQcm94eVJlc3VsdCxcbiAgQVBJR2F0ZXdheVByb3h5RXZlbnQsXG59IGZyb20gXCJhd3MtbGFtYmRhXCI7XG5pbXBvcnQgaHR0cCBmcm9tIFwiaHR0cFwiO1xuaW1wb3J0IHsgYnVuZGxlTGFtYmRhRnVuY3Rpb24sIGdldEJ1bmRsZU91dEZvbGRlciB9IGZyb20gXCIuL2J1bmRsZS1sYW1iZGFcIjtcbmltcG9ydCB7IGxvZ2ljYWxJZEZvclBhdGgsIHJlc29sdmVTdGFja0RldGFpbCB9IGZyb20gXCIuL2xvZ2ljYWwtaWRcIjtcblxuaW1wb3J0IExhbWJkYSBmcm9tIFwiYXdzLXNkay9jbGllbnRzL2xhbWJkYVwiO1xuaW1wb3J0IFN0ZXBGdW5jdGlvbnMgZnJvbSBcImF3cy1zZGsvY2xpZW50cy9zdGVwZnVuY3Rpb25zXCI7XG5pbXBvcnQgU1RTIGZyb20gXCJhd3Mtc2RrL2NsaWVudHMvc3RzXCI7XG5pbXBvcnQgSUFNIGZyb20gXCJhd3Mtc2RrL2NsaWVudHMvaWFtXCI7XG5pbXBvcnQgeyBpc1N0ZXBGdW5jdGlvbiB9IGZyb20gXCJmdW5jdGlvbmxlc3NcIjtcbmltcG9ydCB7IGdldENsaWVudFByb3BzIH0gZnJvbSBcIi4vY3JlZGVudGlhbHNcIjtcbmltcG9ydCB7IGdldEVudmlyb25tZW50VmFyaWFibGVOYW1lIH0gZnJvbSBcIi4vdXRpbFwiO1xuaW1wb3J0IHsgVHJlZSB9IGZyb20gXCIuL3RyZWUvdHJlZVwiO1xuaW1wb3J0IHsgaXNGaWxlIH0gZnJvbSBcIi4vdHJlZS9maWxlXCI7XG5cbmNvbnN0IGxhbWJkYSA9IG5ldyBMYW1iZGEoZ2V0Q2xpZW50UHJvcHMoKSk7XG5jb25zdCBzdGVwRnVuY3Rpb25zID0gbmV3IFN0ZXBGdW5jdGlvbnMoZ2V0Q2xpZW50UHJvcHMoKSk7XG5cbmNvbnN0IHN0cyA9IG5ldyBTVFMoZ2V0Q2xpZW50UHJvcHMoKSk7XG5cbmNvbnN0IGlhbSA9IG5ldyBJQU0oZ2V0Q2xpZW50UHJvcHMoKSk7XG5cbmludGVyZmFjZSBGdW5jdGlvbk1ldGFkYXRhIHtcbiAgcm9sZUFybjogc3RyaW5nO1xuICBmdW5jdGlvbkFybjogc3RyaW5nO1xufVxuXG50eXBlIExvY2FsUnVubmFibGVGdW5jdGlvbiA9XG4gIHwgTGFtYmRhRnVuY3Rpb25cbiAgfCBTdGVwRnVuY3Rpb25cbiAgfCBFeHByZXNzU3RlcEZ1bmN0aW9uO1xuXG5mdW5jdGlvbiBpc0xvY2FsUnVubmFibGVGdW5jdGlvbihcbiAgcmVzb3VyY2U6IFJlc291cmNlXG4pOiByZXNvdXJjZSBpcyBMb2NhbFJ1bm5hYmxlRnVuY3Rpb24ge1xuICByZXR1cm4gKFxuICAgIGlzTGFtYmRhRnVuY3Rpb24ocmVzb3VyY2UpIHx8XG4gICAgaXNTdGVwRnVuY3Rpb24ocmVzb3VyY2UpIHx8XG4gICAgaXNFeHByZXNzU3RlcEZ1bmN0aW9uKHJlc291cmNlKVxuICApO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9jYWxTZXJ2ZVByb2plY3QocHJvamVjdDogUHJvamVjdCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBmdW5jdGlvbkFybnMgPSBuZXcgTWFwPExvY2FsUnVubmFibGVGdW5jdGlvbiwgRnVuY3Rpb25NZXRhZGF0YT4oKTtcbiAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgT2JqZWN0LnZhbHVlcyhwcm9qZWN0Lm1vZHVsZS50cmVlKS5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgIGF3YWl0IHNldEVudmlyb25tZW50KGZpbGUpO1xuICAgICAgKGF3YWl0IGdldEZ1bmN0aW9uQXJucyhmaWxlKSkuZm9yRWFjaCgoW2Z1bmMsIGZ1bmN0aW9uQXJuXSkgPT5cbiAgICAgICAgZnVuY3Rpb25Bcm5zLnNldChmdW5jLCBmdW5jdGlvbkFybilcbiAgICAgICk7XG4gICAgfSlcbiAgKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgdHVyYm8vbm8tdW5kZWNsYXJlZC1lbnYtdmFyc1xuICBwcm9jZXNzLmVudi5GTF9MT0NBTCA9IFwidHJ1ZVwiO1xuICBjb25zdCBhcHAgPSBleHByZXNzKCkudXNlKGV4cHJlc3MuanNvbigpKTtcbiAgT2JqZWN0LnZhbHVlcyhwcm9qZWN0Lm1vZHVsZS50cmVlKVxuICAgIC5mbGF0TWFwKChzdGFjaykgPT5cbiAgICAgIE9iamVjdC52YWx1ZXMoc3RhY2spLmZsYXRNYXAoKHJlc291cmNlKSA9PlxuICAgICAgICBcIl9yZXNvdXJjZVwiIGluIHJlc291cmNlICYmXG4gICAgICAgIFwia2luZFwiIGluIHJlc291cmNlLl9yZXNvdXJjZS5yZXNvdXJjZSAmJlxuICAgICAgICByZXNvdXJjZS5fcmVzb3VyY2UucmVzb3VyY2Uua2luZCA9PT0gXCJmbC5SZXN0QXBpXCJcbiAgICAgICAgICA/IGV4cGFuZFJlc291cmNlVHJlZShyZXNvdXJjZSlcbiAgICAgICAgICA6IFtdXG4gICAgICApXG4gICAgKVxuICAgIC5mb3JFYWNoKChyKSA9PiByb3V0ZShwcm9qZWN0LCBhcHAsIFwiXCIsIFwiXCIsIHIsIGZ1bmN0aW9uQXJucykpO1xuICBodHRwLmNyZWF0ZVNlcnZlcihhcHApLmxpc3RlbigzMDAwKTtcbiAgY29uc29sZS5sb2coXCJzZXJ2ZXIgcnVubmluZyBvbiBwb3J0IDMwMDBcIik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNldEVudmlyb25tZW50KG5vZGU6IFRyZWUpIHtcbiAgaWYgKGlzRmlsZShub2RlKSkge1xuICAgIGlmIChpc1RhYmxlRGVjbChub2RlLnJlc291cmNlKSkge1xuICAgICAgY29uc3QgcmVzb3VyY2VJZCA9IG5vZGUuYWRkcmVzcztcbiAgICAgIGNvbnN0IGxvZ2ljYWxJZCA9IGxvZ2ljYWxJZEZvclBhdGgocmVzb3VyY2VJZCk7XG4gICAgICBjb25zdCBlbnZLZXkgPSBnZXRFbnZpcm9ubWVudFZhcmlhYmxlTmFtZShyZXNvdXJjZUlkKTtcblxuICAgICAgY29uc3QgdGFibGVBcm4gPSAoYXdhaXQgcmVzb2x2ZVN0YWNrRGV0YWlsKG5vZGUuc3RhY2tOYW1lLCBsb2dpY2FsSWQpKVxuICAgICAgICA/LlBoeXNpY2FsUmVzb3VyY2VJZCE7XG5cbiAgICAgIGNvbnN0IHRhYmxlTmFtZSA9IHBhdGguYmFzZW5hbWUodGFibGVBcm4pO1xuXG4gICAgICBwcm9jZXNzLmVudltgJHtlbnZLZXl9X05BTUVgXSA9IHRhYmxlTmFtZTtcbiAgICAgIHByb2Nlc3MuZW52W2Ake2VudktleX1fQVJOYF0gPSB0YWJsZUFybjtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwobm9kZS5maWxlcy5tYXAoc2V0RW52aXJvbm1lbnQpKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRSb2xlQXJuKFxuICByZXNvdXJjZTogTG9jYWxSdW5uYWJsZUZ1bmN0aW9uLFxuICBmdW5jdGlvbkFybjogc3RyaW5nXG4pIHtcbiAgaWYgKGlzTGFtYmRhRnVuY3Rpb24ocmVzb3VyY2UpKSB7XG4gICAgY29uc3QgZnVuY3Rpb25SZXNwb25zZSA9IGF3YWl0IGxhbWJkYVxuICAgICAgLmdldEZ1bmN0aW9uKHtcbiAgICAgICAgRnVuY3Rpb25OYW1lOiBwYXRoLmJhc2VuYW1lKGZ1bmN0aW9uQXJuKSxcbiAgICAgIH0pXG4gICAgICAucHJvbWlzZSgpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uUmVzcG9uc2UuQ29uZmlndXJhdGlvbj8uUm9sZSE7XG4gIH0gZWxzZSBpZiAoaXNTdGVwRnVuY3Rpb24ocmVzb3VyY2UpIHx8IGlzRXhwcmVzc1N0ZXBGdW5jdGlvbihyZXNvdXJjZSkpIHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHN0ZXBGdW5jdGlvbnNcbiAgICAgIC5kZXNjcmliZVN0YXRlTWFjaGluZSh7IHN0YXRlTWFjaGluZUFybjogZnVuY3Rpb25Bcm4gfSlcbiAgICAgIC5wcm9taXNlKCk7XG4gICAgcmV0dXJuIHJlc3BvbnNlLnJvbGVBcm47XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0RnVuY3Rpb25Bcm5zKG5vZGU6IFRyZWUpOiBQcm9taXNlPFxuICBbXG4gICAgTG9jYWxSdW5uYWJsZUZ1bmN0aW9uLFxuICAgIHtcbiAgICAgIHJvbGVBcm46IHN0cmluZztcbiAgICAgIGZ1bmN0aW9uQXJuOiBzdHJpbmc7XG4gICAgfVxuICBdW11cbj4ge1xuICBpZiAoaXNGaWxlKG5vZGUpKSB7XG4gICAgaWYgKGlzTWV0aG9kKG5vZGUucmVzb3VyY2UpKSB7XG4gICAgICByZXR1cm4gZ2V0RnVuY3Rpb25Bcm5zKG5vZGUpO1xuICAgIH0gZWxzZSBpZiAoaXNMb2NhbFJ1bm5hYmxlRnVuY3Rpb24obm9kZS5yZXNvdXJjZSkpIHtcbiAgICAgIGNvbnN0IGxvZ2ljYWxJZCA9IGxvZ2ljYWxJZEZvclBhdGgobm9kZS5hZGRyZXNzKTtcblxuICAgICAgY29uc3QgZnVuY3Rpb25Bcm4gPSAoYXdhaXQgcmVzb2x2ZVN0YWNrRGV0YWlsKG5vZGUuc3RhY2tOYW1lLCBsb2dpY2FsSWQpKVxuICAgICAgICA/LlBoeXNpY2FsUmVzb3VyY2VJZCE7XG5cbiAgICAgIGNvbnN0IHJvbGVBcm4gPSBhd2FpdCBnZXRSb2xlQXJuKG5vZGUucmVzb3VyY2UsIGZ1bmN0aW9uQXJuKTtcbiAgICAgIGlmICghcm9sZUFybikge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBDb3VsZG4ndCBnZXQgcm9sZSBhcm4gZm9yICR7ZnVuY3Rpb25Bcm59YCk7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJvbGVOYW1lID0gcGF0aC5iYXNlbmFtZShyb2xlQXJuKTtcblxuICAgICAgY29uc3QgW3JvbGUsIHdob2FtaV0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgIGlhbVxuICAgICAgICAgIC5nZXRSb2xlKHtcbiAgICAgICAgICAgIFJvbGVOYW1lOiByb2xlTmFtZSxcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5wcm9taXNlKCksXG4gICAgICAgIHN0cy5nZXRDYWxsZXJJZGVudGl0eSgpLnByb21pc2UoKSxcbiAgICAgIF0gYXMgY29uc3QpO1xuICAgICAgY29uc3QgYXNzdW1lUm9sZVBvbGljeURvY3VtZW50OiB7XG4gICAgICAgIFZlcnNpb246IHN0cmluZztcbiAgICAgICAgU3RhdGVtZW50OiB7XG4gICAgICAgICAgQWN0aW9uOiBzdHJpbmc7XG4gICAgICAgICAgRWZmZWN0OiBzdHJpbmc7XG4gICAgICAgICAgUHJpbmNpcGFsOiB7XG4gICAgICAgICAgICBTZXJ2aWNlPzogc3RyaW5nO1xuICAgICAgICAgICAgQVdTPzogc3RyaW5nO1xuICAgICAgICAgIH07XG4gICAgICAgIH1bXTtcbiAgICAgIH0gPSBKU09OLnBhcnNlKGRlY29kZVVSSUNvbXBvbmVudChyb2xlLlJvbGUuQXNzdW1lUm9sZVBvbGljeURvY3VtZW50ISkpO1xuXG4gICAgICBjb25zdCBleGlzdGluZyA9IGFzc3VtZVJvbGVQb2xpY3lEb2N1bWVudC5TdGF0ZW1lbnQ/LmZpbmQoXG4gICAgICAgIChzdG10KSA9PiB3aG9hbWkuQXJuICYmIHN0bXQuUHJpbmNpcGFsLkFXUyA9PT0gd2hvYW1pLkFyblxuICAgICAgKTtcbiAgICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgICAgYXNzdW1lUm9sZVBvbGljeURvY3VtZW50LlN0YXRlbWVudC5wdXNoKHtcbiAgICAgICAgICBBY3Rpb246IFwic3RzOkFzc3VtZVJvbGVcIixcbiAgICAgICAgICBFZmZlY3Q6IFwiQWxsb3dcIixcbiAgICAgICAgICBQcmluY2lwYWw6IHtcbiAgICAgICAgICAgIEFXUzogd2hvYW1pLkFybixcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgaWFtXG4gICAgICAgICAgLnVwZGF0ZUFzc3VtZVJvbGVQb2xpY3koe1xuICAgICAgICAgICAgUm9sZU5hbWU6IHJvbGVOYW1lLFxuICAgICAgICAgICAgUG9saWN5RG9jdW1lbnQ6IEpTT04uc3RyaW5naWZ5KGFzc3VtZVJvbGVQb2xpY3lEb2N1bWVudCksXG4gICAgICAgICAgfSlcbiAgICAgICAgICAucHJvbWlzZSgpO1xuXG4gICAgICAgIGF3YWl0IChhc3luYyBmdW5jdGlvbiB3YWl0KHdhaXRUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgc3RzXG4gICAgICAgICAgICAgIC5hc3N1bWVSb2xlKHtcbiAgICAgICAgICAgICAgICBSb2xlQXJuOiByb2xlQXJuLFxuICAgICAgICAgICAgICAgIFJvbGVTZXNzaW9uTmFtZTogXCJGTF9MT0NBTFwiLFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAucHJvbWlzZSgpO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICBpZiAoZXJyLmNvZGUgPT09IFwiQWNjZXNzRGVuaWVkXCIpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYHdhaXRpbmcgJHt3YWl0VGltZX1tcyBmb3IgUm9sZWApO1xuICAgICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCB3YWl0VGltZSkpO1xuICAgICAgICAgICAgICBhd2FpdCB3YWl0KE1hdGgubWluKHdhaXRUaW1lICogMS41LCAxMCAqIDEwMDApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pKDEwMCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBbXG4gICAgICAgIFtcbiAgICAgICAgICBub2RlLnJlc291cmNlLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGZ1bmN0aW9uQXJuLFxuICAgICAgICAgICAgcm9sZUFybixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgXTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAoYXdhaXQgUHJvbWlzZS5hbGwobm9kZS5maWxlcy5tYXAoZ2V0RnVuY3Rpb25Bcm5zKSkpLmZsYXQoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBleHBhbmRSZXNvdXJjZVRyZWUodHJlZTogVHJlZSkge1xuICByZXR1cm4gT2JqZWN0LmVudHJpZXModHJlZSkuZmlsdGVyKChbcGF0aF0pID0+IHBhdGggIT0gXCJfcmVzb3VyY2VcIik7XG59XG5cbmZ1bmN0aW9uIGV4cHJlc3NpZnlQYXRoU2VnbWVudChzZWdtZW50OiBzdHJpbmcpIHtcbiAgcmV0dXJuIHNlZ21lbnQucmVwbGFjZSgvXFxbKC4qKVxcXS8sIFwiOiQxXCIpO1xufVxuXG5hc3luYyBmdW5jdGlvbiByb3V0ZShcbiAgcHJvamVjdDogUHJvamVjdCxcbiAgcm91dGVyOiBSb3V0ZXIsXG4gIGlkOiBzdHJpbmcsXG4gIHBhdGg6IHN0cmluZyxcbiAgW3NlZ21lbnQsIHJlc291cmNlXTogW3N0cmluZywgVHJlZV0sXG4gIGZ1bmN0aW9uQXJuczogTWFwPExvY2FsUnVubmFibGVGdW5jdGlvbiwgRnVuY3Rpb25NZXRhZGF0YT5cbikge1xuICBpZiAoaXNGaWxlKHJlc291cmNlKSkge1xuICAgIGlmIChpc01ldGhvZChyZXNvdXJjZS5yZXNvdXJjZSkpIHtcbiAgICAgIGlmIChpc0xvY2FsUnVubmFibGVGdW5jdGlvbihyZXNvdXJjZS5yZXNvdXJjZS5oYW5kbGVyKSkge1xuICAgICAgICBjb25zdCBpc0xhbWJkYSA9IGlzTGFtYmRhRnVuY3Rpb24ocmVzb3VyY2UucmVzb3VyY2UuaGFuZGxlcik7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IHJlc291cmNlLnJlc291cmNlO1xuICAgICAgICBjb25zdCBoYW5kbGVycyA9IHtcbiAgICAgICAgICBHRVQ6IHJvdXRlci5nZXQsXG4gICAgICAgICAgUE9TVDogcm91dGVyLnBvc3QsXG4gICAgICAgICAgUFVUOiByb3V0ZXIucHV0LFxuICAgICAgICAgIERFTEVURTogcm91dGVyLmRlbGV0ZSxcbiAgICAgICAgfTtcbiAgICAgICAgY29uc29sZS5sb2coYCR7cGF0aH0gLSAke21ldGhvZC5wcm9wcy5odHRwTWV0aG9kfWApO1xuICAgICAgICBjb25zdCBvdXRGb2xkZXIgPSBnZXRCdW5kbGVPdXRGb2xkZXIoYCR7aWR9XyR7c2VnbWVudH1gKTtcbiAgICAgICAgY29uc3QgYnVuZGxlID0gYXdhaXQgYnVuZGxlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAgICAgcHJvamVjdCxcbiAgICAgICAgICByZXNvdXJjZS5maWxlUGF0aCxcbiAgICAgICAgICBvdXRGb2xkZXIsXG4gICAgICAgICAgZnVuY3Rpb25Bcm5zLmdldChyZXNvdXJjZS5yZXNvdXJjZS5oYW5kbGVyKT8ucm9sZUFyblxuICAgICAgICApO1xuICAgICAgICBoYW5kbGVyc1ttZXRob2QucHJvcHMuaHR0cE1ldGhvZCBhcyBrZXlvZiB0eXBlb2YgaGFuZGxlcnNdLmJpbmQocm91dGVyKShcbiAgICAgICAgICBwYXRoLFxuICAgICAgICAgIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgeyBkZWZhdWx0OiB3cmFwcGVyIH0gPSBhd2FpdCBpbXBvcnQoYnVuZGxlKTtcblxuICAgICAgICAgICAgICBjb25zdCBldmVudCA9IHtcbiAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXEuYm9keSksXG4gICAgICAgICAgICAgICAgaGVhZGVyczogcmVxLmhlYWRlcnMgYXMgYW55LFxuICAgICAgICAgICAgICAgIGh0dHBNZXRob2Q6IHJlcS5tZXRob2QsXG4gICAgICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgICAgICBxdWVyeVN0cmluZ1BhcmFtZXRlcnM6XG4gICAgICAgICAgICAgICAgICByZXEucXVlcnkgYXMgQVBJR2F0ZXdheVByb3h5RXZlbnRRdWVyeVN0cmluZ1BhcmFtZXRlcnMsXG4gICAgICAgICAgICAgICAgcGF0aFBhcmFtZXRlcnM6IHJlcS5wYXJhbXMsXG4gICAgICAgICAgICAgIH0gYXMgQVBJR2F0ZXdheVByb3h5RXZlbnQ7XG4gICAgICAgICAgICAgIGlmIChpc0xhbWJkYSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogQVBJR2F0ZXdheVByb3h5UmVzdWx0ID0gYXdhaXQgd3JhcHBlcihldmVudCk7XG4gICAgICAgICAgICAgICAgc2V0RXhwcmVzc1Jlc3VsdChyZXMsIHJlc3VsdCk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd3JhcHBlci5oYW5kbGVyLmhhbmRsZXIoZXZlbnQpO1xuICAgICAgICAgICAgICAgIHNldEV4cHJlc3NSZXN1bHQocmVzLCByZXN1bHQpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBleHBhbmRSZXNvdXJjZVRyZWUocmVzb3VyY2UpLmZvckVhY2goKHIpID0+XG4gICAgICByb3V0ZShcbiAgICAgICAgcHJvamVjdCxcbiAgICAgICAgcm91dGVyLFxuICAgICAgICBgJHtpZCA/IGAke2lkfV9gIDogXCJcIn0ke3JbMF19YCxcbiAgICAgICAgYCR7cGF0aH0vJHtleHByZXNzaWZ5UGF0aFNlZ21lbnQoc2VnbWVudCl9YCxcbiAgICAgICAgcixcbiAgICAgICAgZnVuY3Rpb25Bcm5zXG4gICAgICApXG4gICAgKTtcbiAgfVxufVxuZnVuY3Rpb24gc2V0RXhwcmVzc1Jlc3VsdChyZXM6IFJlc3BvbnNlPGFueT4sIHJlc3VsdDogQVBJR2F0ZXdheVByb3h5UmVzdWx0KSB7XG4gIHJlcy5zdGF0dXMocmVzdWx0LnN0YXR1c0NvZGUpO1xuICBpZiAocmVzdWx0LmhlYWRlcnMpIHtcbiAgICBPYmplY3QuZW50cmllcyhyZXN1bHQuaGVhZGVycykuZm9yRWFjaCgoW2hlYWRlciwgdmFsdWVdKSA9PiB7XG4gICAgICByZXMuaGVhZGVyKGhlYWRlciwgdmFsdWUudG9TdHJpbmcoKSk7XG4gICAgfSk7XG4gIH1cbiAgcmVzLnNlbmQocmVzdWx0LmJvZHkpO1xufVxuIl19