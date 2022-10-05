"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invokeStandardStepFunction = void 0;
const stepfunctions_1 = __importDefault(require("aws-sdk/clients/stepfunctions"));
const command_provider_1 = require("../../command-provider");
const credentials_1 = require("../../credentials");
const step_function_1 = require("../../interface/step-function");
const open_console_1 = require("./open-console");
(0, command_provider_1.registerCommand)({
    resourceKind: step_function_1.StepFunctionKind,
    handler(command, _resource, details) {
        command.command("invoke [payload]").action(async (maybePayload) => {
            await invokeStandardStepFunction(maybePayload, details);
        });
        command.command("console").action(async () => {
            await (0, open_console_1.openConsole)(details);
        });
    },
});
async function invokeStandardStepFunction(maybePayload, detail) {
    const payload = typeof maybePayload === "string" ? maybePayload : "{}";
    const stateMachineArn = detail.PhysicalResourceId;
    if (!stateMachineArn) {
        throw new Error("Could not determine lambda name");
    }
    const lambda = new stepfunctions_1.default((0, credentials_1.getClientProps)());
    const response = await lambda
        .startExecution({
        stateMachineArn: stateMachineArn,
        input: payload,
    })
        .promise();
    console.log(JSON.stringify(response, null, 2));
}
exports.invokeStandardStepFunction = invokeStandardStepFunction;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RlcC1mdW5jdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21tYW5kcy9yZXNvdXJjZS9zdGVwLWZ1bmN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUNBLGtGQUEwRDtBQUMxRCw2REFBeUQ7QUFDekQsbURBQW1EO0FBQ25ELGlFQUFpRTtBQUNqRSxpREFBNkM7QUFFN0MsSUFBQSxrQ0FBZSxFQUFDO0lBQ2QsWUFBWSxFQUFFLGdDQUFnQjtJQUM5QixPQUFPLENBQUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxPQUFPO1FBQ2pDLE9BQU8sQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLFlBQVksRUFBRSxFQUFFO1lBQ2hFLE1BQU0sMEJBQTBCLENBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzFELENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxJQUFJLEVBQUU7WUFDM0MsTUFBTSxJQUFBLDBCQUFXLEVBQUMsT0FBTyxDQUFDLENBQUM7UUFDN0IsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0YsQ0FBQyxDQUFDO0FBRUksS0FBSyxVQUFVLDBCQUEwQixDQUM5QyxZQUFnQyxFQUNoQyxNQUEyQjtJQUUzQixNQUFNLE9BQU8sR0FBRyxPQUFPLFlBQVksS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQ3ZFLE1BQU0sZUFBZSxHQUFHLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQztJQUVsRCxJQUFJLENBQUMsZUFBZSxFQUFFO1FBQ3BCLE1BQU0sSUFBSSxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQztLQUNwRDtJQUVELE1BQU0sTUFBTSxHQUFHLElBQUksdUJBQWEsQ0FBQyxJQUFBLDRCQUFjLEdBQUUsQ0FBQyxDQUFDO0lBRW5ELE1BQU0sUUFBUSxHQUFHLE1BQU0sTUFBTTtTQUMxQixjQUFjLENBQUM7UUFDZCxlQUFlLEVBQUUsZUFBZTtRQUNoQyxLQUFLLEVBQUUsT0FBTztLQUNmLENBQUM7U0FDRCxPQUFPLEVBQUUsQ0FBQztJQUViLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakQsQ0FBQztBQXJCRCxnRUFxQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTdGFja1Jlc291cmNlRGV0YWlsIH0gZnJvbSBcImF3cy1zZGsvY2xpZW50cy9jbG91ZGZvcm1hdGlvblwiO1xuaW1wb3J0IFN0ZXBGdW5jdGlvbnMgZnJvbSBcImF3cy1zZGsvY2xpZW50cy9zdGVwZnVuY3Rpb25zXCI7XG5pbXBvcnQgeyByZWdpc3RlckNvbW1hbmQgfSBmcm9tIFwiLi4vLi4vY29tbWFuZC1wcm92aWRlclwiO1xuaW1wb3J0IHsgZ2V0Q2xpZW50UHJvcHMgfSBmcm9tIFwiLi4vLi4vY3JlZGVudGlhbHNcIjtcbmltcG9ydCB7IFN0ZXBGdW5jdGlvbktpbmQgfSBmcm9tIFwiLi4vLi4vaW50ZXJmYWNlL3N0ZXAtZnVuY3Rpb25cIjtcbmltcG9ydCB7IG9wZW5Db25zb2xlIH0gZnJvbSBcIi4vb3Blbi1jb25zb2xlXCI7XG5cbnJlZ2lzdGVyQ29tbWFuZCh7XG4gIHJlc291cmNlS2luZDogU3RlcEZ1bmN0aW9uS2luZCxcbiAgaGFuZGxlcihjb21tYW5kLCBfcmVzb3VyY2UsIGRldGFpbHMpIHtcbiAgICBjb21tYW5kLmNvbW1hbmQoXCJpbnZva2UgW3BheWxvYWRdXCIpLmFjdGlvbihhc3luYyAobWF5YmVQYXlsb2FkKSA9PiB7XG4gICAgICBhd2FpdCBpbnZva2VTdGFuZGFyZFN0ZXBGdW5jdGlvbihtYXliZVBheWxvYWQsIGRldGFpbHMpO1xuICAgIH0pO1xuXG4gICAgY29tbWFuZC5jb21tYW5kKFwiY29uc29sZVwiKS5hY3Rpb24oYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgb3BlbkNvbnNvbGUoZGV0YWlscyk7XG4gICAgfSk7XG4gIH0sXG59KTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGludm9rZVN0YW5kYXJkU3RlcEZ1bmN0aW9uKFxuICBtYXliZVBheWxvYWQ6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgZGV0YWlsOiBTdGFja1Jlc291cmNlRGV0YWlsXG4pIHtcbiAgY29uc3QgcGF5bG9hZCA9IHR5cGVvZiBtYXliZVBheWxvYWQgPT09IFwic3RyaW5nXCIgPyBtYXliZVBheWxvYWQgOiBcInt9XCI7XG4gIGNvbnN0IHN0YXRlTWFjaGluZUFybiA9IGRldGFpbC5QaHlzaWNhbFJlc291cmNlSWQ7XG5cbiAgaWYgKCFzdGF0ZU1hY2hpbmVBcm4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb3VsZCBub3QgZGV0ZXJtaW5lIGxhbWJkYSBuYW1lXCIpO1xuICB9XG5cbiAgY29uc3QgbGFtYmRhID0gbmV3IFN0ZXBGdW5jdGlvbnMoZ2V0Q2xpZW50UHJvcHMoKSk7XG5cbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBsYW1iZGFcbiAgICAuc3RhcnRFeGVjdXRpb24oe1xuICAgICAgc3RhdGVNYWNoaW5lQXJuOiBzdGF0ZU1hY2hpbmVBcm4sXG4gICAgICBpbnB1dDogcGF5bG9hZCxcbiAgICB9KVxuICAgIC5wcm9taXNlKCk7XG5cbiAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkocmVzcG9uc2UsIG51bGwsIDIpKTtcbn1cbiJdfQ==