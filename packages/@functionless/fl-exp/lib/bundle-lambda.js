"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBundleOutFolder = exports.bundleLambdaFunction = void 0;
const path_1 = __importDefault(require("path"));
const esbuild_1 = __importDefault(require("esbuild"));
const promises_1 = __importDefault(require("fs/promises"));
const plugin_1 = require("./plugin");
async function bundleLambdaFunction(project, filename, outFolder, roleArn) {
    const outfile = path_1.default.join(outFolder, "index.js");
    await promises_1.default.mkdir(outFolder, {
        recursive: true,
    });
    await esbuild_1.default.build({
        entryPoints: [filename],
        bundle: true,
        platform: "node",
        // format: "esm",
        outfile,
        plugins: [(0, plugin_1.resourceIdPlugin)(project, roleArn)],
        external: ["aws-sdk"],
        sourcemap: "inline",
        sourcesContent: true,
        minify: false,
    });
    return outfile;
}
exports.bundleLambdaFunction = bundleLambdaFunction;
function getBundleOutFolder(id) {
    const outdir = path_1.default.join(process.cwd(), ".fl");
    return path_1.default.join(outdir, `${id.replaceAll("/", "_")}_lambda`);
}
exports.getBundleOutFolder = getBundleOutFolder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLWxhbWJkYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9idW5kbGUtbGFtYmRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLGdEQUF3QjtBQUN4QixzREFBOEI7QUFDOUIsMkRBQTZCO0FBQzdCLHFDQUE0QztBQUdyQyxLQUFLLFVBQVUsb0JBQW9CLENBQ3hDLE9BQWdCLEVBQ2hCLFFBQWdCLEVBQ2hCLFNBQWlCLEVBQ2pCLE9BQWdCO0lBRWhCLE1BQU0sT0FBTyxHQUFHLGNBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2pELE1BQU0sa0JBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFO1FBQ3hCLFNBQVMsRUFBRSxJQUFJO0tBQ2hCLENBQUMsQ0FBQztJQUVILE1BQU0saUJBQU8sQ0FBQyxLQUFLLENBQUM7UUFDbEIsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDO1FBQ3ZCLE1BQU0sRUFBRSxJQUFJO1FBQ1osUUFBUSxFQUFFLE1BQU07UUFDaEIsaUJBQWlCO1FBQ2pCLE9BQU87UUFDUCxPQUFPLEVBQUUsQ0FBQyxJQUFBLHlCQUFnQixFQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM3QyxRQUFRLEVBQUUsQ0FBQyxTQUFTLENBQUM7UUFDckIsU0FBUyxFQUFFLFFBQVE7UUFDbkIsY0FBYyxFQUFFLElBQUk7UUFDcEIsTUFBTSxFQUFFLEtBQUs7S0FDZCxDQUFDLENBQUM7SUFDSCxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDO0FBeEJELG9EQXdCQztBQUVELFNBQWdCLGtCQUFrQixDQUFDLEVBQVU7SUFDM0MsTUFBTSxNQUFNLEdBQUcsY0FBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDL0MsT0FBTyxjQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNoRSxDQUFDO0FBSEQsZ0RBR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IGVzYnVpbGQgZnJvbSBcImVzYnVpbGRcIjtcbmltcG9ydCBmcyBmcm9tIFwiZnMvcHJvbWlzZXNcIjtcbmltcG9ydCB7IHJlc291cmNlSWRQbHVnaW4gfSBmcm9tIFwiLi9wbHVnaW5cIjtcbmltcG9ydCB7IFByb2plY3QgfSBmcm9tIFwiLi9wcm9qZWN0XCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidW5kbGVMYW1iZGFGdW5jdGlvbihcbiAgcHJvamVjdDogUHJvamVjdCxcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgb3V0Rm9sZGVyOiBzdHJpbmcsXG4gIHJvbGVBcm4/OiBzdHJpbmdcbikge1xuICBjb25zdCBvdXRmaWxlID0gcGF0aC5qb2luKG91dEZvbGRlciwgXCJpbmRleC5qc1wiKTtcbiAgYXdhaXQgZnMubWtkaXIob3V0Rm9sZGVyLCB7XG4gICAgcmVjdXJzaXZlOiB0cnVlLFxuICB9KTtcblxuICBhd2FpdCBlc2J1aWxkLmJ1aWxkKHtcbiAgICBlbnRyeVBvaW50czogW2ZpbGVuYW1lXSxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgcGxhdGZvcm06IFwibm9kZVwiLFxuICAgIC8vIGZvcm1hdDogXCJlc21cIixcbiAgICBvdXRmaWxlLFxuICAgIHBsdWdpbnM6IFtyZXNvdXJjZUlkUGx1Z2luKHByb2plY3QsIHJvbGVBcm4pXSxcbiAgICBleHRlcm5hbDogW1wiYXdzLXNka1wiXSxcbiAgICBzb3VyY2VtYXA6IFwiaW5saW5lXCIsXG4gICAgc291cmNlc0NvbnRlbnQ6IHRydWUsXG4gICAgbWluaWZ5OiBmYWxzZSxcbiAgfSk7XG4gIHJldHVybiBvdXRmaWxlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QnVuZGxlT3V0Rm9sZGVyKGlkOiBzdHJpbmcpIHtcbiAgY29uc3Qgb3V0ZGlyID0gcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIFwiLmZsXCIpO1xuICByZXR1cm4gcGF0aC5qb2luKG91dGRpciwgYCR7aWQucmVwbGFjZUFsbChcIi9cIiwgXCJfXCIpfV9sYW1iZGFgKTtcbn1cbiJdfQ==