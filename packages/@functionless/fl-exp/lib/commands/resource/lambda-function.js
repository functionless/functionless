"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invokeLambda = void 0;
const command_provider_1 = require("../../command-provider");
const lambda_1 = __importDefault(require("aws-sdk/clients/lambda"));
const cloudwatchlogs_1 = __importDefault(require("aws-sdk/clients/cloudwatchlogs"));
const lambda_function_1 = require("../../interface/lambda-function");
const util_1 = require("util");
const credentials_1 = require("../../credentials");
const open_console_1 = require("./open-console");
async function invokeLambda(maybePayload, detail) {
    var _a;
    const payload = typeof maybePayload === "string" ? maybePayload : "{}";
    const lambdaName = detail.PhysicalResourceId;
    if (!lambdaName) {
        throw new Error("Could not determine lambda name");
    }
    const lambda = new lambda_1.default((0, credentials_1.getClientProps)());
    const { Payload } = await lambda
        .invoke({
        FunctionName: lambdaName,
        Payload: payload,
    })
        .promise();
    console.log(JSON.stringify(JSON.parse((_a = Payload === null || Payload === void 0 ? void 0 : Payload.toString()) !== null && _a !== void 0 ? _a : ""), null, 2));
}
exports.invokeLambda = invokeLambda;
(0, command_provider_1.registerCommand)({
    resourceKind: lambda_function_1.LambdaFunctionKind,
    handler: async (command, _resourceKind, detail) => {
        command.command("invoke [payload]").action(async (maybePayload) => {
            await invokeLambda(maybePayload, detail);
        });
        command.command("logs").action(async () => {
            var _a;
            const lambdaName = detail.PhysicalResourceId;
            const logsClient = new cloudwatchlogs_1.default();
            let lastEventTime = new Date().getTime();
            console.log("Starting logs...");
            while (true) {
                const logs = await logsClient
                    .filterLogEvents({
                    logGroupName: `/aws/lambda/${lambdaName}`,
                    startTime: lastEventTime ? lastEventTime + 1 : undefined,
                })
                    .promise();
                (_a = logs.events) === null || _a === void 0 ? void 0 : _a.forEach((event) => {
                    process.stdout.write(`[${event.timestamp}] -- ${event.message}`);
                    if (event.timestamp) {
                        lastEventTime = event.timestamp;
                    }
                });
                await (0, util_1.promisify)(setTimeout)(1000);
            }
        });
        command.command("console").action(async () => {
            await (0, open_console_1.openConsole)(detail);
        });
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLWZ1bmN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvbW1hbmRzL3Jlc291cmNlL2xhbWJkYS1mdW5jdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSw2REFBeUQ7QUFDekQsb0VBQTRDO0FBQzVDLG9GQUFrRDtBQUNsRCxxRUFBcUU7QUFDckUsK0JBQWlDO0FBRWpDLG1EQUFtRDtBQUNuRCxpREFBNkM7QUFFdEMsS0FBSyxVQUFVLFlBQVksQ0FDaEMsWUFBZ0MsRUFDaEMsTUFBMkI7O0lBRTNCLE1BQU0sT0FBTyxHQUFHLE9BQU8sWUFBWSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDdkUsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLGtCQUFrQixDQUFDO0lBRTdDLElBQUksQ0FBQyxVQUFVLEVBQUU7UUFDZixNQUFNLElBQUksS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7S0FDcEQ7SUFFRCxNQUFNLE1BQU0sR0FBRyxJQUFJLGdCQUFNLENBQUMsSUFBQSw0QkFBYyxHQUFFLENBQUMsQ0FBQztJQUU1QyxNQUFNLEVBQUUsT0FBTyxFQUFFLEdBQUcsTUFBTSxNQUFNO1NBQzdCLE1BQU0sQ0FBQztRQUNOLFlBQVksRUFBRSxVQUFVO1FBQ3hCLE9BQU8sRUFBRSxPQUFPO0tBQ2pCLENBQUM7U0FDRCxPQUFPLEVBQUUsQ0FBQztJQUViLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQUEsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLFFBQVEsRUFBRSxtQ0FBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5RSxDQUFDO0FBckJELG9DQXFCQztBQUVELElBQUEsa0NBQWUsRUFBQztJQUNkLFlBQVksRUFBRSxvQ0FBa0I7SUFDaEMsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQ2hELE9BQU8sQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLFlBQVksRUFBRSxFQUFFO1lBQ2hFLE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUMzQyxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFOztZQUN4QyxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsa0JBQWtCLENBQUM7WUFFN0MsTUFBTSxVQUFVLEdBQUcsSUFBSSx3QkFBSSxFQUFFLENBQUM7WUFDOUIsSUFBSSxhQUFhLEdBQXVCLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDN0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBQ2hDLE9BQU8sSUFBSSxFQUFFO2dCQUNYLE1BQU0sSUFBSSxHQUFHLE1BQU0sVUFBVTtxQkFDMUIsZUFBZSxDQUFDO29CQUNmLFlBQVksRUFBRSxlQUFlLFVBQVUsRUFBRTtvQkFDekMsU0FBUyxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztpQkFDekQsQ0FBQztxQkFDRCxPQUFPLEVBQUUsQ0FBQztnQkFDYixNQUFBLElBQUksQ0FBQyxNQUFNLDBDQUFFLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO29CQUM3QixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxTQUFTLFFBQVEsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7b0JBQ2pFLElBQUksS0FBSyxDQUFDLFNBQVMsRUFBRTt3QkFDbkIsYUFBYSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUM7cUJBQ2pDO2dCQUNILENBQUMsQ0FBQyxDQUFDO2dCQUVILE1BQU0sSUFBQSxnQkFBUyxFQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ25DO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLElBQUksRUFBRTtZQUMzQyxNQUFNLElBQUEsMEJBQVcsRUFBQyxNQUFNLENBQUMsQ0FBQztRQUM1QixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZWdpc3RlckNvbW1hbmQgfSBmcm9tIFwiLi4vLi4vY29tbWFuZC1wcm92aWRlclwiO1xuaW1wb3J0IExhbWJkYSBmcm9tIFwiYXdzLXNkay9jbGllbnRzL2xhbWJkYVwiO1xuaW1wb3J0IExvZ3MgZnJvbSBcImF3cy1zZGsvY2xpZW50cy9jbG91ZHdhdGNobG9nc1wiO1xuaW1wb3J0IHsgTGFtYmRhRnVuY3Rpb25LaW5kIH0gZnJvbSBcIi4uLy4uL2ludGVyZmFjZS9sYW1iZGEtZnVuY3Rpb25cIjtcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gXCJ1dGlsXCI7XG5pbXBvcnQgeyBTdGFja1Jlc291cmNlRGV0YWlsIH0gZnJvbSBcImF3cy1zZGsvY2xpZW50cy9jbG91ZGZvcm1hdGlvblwiO1xuaW1wb3J0IHsgZ2V0Q2xpZW50UHJvcHMgfSBmcm9tIFwiLi4vLi4vY3JlZGVudGlhbHNcIjtcbmltcG9ydCB7IG9wZW5Db25zb2xlIH0gZnJvbSBcIi4vb3Blbi1jb25zb2xlXCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbnZva2VMYW1iZGEoXG4gIG1heWJlUGF5bG9hZDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICBkZXRhaWw6IFN0YWNrUmVzb3VyY2VEZXRhaWxcbikge1xuICBjb25zdCBwYXlsb2FkID0gdHlwZW9mIG1heWJlUGF5bG9hZCA9PT0gXCJzdHJpbmdcIiA/IG1heWJlUGF5bG9hZCA6IFwie31cIjtcbiAgY29uc3QgbGFtYmRhTmFtZSA9IGRldGFpbC5QaHlzaWNhbFJlc291cmNlSWQ7XG5cbiAgaWYgKCFsYW1iZGFOYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ291bGQgbm90IGRldGVybWluZSBsYW1iZGEgbmFtZVwiKTtcbiAgfVxuXG4gIGNvbnN0IGxhbWJkYSA9IG5ldyBMYW1iZGEoZ2V0Q2xpZW50UHJvcHMoKSk7XG5cbiAgY29uc3QgeyBQYXlsb2FkIH0gPSBhd2FpdCBsYW1iZGFcbiAgICAuaW52b2tlKHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogbGFtYmRhTmFtZSxcbiAgICAgIFBheWxvYWQ6IHBheWxvYWQsXG4gICAgfSlcbiAgICAucHJvbWlzZSgpO1xuXG4gIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KEpTT04ucGFyc2UoUGF5bG9hZD8udG9TdHJpbmcoKSA/PyBcIlwiKSwgbnVsbCwgMikpO1xufVxuXG5yZWdpc3RlckNvbW1hbmQoe1xuICByZXNvdXJjZUtpbmQ6IExhbWJkYUZ1bmN0aW9uS2luZCxcbiAgaGFuZGxlcjogYXN5bmMgKGNvbW1hbmQsIF9yZXNvdXJjZUtpbmQsIGRldGFpbCkgPT4ge1xuICAgIGNvbW1hbmQuY29tbWFuZChcImludm9rZSBbcGF5bG9hZF1cIikuYWN0aW9uKGFzeW5jIChtYXliZVBheWxvYWQpID0+IHtcbiAgICAgIGF3YWl0IGludm9rZUxhbWJkYShtYXliZVBheWxvYWQsIGRldGFpbCk7XG4gICAgfSk7XG5cbiAgICBjb21tYW5kLmNvbW1hbmQoXCJsb2dzXCIpLmFjdGlvbihhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBsYW1iZGFOYW1lID0gZGV0YWlsLlBoeXNpY2FsUmVzb3VyY2VJZDtcblxuICAgICAgY29uc3QgbG9nc0NsaWVudCA9IG5ldyBMb2dzKCk7XG4gICAgICBsZXQgbGFzdEV2ZW50VGltZTogdW5kZWZpbmVkIHwgbnVtYmVyID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICBjb25zb2xlLmxvZyhcIlN0YXJ0aW5nIGxvZ3MuLi5cIik7XG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBjb25zdCBsb2dzID0gYXdhaXQgbG9nc0NsaWVudFxuICAgICAgICAgIC5maWx0ZXJMb2dFdmVudHMoe1xuICAgICAgICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9sYW1iZGEvJHtsYW1iZGFOYW1lfWAsXG4gICAgICAgICAgICBzdGFydFRpbWU6IGxhc3RFdmVudFRpbWUgPyBsYXN0RXZlbnRUaW1lICsgMSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5wcm9taXNlKCk7XG4gICAgICAgIGxvZ3MuZXZlbnRzPy5mb3JFYWNoKChldmVudCkgPT4ge1xuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGBbJHtldmVudC50aW1lc3RhbXB9XSAtLSAke2V2ZW50Lm1lc3NhZ2V9YCk7XG4gICAgICAgICAgaWYgKGV2ZW50LnRpbWVzdGFtcCkge1xuICAgICAgICAgICAgbGFzdEV2ZW50VGltZSA9IGV2ZW50LnRpbWVzdGFtcDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGF3YWl0IHByb21pc2lmeShzZXRUaW1lb3V0KSgxMDAwKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbW1hbmQuY29tbWFuZChcImNvbnNvbGVcIikuYWN0aW9uKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IG9wZW5Db25zb2xlKGRldGFpbCk7XG4gICAgfSk7XG4gIH0sXG59KTtcbiJdfQ==