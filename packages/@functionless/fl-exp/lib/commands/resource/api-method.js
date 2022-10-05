"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const command_provider_1 = require("../../command-provider");
const method_1 = require("../../interface/method");
const lambda_function_1 = require("./lambda-function");
const open_console_1 = require("./open-console");
const express_step_function_1 = require("./express-step-function");
(0, command_provider_1.registerCommand)({
    resourceKind: method_1.MethodKind,
    handler(command, resource, detail) {
        command.command("invoke [payload]").action(async (maybePayload) => {
            await invokeResource(resource);
            async function invokeResource(_resource) {
                if (detail.ResourceType === "AWS::StepFunctions::StateMachine") {
                    await (0, express_step_function_1.invokeExpressStepFunction)(maybePayload, detail);
                }
                else if (detail.ResourceType === "AWS::Lambda::Function") {
                    await (0, lambda_function_1.invokeLambda)(maybePayload, detail);
                }
                else {
                    throw new Error("Not supported");
                }
            }
        });
        command.command("console").action(async (_maybePayload) => {
            await (0, open_console_1.openConsole)(detail);
        });
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLW1ldGhvZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21tYW5kcy9yZXNvdXJjZS9hcGktbWV0aG9kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkRBQXlEO0FBQ3pELG1EQUFvRDtBQUNwRCx1REFBaUQ7QUFDakQsaURBQTZDO0FBQzdDLG1FQUFvRTtBQUVwRSxJQUFBLGtDQUFlLEVBQUM7SUFDZCxZQUFZLEVBQUUsbUJBQVU7SUFDeEIsT0FBTyxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTTtRQUMvQixPQUFPLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsRUFBRTtZQUNoRSxNQUFNLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUUvQixLQUFLLFVBQVUsY0FBYyxDQUFDLFNBQWlCO2dCQUM3QyxJQUFJLE1BQU0sQ0FBQyxZQUFZLEtBQUssa0NBQWtDLEVBQUU7b0JBQzlELE1BQU0sSUFBQSxpREFBeUIsRUFBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7aUJBQ3ZEO3FCQUFNLElBQUksTUFBTSxDQUFDLFlBQVksS0FBSyx1QkFBdUIsRUFBRTtvQkFDMUQsTUFBTSxJQUFBLDhCQUFZLEVBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2lCQUMxQztxQkFBTTtvQkFDTCxNQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2lCQUNsQztZQUNILENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxhQUFhLEVBQUUsRUFBRTtZQUN4RCxNQUFNLElBQUEsMEJBQVcsRUFBQyxNQUFNLENBQUMsQ0FBQztRQUM1QixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZWdpc3RlckNvbW1hbmQgfSBmcm9tIFwiLi4vLi4vY29tbWFuZC1wcm92aWRlclwiO1xuaW1wb3J0IHsgTWV0aG9kS2luZCB9IGZyb20gXCIuLi8uLi9pbnRlcmZhY2UvbWV0aG9kXCI7XG5pbXBvcnQgeyBpbnZva2VMYW1iZGEgfSBmcm9tIFwiLi9sYW1iZGEtZnVuY3Rpb25cIjtcbmltcG9ydCB7IG9wZW5Db25zb2xlIH0gZnJvbSBcIi4vb3Blbi1jb25zb2xlXCI7XG5pbXBvcnQgeyBpbnZva2VFeHByZXNzU3RlcEZ1bmN0aW9uIH0gZnJvbSBcIi4vZXhwcmVzcy1zdGVwLWZ1bmN0aW9uXCI7XG5cbnJlZ2lzdGVyQ29tbWFuZCh7XG4gIHJlc291cmNlS2luZDogTWV0aG9kS2luZCxcbiAgaGFuZGxlcihjb21tYW5kLCByZXNvdXJjZSwgZGV0YWlsKSB7XG4gICAgY29tbWFuZC5jb21tYW5kKFwiaW52b2tlIFtwYXlsb2FkXVwiKS5hY3Rpb24oYXN5bmMgKG1heWJlUGF5bG9hZCkgPT4ge1xuICAgICAgYXdhaXQgaW52b2tlUmVzb3VyY2UocmVzb3VyY2UpO1xuXG4gICAgICBhc3luYyBmdW5jdGlvbiBpbnZva2VSZXNvdXJjZShfcmVzb3VyY2U6IHN0cmluZykge1xuICAgICAgICBpZiAoZGV0YWlsLlJlc291cmNlVHlwZSA9PT0gXCJBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZVwiKSB7XG4gICAgICAgICAgYXdhaXQgaW52b2tlRXhwcmVzc1N0ZXBGdW5jdGlvbihtYXliZVBheWxvYWQsIGRldGFpbCk7XG4gICAgICAgIH0gZWxzZSBpZiAoZGV0YWlsLlJlc291cmNlVHlwZSA9PT0gXCJBV1M6OkxhbWJkYTo6RnVuY3Rpb25cIikge1xuICAgICAgICAgIGF3YWl0IGludm9rZUxhbWJkYShtYXliZVBheWxvYWQsIGRldGFpbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IHN1cHBvcnRlZFwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29tbWFuZC5jb21tYW5kKFwiY29uc29sZVwiKS5hY3Rpb24oYXN5bmMgKF9tYXliZVBheWxvYWQpID0+IHtcbiAgICAgIGF3YWl0IG9wZW5Db25zb2xlKGRldGFpbCk7XG4gICAgfSk7XG4gIH0sXG59KTtcbiJdfQ==