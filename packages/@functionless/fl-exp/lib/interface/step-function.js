"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepFunction = exports.isStepFunction = exports.StepFunctionKind = void 0;
const stepfunctions_1 = __importDefault(require("aws-sdk/clients/stepfunctions"));
const util_1 = require("../util");
const client_1 = require("./client");
const stepFunctionClient = (0, client_1.createClientFactory)(stepfunctions_1.default);
exports.StepFunctionKind = "fl.StepFunction";
function isStepFunction(decl) {
    return (decl === null || decl === void 0 ? void 0 : decl.kind) === exports.StepFunctionKind;
}
exports.isStepFunction = isStepFunction;
function StepFunction(handlerOrProps, handlerOrUndefined, resourceId, roleArn) {
    const handler = typeof handlerOrProps === "function" ? handlerOrProps : handlerOrUndefined;
    const props = typeof handlerOrProps === "object" ? handlerOrProps : undefined;
    async function entrypoint(input) {
        // eslint-disable-next-line turbo/no-undeclared-env-vars
        if (process.env.FL_LOCAL) {
            // this Function was invoked, so run its handler path
            handler(input);
            return {
                executionArn: "dummy-arn",
                startDate: new Date(),
            };
        }
        else {
            const client = await stepFunctionClient(roleArn);
            // this function was called from within another Lambda, so invoke it
            return client
                .startExecution({
                stateMachineArn: getStateMachineArn(),
                input: JSON.stringify(input),
            })
                .promise();
        }
    }
    function getStateMachineArn() {
        // eslint-disable-next-line turbo/no-undeclared-env-vars
        return process.env[`${(0, util_1.getEnvironmentVariableName)(resourceId)}_ARN`];
    }
    Object.assign(entrypoint, {
        kind: exports.StepFunctionKind,
        handler,
        props,
    });
    return entrypoint;
}
exports.StepFunction = StepFunction;
(function (StepFunction) {
    async function waitSeconds(seconds) {
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    }
    StepFunction.waitSeconds = waitSeconds;
})(StepFunction = exports.StepFunction || (exports.StepFunction = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RlcC1mdW5jdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pbnRlcmZhY2Uvc3RlcC1mdW5jdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxrRkFBMEQ7QUFFMUQsa0NBQXFEO0FBQ3JELHFDQUErQztBQUUvQyxNQUFNLGtCQUFrQixHQUFHLElBQUEsNEJBQW1CLEVBQUMsdUJBQWEsQ0FBQyxDQUFDO0FBT2pELFFBQUEsZ0JBQWdCLEdBQUcsaUJBQWlCLENBQUM7QUFZbEQsU0FBZ0IsY0FBYyxDQUM1QixJQUFTO0lBRVQsT0FBTyxDQUFBLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxJQUFJLE1BQUssd0JBQWdCLENBQUM7QUFDekMsQ0FBQztBQUpELHdDQUlDO0FBV0QsU0FBZ0IsWUFBWSxDQUMxQixjQUFrRCxFQUNsRCxrQkFBc0IsRUFDdEIsVUFBbUIsRUFDbkIsT0FBZ0I7SUFFaEIsTUFBTSxPQUFPLEdBQ1gsT0FBTyxjQUFjLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLGtCQUFtQixDQUFDO0lBQzlFLE1BQU0sS0FBSyxHQUFHLE9BQU8sY0FBYyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFFOUUsS0FBSyxVQUFVLFVBQVUsQ0FBQyxLQUFVO1FBQ2xDLHdEQUF3RDtRQUN4RCxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFO1lBQ3hCLHFEQUFxRDtZQUNyRCxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDZixPQUErQztnQkFDN0MsWUFBWSxFQUFFLFdBQVc7Z0JBQ3pCLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRTthQUN0QixDQUFDO1NBQ0g7YUFBTTtZQUNMLE1BQU0sTUFBTSxHQUFHLE1BQU0sa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDakQsb0VBQW9FO1lBQ3BFLE9BQU8sTUFBTTtpQkFDVixjQUFjLENBQUM7Z0JBQ2QsZUFBZSxFQUFFLGtCQUFrQixFQUFFO2dCQUNyQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUM7YUFDN0IsQ0FBQztpQkFDRCxPQUFPLEVBQUUsQ0FBQztTQUNkO0lBQ0gsQ0FBQztJQUVELFNBQVMsa0JBQWtCO1FBQ3pCLHdEQUF3RDtRQUN4RCxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFBLGlDQUEwQixFQUFDLFVBQVcsQ0FBQyxNQUFNLENBQUUsQ0FBQztJQUN4RSxDQUFDO0lBRUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQW1CO1FBQ3pDLElBQUksRUFBRSx3QkFBZ0I7UUFDdEIsT0FBTztRQUNQLEtBQUs7S0FDTixDQUFDLENBQUM7SUFFSCxPQUFPLFVBQWlCLENBQUM7QUFDM0IsQ0FBQztBQTNDRCxvQ0EyQ0M7QUFFRCxXQUFpQixZQUFZO0lBQ3BCLEtBQUssVUFBVSxXQUFXLENBQUMsT0FBZTtRQUMvQyxNQUFNLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFGcUIsd0JBQVcsY0FFaEMsQ0FBQTtBQUNILENBQUMsRUFKZ0IsWUFBWSxHQUFaLG9CQUFZLEtBQVosb0JBQVksUUFJNUIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgU3RlcEZ1bmN0aW9ucyBmcm9tIFwiYXdzLXNkay9jbGllbnRzL3N0ZXBmdW5jdGlvbnNcIjtcbmltcG9ydCB0eXBlICogYXMgZnVuY3Rpb25sZXNzIGZyb20gXCJmdW5jdGlvbmxlc3NcIjtcbmltcG9ydCB7IGdldEVudmlyb25tZW50VmFyaWFibGVOYW1lIH0gZnJvbSBcIi4uL3V0aWxcIjtcbmltcG9ydCB7IGNyZWF0ZUNsaWVudEZhY3RvcnkgfSBmcm9tIFwiLi9jbGllbnRcIjtcblxuY29uc3Qgc3RlcEZ1bmN0aW9uQ2xpZW50ID0gY3JlYXRlQ2xpZW50RmFjdG9yeShTdGVwRnVuY3Rpb25zKTtcblxuZXhwb3J0IHR5cGUgU3RlcEZ1bmN0aW9uSGFuZGxlcjxcbiAgSW4gZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IGFueSxcbiAgT3V0ID0gYW55XG4+ID0gKGlucHV0OiBJbikgPT4gUHJvbWlzZTxPdXQ+O1xuXG5leHBvcnQgY29uc3QgU3RlcEZ1bmN0aW9uS2luZCA9IFwiZmwuU3RlcEZ1bmN0aW9uXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RlcEZ1bmN0aW9uPFxuICBGIGV4dGVuZHMgU3RlcEZ1bmN0aW9uSGFuZGxlciA9IFN0ZXBGdW5jdGlvbkhhbmRsZXJcbj4ge1xuICAoLi4uYXJnczogUGFyYW1ldGVyczxGPik6IFJldHVyblR5cGU8Rj47XG5cbiAga2luZDogdHlwZW9mIFN0ZXBGdW5jdGlvbktpbmQ7XG4gIGhhbmRsZXI6IEY7XG4gIHByb3BzPzogZnVuY3Rpb25sZXNzLlN0ZXBGdW5jdGlvblByb3BzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTdGVwRnVuY3Rpb248RiBleHRlbmRzIFN0ZXBGdW5jdGlvbkhhbmRsZXI+KFxuICBkZWNsOiBhbnlcbik6IGRlY2wgaXMgU3RlcEZ1bmN0aW9uPEY+IHtcbiAgcmV0dXJuIGRlY2w/LmtpbmQgPT09IFN0ZXBGdW5jdGlvbktpbmQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBTdGVwRnVuY3Rpb248RiBleHRlbmRzIFN0ZXBGdW5jdGlvbkhhbmRsZXI+KFxuICBoYW5kbGVyOiBGXG4pOiBTdGVwRnVuY3Rpb248Rj47XG5cbmV4cG9ydCBmdW5jdGlvbiBTdGVwRnVuY3Rpb248RiBleHRlbmRzIFN0ZXBGdW5jdGlvbkhhbmRsZXI+KFxuICBwcm9wczogZnVuY3Rpb25sZXNzLlN0ZXBGdW5jdGlvblByb3BzLFxuICBoYW5kbGVyOiBGXG4pOiBTdGVwRnVuY3Rpb248Rj47XG5cbmV4cG9ydCBmdW5jdGlvbiBTdGVwRnVuY3Rpb248RiBleHRlbmRzIFN0ZXBGdW5jdGlvbkhhbmRsZXI+KFxuICBoYW5kbGVyT3JQcm9wczogRiB8IGZ1bmN0aW9ubGVzcy5TdGVwRnVuY3Rpb25Qcm9wcyxcbiAgaGFuZGxlck9yVW5kZWZpbmVkPzogRixcbiAgcmVzb3VyY2VJZD86IHN0cmluZyxcbiAgcm9sZUFybj86IHN0cmluZ1xuKTogU3RlcEZ1bmN0aW9uPEY+IHtcbiAgY29uc3QgaGFuZGxlciA9XG4gICAgdHlwZW9mIGhhbmRsZXJPclByb3BzID09PSBcImZ1bmN0aW9uXCIgPyBoYW5kbGVyT3JQcm9wcyA6IGhhbmRsZXJPclVuZGVmaW5lZCE7XG4gIGNvbnN0IHByb3BzID0gdHlwZW9mIGhhbmRsZXJPclByb3BzID09PSBcIm9iamVjdFwiID8gaGFuZGxlck9yUHJvcHMgOiB1bmRlZmluZWQ7XG5cbiAgYXN5bmMgZnVuY3Rpb24gZW50cnlwb2ludChpbnB1dDogYW55KSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHR1cmJvL25vLXVuZGVjbGFyZWQtZW52LXZhcnNcbiAgICBpZiAocHJvY2Vzcy5lbnYuRkxfTE9DQUwpIHtcbiAgICAgIC8vIHRoaXMgRnVuY3Rpb24gd2FzIGludm9rZWQsIHNvIHJ1biBpdHMgaGFuZGxlciBwYXRoXG4gICAgICBoYW5kbGVyKGlucHV0KTtcbiAgICAgIHJldHVybiA8QVdTLlN0ZXBGdW5jdGlvbnMuU3RhcnRFeGVjdXRpb25PdXRwdXQ+e1xuICAgICAgICBleGVjdXRpb25Bcm46IFwiZHVtbXktYXJuXCIsXG4gICAgICAgIHN0YXJ0RGF0ZTogbmV3IERhdGUoKSxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNsaWVudCA9IGF3YWl0IHN0ZXBGdW5jdGlvbkNsaWVudChyb2xlQXJuKTtcbiAgICAgIC8vIHRoaXMgZnVuY3Rpb24gd2FzIGNhbGxlZCBmcm9tIHdpdGhpbiBhbm90aGVyIExhbWJkYSwgc28gaW52b2tlIGl0XG4gICAgICByZXR1cm4gY2xpZW50XG4gICAgICAgIC5zdGFydEV4ZWN1dGlvbih7XG4gICAgICAgICAgc3RhdGVNYWNoaW5lQXJuOiBnZXRTdGF0ZU1hY2hpbmVBcm4oKSxcbiAgICAgICAgICBpbnB1dDogSlNPTi5zdHJpbmdpZnkoaW5wdXQpLFxuICAgICAgICB9KVxuICAgICAgICAucHJvbWlzZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFN0YXRlTWFjaGluZUFybigpOiBzdHJpbmcge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSB0dXJiby9uby11bmRlY2xhcmVkLWVudi12YXJzXG4gICAgcmV0dXJuIHByb2Nlc3MuZW52W2Ake2dldEVudmlyb25tZW50VmFyaWFibGVOYW1lKHJlc291cmNlSWQhKX1fQVJOYF0hO1xuICB9XG5cbiAgT2JqZWN0LmFzc2lnbihlbnRyeXBvaW50LCA8U3RlcEZ1bmN0aW9uPEY+PntcbiAgICBraW5kOiBTdGVwRnVuY3Rpb25LaW5kLFxuICAgIGhhbmRsZXIsXG4gICAgcHJvcHMsXG4gIH0pO1xuXG4gIHJldHVybiBlbnRyeXBvaW50IGFzIGFueTtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBTdGVwRnVuY3Rpb24ge1xuICBleHBvcnQgYXN5bmMgZnVuY3Rpb24gd2FpdFNlY29uZHMoc2Vjb25kczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgc2Vjb25kcyAqIDEwMDApKTtcbiAgfVxufVxuIl19