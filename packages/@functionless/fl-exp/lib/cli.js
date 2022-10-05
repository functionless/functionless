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
// eslint-disable-next-line turbo/no-undeclared-env-vars
process.env.AWS_SDK_LOAD_CONFIG = "1";
const commander_1 = require("commander");
const load_project_1 = require("./load-project");
commander_1.program.command("synth").action(async () => {
    const { cdkSynth } = await Promise.resolve().then(() => __importStar(require("./commands/cdk-synth")));
    return cdkSynth();
});
commander_1.program.command("ls").action(async () => {
    const project = await (0, load_project_1.loadProject)(process.cwd());
    project.resourceFiles.forEach((file) => {
        console.log(file.address);
    });
});
commander_1.program
    .argument("<resource-path>")
    .action((...args) => {
    console.log(args);
})
    .action(async (resourcePath, ...args) => {
    const { invoke } = await Promise.resolve().then(() => __importStar(require("./commands/resource")));
    return invoke(resourcePath, args);
});
commander_1.program.command("local").action(async () => {
    const { localServer } = await Promise.resolve().then(() => __importStar(require("./commands/local")));
    return localServer();
});
commander_1.program.parse(process.argv);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NsaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsd0RBQXdEO0FBQ3hELE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLEdBQUcsR0FBRyxDQUFDO0FBRXRDLHlDQUFvQztBQUNwQyxpREFBNkM7QUFFN0MsbUJBQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFO0lBQ3pDLE1BQU0sRUFBRSxRQUFRLEVBQUUsR0FBRyx3REFBYSxzQkFBc0IsR0FBQyxDQUFDO0lBQzFELE9BQU8sUUFBUSxFQUFFLENBQUM7QUFDcEIsQ0FBQyxDQUFDLENBQUM7QUFFSCxtQkFBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxJQUFJLEVBQUU7SUFDdEMsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFBLDBCQUFXLEVBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFFakQsT0FBTyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUNyQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM1QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBRUgsbUJBQU87S0FDSixRQUFRLENBQUMsaUJBQWlCLENBQUM7S0FDM0IsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsRUFBRTtJQUNsQixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3BCLENBQUMsQ0FBQztLQUNELE1BQU0sQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUU7SUFDdEMsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLHdEQUFhLHFCQUFxQixHQUFDLENBQUM7SUFDdkQsT0FBTyxNQUFNLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3BDLENBQUMsQ0FBQyxDQUFDO0FBRUwsbUJBQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFO0lBQ3pDLE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyx3REFBYSxrQkFBa0IsR0FBQyxDQUFDO0lBQ3pELE9BQU8sV0FBVyxFQUFFLENBQUM7QUFDdkIsQ0FBQyxDQUFDLENBQUM7QUFFSCxtQkFBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgdHVyYm8vbm8tdW5kZWNsYXJlZC1lbnYtdmFyc1xucHJvY2Vzcy5lbnYuQVdTX1NES19MT0FEX0NPTkZJRyA9IFwiMVwiO1xuXG5pbXBvcnQgeyBwcm9ncmFtIH0gZnJvbSBcImNvbW1hbmRlclwiO1xuaW1wb3J0IHsgbG9hZFByb2plY3QgfSBmcm9tIFwiLi9sb2FkLXByb2plY3RcIjtcblxucHJvZ3JhbS5jb21tYW5kKFwic3ludGhcIikuYWN0aW9uKGFzeW5jICgpID0+IHtcbiAgY29uc3QgeyBjZGtTeW50aCB9ID0gYXdhaXQgaW1wb3J0KFwiLi9jb21tYW5kcy9jZGstc3ludGhcIik7XG4gIHJldHVybiBjZGtTeW50aCgpO1xufSk7XG5cbnByb2dyYW0uY29tbWFuZChcImxzXCIpLmFjdGlvbihhc3luYyAoKSA9PiB7XG4gIGNvbnN0IHByb2plY3QgPSBhd2FpdCBsb2FkUHJvamVjdChwcm9jZXNzLmN3ZCgpKTtcblxuICBwcm9qZWN0LnJlc291cmNlRmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgIGNvbnNvbGUubG9nKGZpbGUuYWRkcmVzcyk7XG4gIH0pO1xufSk7XG5cbnByb2dyYW1cbiAgLmFyZ3VtZW50KFwiPHJlc291cmNlLXBhdGg+XCIpXG4gIC5hY3Rpb24oKC4uLmFyZ3MpID0+IHtcbiAgICBjb25zb2xlLmxvZyhhcmdzKTtcbiAgfSlcbiAgLmFjdGlvbihhc3luYyAocmVzb3VyY2VQYXRoLCAuLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgeyBpbnZva2UgfSA9IGF3YWl0IGltcG9ydChcIi4vY29tbWFuZHMvcmVzb3VyY2VcIik7XG4gICAgcmV0dXJuIGludm9rZShyZXNvdXJjZVBhdGgsIGFyZ3MpO1xuICB9KTtcblxucHJvZ3JhbS5jb21tYW5kKFwibG9jYWxcIikuYWN0aW9uKGFzeW5jICgpID0+IHtcbiAgY29uc3QgeyBsb2NhbFNlcnZlciB9ID0gYXdhaXQgaW1wb3J0KFwiLi9jb21tYW5kcy9sb2NhbFwiKTtcbiAgcmV0dXJuIGxvY2FsU2VydmVyKCk7XG59KTtcblxucHJvZ3JhbS5wYXJzZShwcm9jZXNzLmFyZ3YpO1xuIl19