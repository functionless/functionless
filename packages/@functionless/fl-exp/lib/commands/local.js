"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localServer = void 0;
const path_1 = __importDefault(require("path"));
const local_serve_project_1 = require("../local-serve-project");
const load_project_1 = require("../load-project");
async function localServer() {
    const project = await (0, load_project_1.loadProject)(path_1.default.resolve("./src"));
    await (0, local_serve_project_1.localServeProject)(project);
}
exports.localServer = localServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29tbWFuZHMvbG9jYWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsZ0RBQXdCO0FBQ3hCLGdFQUEyRDtBQUMzRCxrREFBOEM7QUFFdkMsS0FBSyxVQUFVLFdBQVc7SUFDL0IsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFBLDBCQUFXLEVBQUMsY0FBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3pELE1BQU0sSUFBQSx1Q0FBaUIsRUFBQyxPQUFPLENBQUMsQ0FBQztBQUNuQyxDQUFDO0FBSEQsa0NBR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgbG9jYWxTZXJ2ZVByb2plY3QgfSBmcm9tIFwiLi4vbG9jYWwtc2VydmUtcHJvamVjdFwiO1xuaW1wb3J0IHsgbG9hZFByb2plY3QgfSBmcm9tIFwiLi4vbG9hZC1wcm9qZWN0XCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2NhbFNlcnZlcigpIHtcbiAgY29uc3QgcHJvamVjdCA9IGF3YWl0IGxvYWRQcm9qZWN0KHBhdGgucmVzb2x2ZShcIi4vc3JjXCIpKTtcbiAgYXdhaXQgbG9jYWxTZXJ2ZVByb2plY3QocHJvamVjdCk7XG59XG4iXX0=