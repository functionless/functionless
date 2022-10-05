"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaFunction = exports.isLambdaFunction = exports.LambdaFunctionKind = void 0;
const memoize_1 = require("../memoize");
const lambda_1 = __importDefault(require("aws-sdk/clients/lambda"));
const util_1 = require("../util");
exports.LambdaFunctionKind = "fl.Function";
function isLambdaFunction(decl) {
    return (decl === null || decl === void 0 ? void 0 : decl.kind) === exports.LambdaFunctionKind;
}
exports.isLambdaFunction = isLambdaFunction;
const lambdaClient = (0, memoize_1.memoize)(() => new lambda_1.default());
function LambdaFunction(handlerOrProps, handlerOrUndefined, 
/**
 * Injected by the compiler.
 */
resourceId) {
    const handler = typeof handlerOrUndefined === "function"
        ? handlerOrUndefined
        : handlerOrProps;
    const props = typeof handlerOrProps === "object" ? handlerOrProps : undefined;
    async function func(input) {
        // eslint-disable-next-line turbo/no-undeclared-env-vars
        if (process.env.RESOURCE_ID === resourceId || process.env.FL_LOCAL) {
            // this Function was invoked, so run its handler path
            return handler(input);
        }
        else {
            // this function was called from within another Lambda, so invoke it
            return lambdaClient()
                .invoke({
                FunctionName: getFunctionName(),
                Payload: JSON.stringify(input),
            })
                .promise();
        }
    }
    function getFunctionName() {
        // eslint-disable-next-line turbo/no-undeclared-env-vars
        return process.env[`${(0, util_1.getEnvironmentVariableName)(resourceId)}_NAME`];
    }
    Object.assign(func, {
        kind: "fl.Function",
        handler,
        props,
        resourceId,
    });
    return func;
}
exports.LambdaFunction = LambdaFunction;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLWZ1bmN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2ludGVyZmFjZS9sYW1iZGEtZnVuY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQ0Esd0NBQXFDO0FBQ3JDLG9FQUE0QztBQUM1QyxrQ0FBcUQ7QUFJeEMsUUFBQSxrQkFBa0IsR0FBRyxhQUFhLENBQUM7QUFVaEQsU0FBZ0IsZ0JBQWdCLENBQzlCLElBQVM7SUFFVCxPQUFPLENBQUEsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLElBQUksTUFBSywwQkFBa0IsQ0FBQztBQUMzQyxDQUFDO0FBSkQsNENBSUM7QUFFRCxNQUFNLFlBQVksR0FBRyxJQUFBLGlCQUFPLEVBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxnQkFBTSxFQUFFLENBQUMsQ0FBQztBQVlqRCxTQUFnQixjQUFjLENBQzVCLGNBQXlFLEVBQ3pFLGtCQUE0RDtBQUM1RDs7R0FFRztBQUNILFVBQW1CO0lBRW5CLE1BQU0sT0FBTyxHQUNYLE9BQU8sa0JBQWtCLEtBQUssVUFBVTtRQUN0QyxDQUFDLENBQUMsa0JBQWtCO1FBQ3BCLENBQUMsQ0FBQyxjQUFjLENBQUM7SUFDckIsTUFBTSxLQUFLLEdBQUcsT0FBTyxjQUFjLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUU5RSxLQUFLLFVBQVUsSUFBSSxDQUFDLEtBQVU7UUFDNUIsd0RBQXdEO1FBQ3hELElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEtBQUssVUFBVSxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFO1lBQ2xFLHFEQUFxRDtZQUNyRCxPQUFPLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUN2QjthQUFNO1lBQ0wsb0VBQW9FO1lBQ3BFLE9BQU8sWUFBWSxFQUFFO2lCQUNsQixNQUFNLENBQUM7Z0JBQ04sWUFBWSxFQUFFLGVBQWUsRUFBRTtnQkFDL0IsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDO2FBQy9CLENBQUM7aUJBQ0QsT0FBTyxFQUFFLENBQUM7U0FDZDtJQUNILENBQUM7SUFFRCxTQUFTLGVBQWU7UUFDdEIsd0RBQXdEO1FBQ3hELE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUEsaUNBQTBCLEVBQUMsVUFBVyxDQUFDLE9BQU8sQ0FBRSxDQUFDO0lBQ3pFLENBQUM7SUFFRCxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRTtRQUNsQixJQUFJLEVBQUUsYUFBYTtRQUNuQixPQUFPO1FBQ1AsS0FBSztRQUNMLFVBQVU7S0FDWCxDQUFDLENBQUM7SUFFSCxPQUFPLElBQVcsQ0FBQztBQUNyQixDQUFDO0FBM0NELHdDQTJDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlICogYXMgZnVuY3Rpb25sZXNzIGZyb20gXCJmdW5jdGlvbmxlc3NcIjtcbmltcG9ydCB7IG1lbW9pemUgfSBmcm9tIFwiLi4vbWVtb2l6ZVwiO1xuaW1wb3J0IExhbWJkYSBmcm9tIFwiYXdzLXNkay9jbGllbnRzL2xhbWJkYVwiO1xuaW1wb3J0IHsgZ2V0RW52aXJvbm1lbnRWYXJpYWJsZU5hbWUgfSBmcm9tIFwiLi4vdXRpbFwiO1xuXG5leHBvcnQgdHlwZSBGdW5jdGlvbkhhbmRsZXI8SW4gPSBhbnksIE91dCA9IGFueT4gPSAoaW5wdXQ6IEluKSA9PiBQcm9taXNlPE91dD47XG5cbmV4cG9ydCBjb25zdCBMYW1iZGFGdW5jdGlvbktpbmQgPSBcImZsLkZ1bmN0aW9uXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGFtYmRhRnVuY3Rpb248RiBleHRlbmRzIEZ1bmN0aW9uSGFuZGxlciA9IEZ1bmN0aW9uSGFuZGxlcj4ge1xuICAoLi4uYXJnczogUGFyYW1ldGVyczxGPik6IFJldHVyblR5cGU8Rj47XG5cbiAga2luZDogdHlwZW9mIExhbWJkYUZ1bmN0aW9uS2luZDtcbiAgaGFuZGxlcjogRjtcbiAgcHJvcHM6IGZ1bmN0aW9ubGVzcy5GdW5jdGlvblByb3BzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNMYW1iZGFGdW5jdGlvbjxGIGV4dGVuZHMgRnVuY3Rpb25IYW5kbGVyPihcbiAgZGVjbDogYW55XG4pOiBkZWNsIGlzIExhbWJkYUZ1bmN0aW9uPEY+IHtcbiAgcmV0dXJuIGRlY2w/LmtpbmQgPT09IExhbWJkYUZ1bmN0aW9uS2luZDtcbn1cblxuY29uc3QgbGFtYmRhQ2xpZW50ID0gbWVtb2l6ZSgoKSA9PiBuZXcgTGFtYmRhKCkpO1xuXG4vLyBAdHMtaWdub3JlIC0gdGhpcyBpcyB0aGUgcHVibGljIGludGVyZmFjZSBmb3IgdGhlIGNvbnN1bWVyLCB0aGUgY29tcGlsZXIgd2lsbCBpbmplY3QgdGhlIElEXG5leHBvcnQgZnVuY3Rpb24gTGFtYmRhRnVuY3Rpb248RiBleHRlbmRzIChpbnB1dDogYW55KSA9PiBQcm9taXNlPGFueT4+KFxuICBoYW5kbGVyOiBGXG4pOiBMYW1iZGFGdW5jdGlvbjxGPjtcblxuZXhwb3J0IGZ1bmN0aW9uIExhbWJkYUZ1bmN0aW9uPEYgZXh0ZW5kcyAoaW5wdXQ6IGFueSkgPT4gUHJvbWlzZTxhbnk+PihcbiAgcHJvcHM6IGZ1bmN0aW9ubGVzcy5GdW5jdGlvblByb3BzLFxuICBoYW5kbGVyOiBGXG4pOiBMYW1iZGFGdW5jdGlvbjxGPjtcblxuZXhwb3J0IGZ1bmN0aW9uIExhbWJkYUZ1bmN0aW9uKFxuICBoYW5kbGVyT3JQcm9wczogKGlucHV0OiBhbnkpID0+IFByb21pc2U8YW55PiB8IGZ1bmN0aW9ubGVzcy5GdW5jdGlvblByb3BzLFxuICBoYW5kbGVyT3JVbmRlZmluZWQ6IChpbnB1dDogYW55KSA9PiBQcm9taXNlPGFueT4gfCB1bmRlZmluZWQsXG4gIC8qKlxuICAgKiBJbmplY3RlZCBieSB0aGUgY29tcGlsZXIuXG4gICAqL1xuICByZXNvdXJjZUlkPzogc3RyaW5nXG4pIHtcbiAgY29uc3QgaGFuZGxlciA9XG4gICAgdHlwZW9mIGhhbmRsZXJPclVuZGVmaW5lZCA9PT0gXCJmdW5jdGlvblwiXG4gICAgICA/IGhhbmRsZXJPclVuZGVmaW5lZFxuICAgICAgOiBoYW5kbGVyT3JQcm9wcztcbiAgY29uc3QgcHJvcHMgPSB0eXBlb2YgaGFuZGxlck9yUHJvcHMgPT09IFwib2JqZWN0XCIgPyBoYW5kbGVyT3JQcm9wcyA6IHVuZGVmaW5lZDtcblxuICBhc3luYyBmdW5jdGlvbiBmdW5jKGlucHV0OiBhbnkpIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgdHVyYm8vbm8tdW5kZWNsYXJlZC1lbnYtdmFyc1xuICAgIGlmIChwcm9jZXNzLmVudi5SRVNPVVJDRV9JRCA9PT0gcmVzb3VyY2VJZCB8fCBwcm9jZXNzLmVudi5GTF9MT0NBTCkge1xuICAgICAgLy8gdGhpcyBGdW5jdGlvbiB3YXMgaW52b2tlZCwgc28gcnVuIGl0cyBoYW5kbGVyIHBhdGhcbiAgICAgIHJldHVybiBoYW5kbGVyKGlucHV0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdGhpcyBmdW5jdGlvbiB3YXMgY2FsbGVkIGZyb20gd2l0aGluIGFub3RoZXIgTGFtYmRhLCBzbyBpbnZva2UgaXRcbiAgICAgIHJldHVybiBsYW1iZGFDbGllbnQoKVxuICAgICAgICAuaW52b2tlKHtcbiAgICAgICAgICBGdW5jdGlvbk5hbWU6IGdldEZ1bmN0aW9uTmFtZSgpLFxuICAgICAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KGlucHV0KSxcbiAgICAgICAgfSlcbiAgICAgICAgLnByb21pc2UoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBnZXRGdW5jdGlvbk5hbWUoKTogc3RyaW5nIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgdHVyYm8vbm8tdW5kZWNsYXJlZC1lbnYtdmFyc1xuICAgIHJldHVybiBwcm9jZXNzLmVudltgJHtnZXRFbnZpcm9ubWVudFZhcmlhYmxlTmFtZShyZXNvdXJjZUlkISl9X05BTUVgXSE7XG4gIH1cblxuICBPYmplY3QuYXNzaWduKGZ1bmMsIHtcbiAgICBraW5kOiBcImZsLkZ1bmN0aW9uXCIsXG4gICAgaGFuZGxlcixcbiAgICBwcm9wcyxcbiAgICByZXNvdXJjZUlkLFxuICB9KTtcblxuICByZXR1cm4gZnVuYyBhcyBhbnk7XG59XG4iXX0=