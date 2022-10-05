"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openConsole = void 0;
const open_1 = __importDefault(require("open"));
async function openConsole(detail) {
    const lambdaName = detail.PhysicalResourceId;
    if (detail.ResourceType === "AWS::StepFunctions::StateMachine") {
        const stepFunctionName = detail.PhysicalResourceId;
        (0, open_1.default)(`https://us-east-1.console.aws.amazon.com/states/home?region=us-east-1#/statemachines/view/${stepFunctionName}`);
    }
    else if (detail.ResourceType === "AWS::Lambda::Function") {
        (0, open_1.default)(`https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/${lambdaName}?tab=code`);
    }
}
exports.openConsole = openConsole;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3Blbi1jb25zb2xlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvbW1hbmRzL3Jlc291cmNlL29wZW4tY29uc29sZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFDQSxnREFBd0I7QUFFakIsS0FBSyxVQUFVLFdBQVcsQ0FBQyxNQUEyQjtJQUMzRCxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsa0JBQWtCLENBQUM7SUFFN0MsSUFBSSxNQUFNLENBQUMsWUFBWSxLQUFLLGtDQUFrQyxFQUFFO1FBQzlELE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLGtCQUFrQixDQUFDO1FBQ25ELElBQUEsY0FBSSxFQUNGLDZGQUE2RixnQkFBZ0IsRUFBRSxDQUNoSCxDQUFDO0tBQ0g7U0FBTSxJQUFJLE1BQU0sQ0FBQyxZQUFZLEtBQUssdUJBQXVCLEVBQUU7UUFDMUQsSUFBQSxjQUFJLEVBQ0Ysb0ZBQW9GLFVBQVUsV0FBVyxDQUMxRyxDQUFDO0tBQ0g7QUFDSCxDQUFDO0FBYkQsa0NBYUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTdGFja1Jlc291cmNlRGV0YWlsIH0gZnJvbSBcImF3cy1zZGsvY2xpZW50cy9jbG91ZGZvcm1hdGlvblwiO1xuaW1wb3J0IG9wZW4gZnJvbSBcIm9wZW5cIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5Db25zb2xlKGRldGFpbDogU3RhY2tSZXNvdXJjZURldGFpbCkge1xuICBjb25zdCBsYW1iZGFOYW1lID0gZGV0YWlsLlBoeXNpY2FsUmVzb3VyY2VJZDtcblxuICBpZiAoZGV0YWlsLlJlc291cmNlVHlwZSA9PT0gXCJBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZVwiKSB7XG4gICAgY29uc3Qgc3RlcEZ1bmN0aW9uTmFtZSA9IGRldGFpbC5QaHlzaWNhbFJlc291cmNlSWQ7XG4gICAgb3BlbihcbiAgICAgIGBodHRwczovL3VzLWVhc3QtMS5jb25zb2xlLmF3cy5hbWF6b24uY29tL3N0YXRlcy9ob21lP3JlZ2lvbj11cy1lYXN0LTEjL3N0YXRlbWFjaGluZXMvdmlldy8ke3N0ZXBGdW5jdGlvbk5hbWV9YFxuICAgICk7XG4gIH0gZWxzZSBpZiAoZGV0YWlsLlJlc291cmNlVHlwZSA9PT0gXCJBV1M6OkxhbWJkYTo6RnVuY3Rpb25cIikge1xuICAgIG9wZW4oXG4gICAgICBgaHR0cHM6Ly91cy1lYXN0LTEuY29uc29sZS5hd3MuYW1hem9uLmNvbS9sYW1iZGEvaG9tZT9yZWdpb249dXMtZWFzdC0xIy9mdW5jdGlvbnMvJHtsYW1iZGFOYW1lfT90YWI9Y29kZWBcbiAgICApO1xuICB9XG59XG4iXX0=