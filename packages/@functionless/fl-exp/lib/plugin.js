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
exports.resourceIdPlugin = void 0;
const babel = __importStar(require("@babel/core"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const interface_1 = require("./interface");
const babel_ts = require("@babel/plugin-transform-typescript");
function resourceIdPlugin(project, roleArn) {
    return {
        name: "Functionless Resource IDs",
        setup(build) {
            build.onLoad({ filter: /\.ts/g }, async (args) => {
                const resourceModule = require(args.path);
                if ((0, interface_1.isResource)(resourceModule.default)) {
                    const resource = project.lookupResource(resourceModule.default);
                    const resourceID = resource.address;
                    let text = await promises_1.default.readFile(args.path, "utf8");
                    const transformed = await babel.transformAsync(text, {
                        sourceType: "module",
                        sourceMaps: "inline",
                        sourceFileName: path_1.default.basename(args.path),
                        plugins: [
                            babel_ts.default,
                            () => ({
                                visitor: createVisitor(resourceID),
                            }),
                        ],
                    });
                    return {
                        contents: transformed === null || transformed === void 0 ? void 0 : transformed.code,
                        loader: "ts",
                    };
                }
                return undefined;
            });
        },
    };
    function createVisitor(resourceID) {
        return {
            CallExpression: (call) => {
                if (babel.types.isIdentifier(call.node.callee)) {
                    if (call.node.callee.name === "LambdaFunction" ||
                        call.node.callee.name === "StepFunction" ||
                        call.node.callee.name === "ExpressStepFunction") {
                        if (call.node.arguments.length === 1) {
                            call.node.arguments.push(babel.types.identifier("undefined"), babel.types.stringLiteral(resourceID));
                        }
                        else if (call.node.arguments.length === 2) {
                            call.node.arguments.push(babel.types.stringLiteral(resourceID), babel.types.stringLiteral(roleArn !== null && roleArn !== void 0 ? roleArn : "NONE"));
                        }
                        else {
                            call.node.arguments = [
                                call.node.arguments[0],
                                call.node.arguments[1],
                                babel.types.stringLiteral(resourceID),
                                babel.types.stringLiteral(roleArn !== null && roleArn !== void 0 ? roleArn : "NONE"),
                            ];
                        }
                    }
                    else if (call.node.callee.name === "Table") {
                        if (call.node.arguments.length === 1) {
                            call.node.arguments.push(babel.types.stringLiteral(resourceID), babel.types.stringLiteral(roleArn !== null && roleArn !== void 0 ? roleArn : "NONE"));
                        }
                        else if (call.node.arguments.length === 2) {
                            call.node.arguments.push(babel.types.stringLiteral(resourceID), babel.types.stringLiteral(roleArn !== null && roleArn !== void 0 ? roleArn : "NONE"));
                        }
                        else {
                            call.node.arguments = [
                                call.node.arguments[0],
                                babel.types.stringLiteral(resourceID),
                                babel.types.stringLiteral(roleArn !== null && roleArn !== void 0 ? roleArn : "NONE"),
                            ];
                        }
                    }
                }
            },
        };
    }
}
exports.resourceIdPlugin = resourceIdPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3BsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLG1EQUFxQztBQUNyQywyREFBNkI7QUFDN0IsZ0RBQXdCO0FBRXhCLDJDQUF5QztBQUV6QyxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsb0NBQW9DLENBQUMsQ0FBQztBQUUvRCxTQUFnQixnQkFBZ0IsQ0FDOUIsT0FBZ0IsRUFDaEIsT0FBZ0I7SUFFaEIsT0FBTztRQUNMLElBQUksRUFBRSwyQkFBMkI7UUFDakMsS0FBSyxDQUFDLEtBQUs7WUFDVCxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDL0MsTUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFFMUMsSUFBSSxJQUFBLHNCQUFVLEVBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxFQUFFO29CQUN0QyxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDaEUsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQztvQkFFcEMsSUFBSSxJQUFJLEdBQUcsTUFBTSxrQkFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO29CQUNoRCxNQUFNLFdBQVcsR0FBRyxNQUFNLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFO3dCQUNuRCxVQUFVLEVBQUUsUUFBUTt3QkFDcEIsVUFBVSxFQUFFLFFBQVE7d0JBQ3BCLGNBQWMsRUFBRSxjQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7d0JBQ3hDLE9BQU8sRUFBRTs0QkFDUCxRQUFRLENBQUMs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Q0FBQyxhQUFhLENBQUMsT0FBTyxhQUFQLE9BQU8sY0FBUCxPQUFPLEdBQUksTUFBTSxDQUFDLENBQzdDLENBQUM7eUJBQ0g7NkJBQU07NEJBQ0wsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUc7Z0NBQ3BCLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBRTtnQ0FDdkIsS0FBSyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDO2dDQUNyQyxLQUFLLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFPLGFBQVAsT0FBTyxjQUFQLE9BQU8sR0FBSSxNQUFNLENBQUM7NkJBQzdDLENBQUM7eUJBQ0g7cUJBQ0Y7aUJBQ0Y7WUFDSCxDQUFDO1NBQ0YsQ0FBQztJQUNKLENBQUM7QUFDSCxDQUFDO0FBdkZELDRDQXVGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBlc2J1aWxkIGZyb20gXCJlc2J1aWxkXCI7XG5pbXBvcnQgKiBhcyBiYWJlbCBmcm9tIFwiQGJhYmVsL2NvcmVcIjtcbmltcG9ydCBmcyBmcm9tIFwiZnMvcHJvbWlzZXNcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBQcm9qZWN0IH0gZnJvbSBcIi4vcHJvamVjdFwiO1xuaW1wb3J0IHsgaXNSZXNvdXJjZSB9IGZyb20gXCIuL2ludGVyZmFjZVwiO1xuXG5jb25zdCBiYWJlbF90cyA9IHJlcXVpcmUoXCJAYmFiZWwvcGx1Z2luLXRyYW5zZm9ybS10eXBlc2NyaXB0XCIpO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVzb3VyY2VJZFBsdWdpbihcbiAgcHJvamVjdDogUHJvamVjdCxcbiAgcm9sZUFybj86IHN0cmluZ1xuKTogZXNidWlsZC5QbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IFwiRnVuY3Rpb25sZXNzIFJlc291cmNlIElEc1wiLFxuICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC50cy9nIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc291cmNlTW9kdWxlID0gcmVxdWlyZShhcmdzLnBhdGgpO1xuXG4gICAgICAgIGlmIChpc1Jlc291cmNlKHJlc291cmNlTW9kdWxlLmRlZmF1bHQpKSB7XG4gICAgICAgICAgY29uc3QgcmVzb3VyY2UgPSBwcm9qZWN0Lmxvb2t1cFJlc291cmNlKHJlc291cmNlTW9kdWxlLmRlZmF1bHQpO1xuICAgICAgICAgIGNvbnN0IHJlc291cmNlSUQgPSByZXNvdXJjZS5hZGRyZXNzO1xuXG4gICAgICAgICAgbGV0IHRleHQgPSBhd2FpdCBmcy5yZWFkRmlsZShhcmdzLnBhdGgsIFwidXRmOFwiKTtcbiAgICAgICAgICBjb25zdCB0cmFuc2Zvcm1lZCA9IGF3YWl0IGJhYmVsLnRyYW5zZm9ybUFzeW5jKHRleHQsIHtcbiAgICAgICAgICAgIHNvdXJjZVR5cGU6IFwibW9kdWxlXCIsXG4gICAgICAgICAgICBzb3VyY2VNYXBzOiBcImlubGluZVwiLFxuICAgICAgICAgICAgc291cmNlRmlsZU5hbWU6IHBhdGguYmFzZW5hbWUoYXJncy5wYXRoKSxcbiAgICAgICAgICAgIHBsdWdpbnM6IFtcbiAgICAgICAgICAgICAgYmFiZWxfdHMuZGVmYXVsdCxcbiAgICAgICAgICAgICAgKCkgPT4gKHtcbiAgICAgICAgICAgICAgICB2aXNpdG9yOiBjcmVhdGVWaXNpdG9yKHJlc291cmNlSUQpLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudHM6IHRyYW5zZm9ybWVkPy5jb2RlISxcbiAgICAgICAgICAgIGxvYWRlcjogXCJ0c1wiLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG5cbiAgZnVuY3Rpb24gY3JlYXRlVmlzaXRvcihyZXNvdXJjZUlEOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gPGJhYmVsLlZpc2l0b3I+e1xuICAgICAgQ2FsbEV4cHJlc3Npb246IChjYWxsKSA9PiB7XG4gICAgICAgIGlmIChiYWJlbC50eXBlcy5pc0lkZW50aWZpZXIoY2FsbC5ub2RlLmNhbGxlZSkpIHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBjYWxsLm5vZGUuY2FsbGVlLm5hbWUgPT09IFwiTGFtYmRhRnVuY3Rpb25cIiB8fFxuICAgICAgICAgICAgY2FsbC5ub2RlLmNhbGxlZS5uYW1lID09PSBcIlN0ZXBGdW5jdGlvblwiIHx8XG4gICAgICAgICAgICBjYWxsLm5vZGUuY2FsbGVlLm5hbWUgPT09IFwiRXhwcmVzc1N0ZXBGdW5jdGlvblwiXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBpZiAoY2FsbC5ub2RlLmFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgY2FsbC5ub2RlLmFyZ3VtZW50cy5wdXNoKFxuICAgICAgICAgICAgICAgIGJhYmVsLnR5cGVzLmlkZW50aWZpZXIoXCJ1bmRlZmluZWRcIiksXG4gICAgICAgICAgICAgICAgYmFiZWwudHlwZXMuc3RyaW5nTGl0ZXJhbChyZXNvdXJjZUlEKVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjYWxsLm5vZGUuYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgICAgICAgICBjYWxsLm5vZGUuYXJndW1lbnRzLnB1c2goXG4gICAgICAgICAgICAgICAgYmFiZWwudHlwZXMuc3RyaW5nTGl0ZXJhbChyZXNvdXJjZUlEKSxcbiAgICAgICAgICAgICAgICBiYWJlbC50eXBlcy5zdHJpbmdMaXRlcmFsKHJvbGVBcm4gPz8gXCJOT05FXCIpXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjYWxsLm5vZGUuYXJndW1lbnRzID0gW1xuICAgICAgICAgICAgICAgIGNhbGwubm9kZS5hcmd1bWVudHNbMF0hLFxuICAgICAgICAgICAgICAgIGNhbGwubm9kZS5hcmd1bWVudHNbMV0hLFxuICAgICAgICAgICAgICAgIGJhYmVsLnR5cGVzLnN0cmluZ0xpdGVyYWwocmVzb3VyY2VJRCksXG4gICAgICAgICAgICAgICAgYmFiZWwudHlwZXMuc3RyaW5nTGl0ZXJhbChyb2xlQXJuID8/IFwiTk9ORVwiKSxcbiAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGNhbGwubm9kZS5jYWxsZWUubmFtZSA9PT0gXCJUYWJsZVwiKSB7XG4gICAgICAgICAgICBpZiAoY2FsbC5ub2RlLmFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgY2FsbC5ub2RlLmFyZ3VtZW50cy5wdXNoKFxuICAgICAgICAgICAgICAgIGJhYmVsLnR5cGVzLnN0cmluZ0xpdGVyYWwocmVzb3VyY2VJRCksXG4gICAgICAgICAgICAgICAgYmFiZWwudHlwZXMuc3RyaW5nTGl0ZXJhbChyb2xlQXJuID8/IFwiTk9ORVwiKVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjYWxsLm5vZGUuYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgICAgICAgICBjYWxsLm5vZGUuYXJndW1lbnRzLnB1c2goXG4gICAgICAgICAgICAgICAgYmFiZWwudHlwZXMuc3RyaW5nTGl0ZXJhbChyZXNvdXJjZUlEKSxcbiAgICAgICAgICAgICAgICBiYWJlbC50eXBlcy5zdHJpbmdMaXRlcmFsKHJvbGVBcm4gPz8gXCJOT05FXCIpXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjYWxsLm5vZGUuYXJndW1lbnRzID0gW1xuICAgICAgICAgICAgICAgIGNhbGwubm9kZS5hcmd1bWVudHNbMF0hLFxuICAgICAgICAgICAgICAgIGJhYmVsLnR5cGVzLnN0cmluZ0xpdGVyYWwocmVzb3VyY2VJRCksXG4gICAgICAgICAgICAgICAgYmFiZWwudHlwZXMuc3RyaW5nTGl0ZXJhbChyb2xlQXJuID8/IFwiTk9ORVwiKSxcbiAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfTtcbiAgfVxufVxuIl19