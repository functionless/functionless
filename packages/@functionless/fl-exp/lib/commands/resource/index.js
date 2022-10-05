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
exports.invoke = void 0;
const command_provider_1 = require("../../command-provider");
const logical_id_1 = require("../../logical-id");
require("./api-method");
require("./lambda-function");
require("./express-step-function");
require("./step-function");
require("functionless/register");
async function invoke(resourceFile, _args) {
    const absoluteResourcePath = resourceFile.filePath;
    const resourceId = resourceFile.address;
    const logicalId = (0, logical_id_1.logicalIdForPath)(resourceId);
    const smartResource = (await Promise.resolve().then(() => __importStar(require(absoluteResourcePath)))).default;
    if (smartResource) {
        const stackDetail = await (0, logical_id_1.resolveStackDetail)(resourceFile.stackName, logicalId);
        if (!stackDetail) {
            return;
        }
        (0, command_provider_1.dispatch)(smartResource.kind, stackDetail);
    }
}
exports.invoke = invoke;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29tbWFuZHMvcmVzb3VyY2UvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw2REFBa0Q7QUFDbEQsaURBQXdFO0FBRXhFLHdCQUFzQjtBQUN0Qiw2QkFBMkI7QUFDM0IsbUNBQWlDO0FBQ2pDLDJCQUF5QjtBQUd6QixPQUFPLENBQUMsdUJBQXVCLENBQUMsQ0FBQztBQUUxQixLQUFLLFVBQVUsTUFBTSxDQUFDLFlBQWtCLEVBQUUsS0FBZTtJQUM5RCxNQUFNLG9CQUFvQixHQUFHLFlBQVksQ0FBQyxRQUFRLENBQUM7SUFDbkQsTUFBTSxVQUFVLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQztJQUV4QyxNQUFNLFNBQVMsR0FBRyxJQUFBLDZCQUFnQixFQUFDLFVBQVUsQ0FBQyxDQUFDO0lBRS9DLE1BQU0sYUFBYSxHQUFHLENBQUMsd0RBQWEsb0JBQW9CLEdBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztJQUNuRSxJQUFJLGFBQWEsRUFBRTtRQUNqQixNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUEsK0JBQWtCLEVBQzFDLFlBQVksQ0FBQyxTQUFTLEVBQ3RCLFNBQVMsQ0FDVixDQUFDO1FBRUYsSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNoQixPQUFPO1NBQ1I7UUFFRCxJQUFBLDJCQUFRLEVBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztLQUMzQztBQUNILENBQUM7QUFuQkQsd0JBbUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZGlzcGF0Y2ggfSBmcm9tIFwiLi4vLi4vY29tbWFuZC1wcm92aWRlclwiO1xuaW1wb3J0IHsgbG9naWNhbElkRm9yUGF0aCwgcmVzb2x2ZVN0YWNrRGV0YWlsIH0gZnJvbSBcIi4uLy4uL2xvZ2ljYWwtaWRcIjtcblxuaW1wb3J0IFwiLi9hcGktbWV0aG9kXCI7XG5pbXBvcnQgXCIuL2xhbWJkYS1mdW5jdGlvblwiO1xuaW1wb3J0IFwiLi9leHByZXNzLXN0ZXAtZnVuY3Rpb25cIjtcbmltcG9ydCBcIi4vc3RlcC1mdW5jdGlvblwiO1xuaW1wb3J0IHsgRmlsZSB9IGZyb20gXCIuLi8uLi90cmVlL2ZpbGVcIjtcblxucmVxdWlyZShcImZ1bmN0aW9ubGVzcy9yZWdpc3RlclwiKTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGludm9rZShyZXNvdXJjZUZpbGU6IEZpbGUsIF9hcmdzOiBzdHJpbmdbXSkge1xuICBjb25zdCBhYnNvbHV0ZVJlc291cmNlUGF0aCA9IHJlc291cmNlRmlsZS5maWxlUGF0aDtcbiAgY29uc3QgcmVzb3VyY2VJZCA9IHJlc291cmNlRmlsZS5hZGRyZXNzO1xuXG4gIGNvbnN0IGxvZ2ljYWxJZCA9IGxvZ2ljYWxJZEZvclBhdGgocmVzb3VyY2VJZCk7XG5cbiAgY29uc3Qgc21hcnRSZXNvdXJjZSA9IChhd2FpdCBpbXBvcnQoYWJzb2x1dGVSZXNvdXJjZVBhdGgpKS5kZWZhdWx0O1xuICBpZiAoc21hcnRSZXNvdXJjZSkge1xuICAgIGNvbnN0IHN0YWNrRGV0YWlsID0gYXdhaXQgcmVzb2x2ZVN0YWNrRGV0YWlsKFxuICAgICAgcmVzb3VyY2VGaWxlLnN0YWNrTmFtZSxcbiAgICAgIGxvZ2ljYWxJZFxuICAgICk7XG5cbiAgICBpZiAoIXN0YWNrRGV0YWlsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZGlzcGF0Y2goc21hcnRSZXNvdXJjZS5raW5kLCBzdGFja0RldGFpbCk7XG4gIH1cbn1cbiJdfQ==