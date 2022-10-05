"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invokeExpressStepFunction = void 0;
const stepfunctions_1 = __importDefault(require("aws-sdk/clients/stepfunctions"));
const command_provider_1 = require("../../command-provider");
const credentials_1 = require("../../credentials");
const express_step_function_1 = require("../../interface/express-step-function");
const open_console_1 = require("./open-console");
(0, command_provider_1.registerCommand)({
    resourceKind: express_step_function_1.ExpressStepFunctionKind,
    handler(command, _resource, detail) {
        command.command("invoke [payload]").action(async (maybePayload) => {
            await invokeExpressStepFunction(maybePayload, detail);
        });
        command.command("console").action(async () => {
            (0, open_console_1.openConsole)(detail);
        });
    },
});
async function invokeExpressStepFunction(maybePayload, detail) {
    const payload = typeof maybePayload === "string" ? maybePayload : "{}";
    const stateMachineArn = detail.PhysicalResourceId;
    if (!stateMachineArn) {
        throw new Error("Could not determine lambda name");
    }
    const lambda = new stepfunctions_1.default((0, credentials_1.getClientProps)());
    const response = await lambda
        .startSyncExecution({
        stateMachineArn: stateMachineArn,
        input: payload,
    })
        .promise();
    console.log(JSON.stringify(response, null, 2));
}
exports.invokeExpressStepFunction = invokeExpressStepFunction;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzcy1zdGVwLWZ1bmN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvbW1hbmRzL3Jlc291cmNlL2V4cHJlc3Mtc3RlcC1mdW5jdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFDQSxrRkFBMEQ7QUFDMUQsNkRBQXlEO0FBQ3pELG1EQUFtRDtBQUNuRCxpRkFBZ0Y7QUFDaEYsaURBQTZDO0FBRTdDLElBQUEsa0NBQWUsRUFBQztJQUNkLFlBQVksRUFBRSwrQ0FBdUI7SUFDckMsT0FBTyxDQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTTtRQUNoQyxPQUFPLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsRUFBRTtZQUNoRSxNQUFNLHlCQUF5QixDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN4RCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFO1lBQzNDLElBQUEsMEJBQVcsRUFBQyxNQUFNLENBQUMsQ0FBQztRQUN0QixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRixDQUFDLENBQUM7QUFFSSxLQUFLLFVBQVUseUJBQXlCLENBQzdDLFlBQWdDLEVBQ2hDLE1BQTJCO0lBRTNCLE1BQU0sT0FBTyxHQUFHLE9BQU8sWUFBWSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDdkUsTUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDLGtCQUFrQixDQUFDO0lBRWxELElBQUksQ0FBQyxlQUFlLEVBQUU7UUFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0tBQ3BEO0lBRUQsTUFBTSxNQUFNLEdBQUcsSUFBSSx1QkFBYSxDQUFDLElBQUEsNEJBQWMsR0FBRSxDQUFDLENBQUM7SUFFbkQsTUFBTSxRQUFRLEdBQUcsTUFBTSxNQUFNO1NBQzFCLGtCQUFrQixDQUFDO1FBQ2xCLGVBQWUsRUFBRSxlQUFlO1FBQ2hDLEtBQUssRUFBRSxPQUFPO0tBQ2YsQ0FBQztTQUNELE9BQU8sRUFBRSxDQUFDO0lBRWIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRCxDQUFDO0FBckJELDhEQXFCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFN0YWNrUmVzb3VyY2VEZXRhaWwgfSBmcm9tIFwiYXdzLXNkay9jbGllbnRzL2Nsb3VkZm9ybWF0aW9uXCI7XG5pbXBvcnQgU3RlcEZ1bmN0aW9ucyBmcm9tIFwiYXdzLXNkay9jbGllbnRzL3N0ZXBmdW5jdGlvbnNcIjtcbmltcG9ydCB7IHJlZ2lzdGVyQ29tbWFuZCB9IGZyb20gXCIuLi8uLi9jb21tYW5kLXByb3ZpZGVyXCI7XG5pbXBvcnQgeyBnZXRDbGllbnRQcm9wcyB9IGZyb20gXCIuLi8uLi9jcmVkZW50aWFsc1wiO1xuaW1wb3J0IHsgRXhwcmVzc1N0ZXBGdW5jdGlvbktpbmQgfSBmcm9tIFwiLi4vLi4vaW50ZXJmYWNlL2V4cHJlc3Mtc3RlcC1mdW5jdGlvblwiO1xuaW1wb3J0IHsgb3BlbkNvbnNvbGUgfSBmcm9tIFwiLi9vcGVuLWNvbnNvbGVcIjtcblxucmVnaXN0ZXJDb21tYW5kKHtcbiAgcmVzb3VyY2VLaW5kOiBFeHByZXNzU3RlcEZ1bmN0aW9uS2luZCxcbiAgaGFuZGxlcihjb21tYW5kLCBfcmVzb3VyY2UsIGRldGFpbCkge1xuICAgIGNvbW1hbmQuY29tbWFuZChcImludm9rZSBbcGF5bG9hZF1cIikuYWN0aW9uKGFzeW5jIChtYXliZVBheWxvYWQpID0+IHtcbiAgICAgIGF3YWl0IGludm9rZUV4cHJlc3NTdGVwRnVuY3Rpb24obWF5YmVQYXlsb2FkLCBkZXRhaWwpO1xuICAgIH0pO1xuXG4gICAgY29tbWFuZC5jb21tYW5kKFwiY29uc29sZVwiKS5hY3Rpb24oYXN5bmMgKCkgPT4ge1xuICAgICAgb3BlbkNvbnNvbGUoZGV0YWlsKTtcbiAgICB9KTtcbiAgfSxcbn0pO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaW52b2tlRXhwcmVzc1N0ZXBGdW5jdGlvbihcbiAgbWF5YmVQYXlsb2FkOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIGRldGFpbDogU3RhY2tSZXNvdXJjZURldGFpbFxuKSB7XG4gIGNvbnN0IHBheWxvYWQgPSB0eXBlb2YgbWF5YmVQYXlsb2FkID09PSBcInN0cmluZ1wiID8gbWF5YmVQYXlsb2FkIDogXCJ7fVwiO1xuICBjb25zdCBzdGF0ZU1hY2hpbmVBcm4gPSBkZXRhaWwuUGh5c2ljYWxSZXNvdXJjZUlkO1xuXG4gIGlmICghc3RhdGVNYWNoaW5lQXJuKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ291bGQgbm90IGRldGVybWluZSBsYW1iZGEgbmFtZVwiKTtcbiAgfVxuXG4gIGNvbnN0IGxhbWJkYSA9IG5ldyBTdGVwRnVuY3Rpb25zKGdldENsaWVudFByb3BzKCkpO1xuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgbGFtYmRhXG4gICAgLnN0YXJ0U3luY0V4ZWN1dGlvbih7XG4gICAgICBzdGF0ZU1hY2hpbmVBcm46IHN0YXRlTWFjaGluZUFybixcbiAgICAgIGlucHV0OiBwYXlsb2FkLFxuICAgIH0pXG4gICAgLnByb21pc2UoKTtcblxuICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeShyZXNwb25zZSwgbnVsbCwgMikpO1xufVxuIl19