"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvironmentVariableName = exports.ls = exports.exists = void 0;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
async function exists(file) {
    try {
        await promises_1.default.access(file, fs_1.constants.F_OK);
        return true;
    }
    catch {
        return false;
    }
}
exports.exists = exists;
async function ls(dir) {
    return (await promises_1.default.readdir(dir)).map((file) => path_1.default.resolve(dir, file));
}
exports.ls = ls;
function getEnvironmentVariableName(resourceId) {
    return resourceId.replaceAll(/[^A-Za-z_0-9]/g, "_");
}
exports.getEnvironmentVariableName = getEnvironmentVariableName;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLGdEQUF3QjtBQUN4QiwyREFBNkI7QUFDN0IsMkJBQStCO0FBRXhCLEtBQUssVUFBVSxNQUFNLENBQUMsSUFBWTtJQUN2QyxJQUFJO1FBQ0YsTUFBTSxrQkFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsY0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RDLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFBQyxNQUFNO1FBQ04sT0FBTyxLQUFLLENBQUM7S0FDZDtBQUNILENBQUM7QUFQRCx3QkFPQztBQUVNLEtBQUssVUFBVSxFQUFFLENBQUMsR0FBVztJQUNsQyxPQUFPLENBQUMsTUFBTSxrQkFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsY0FBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUN4RSxDQUFDO0FBRkQsZ0JBRUM7QUFFRCxTQUFnQiwwQkFBMEIsQ0FBQyxVQUFrQjtJQUMzRCxPQUFPLFVBQVUsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDdEQsQ0FBQztBQUZELGdFQUVDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCBmcyBmcm9tIFwiZnMvcHJvbWlzZXNcIjtcbmltcG9ydCB7IGNvbnN0YW50cyB9IGZyb20gXCJmc1wiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhpc3RzKGZpbGU6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICB0cnkge1xuICAgIGF3YWl0IGZzLmFjY2VzcyhmaWxlLCBjb25zdGFudHMuRl9PSyk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbHMoZGlyOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gIHJldHVybiAoYXdhaXQgZnMucmVhZGRpcihkaXIpKS5tYXAoKGZpbGUpID0+IHBhdGgucmVzb2x2ZShkaXIsIGZpbGUpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEVudmlyb25tZW50VmFyaWFibGVOYW1lKHJlc291cmNlSWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiByZXNvdXJjZUlkLnJlcGxhY2VBbGwoL1teQS1aYS16XzAtOV0vZywgXCJfXCIpO1xufVxuIl19