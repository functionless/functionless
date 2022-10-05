"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadProject = void 0;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const interface_1 = require("./interface");
const util_1 = require("./util");
const folder_1 = require("./tree/folder");
const project_1 = require("./project");
const file_1 = require("./tree/file");
/**
 * Loads a {@link Project} from the file system.
 * 1. Load `<root-dir>/package.json`
 *    - error if it does not exist.
 * 2. Extract the `name` property from `package.json` for use as the `projectName`.
 *    - error if it does not exist or is not a string.
 * 3. Load the `src/` directory from `<root-dir>/src/`
 *    - error id it does not exist
 *    - TODO: allow for it to be configurable?
 *    - TODO: should we allow for more than one module root?
 *
 * @param rootDir the {@link Project}'s root directory.
 * @returns a fully loaded {@link Project}
 * @throws an error if the project is not structurally valid.
 */
async function loadProject(rootDir) {
    require("functionless/register");
    const pkgJsonPath = path_1.default.join(rootDir, "package.json");
    if (!(await (0, util_1.exists)(pkgJsonPath))) {
        throw new Error(`file not found: ${pkgJsonPath}`);
    }
    const pkgJson = JSON.parse((await promises_1.default.readFile(pkgJsonPath)).toString("utf-8"));
    const projectName = pkgJson.name;
    if (typeof projectName !== "string") {
        throw new Error(`expected 'name' to be a string in ${pkgJsonPath}`);
    }
    // TODO: make src configurable?
    const srcDir = path_1.default.join(rootDir, "src");
    if (!(await (0, util_1.exists)(srcDir))) {
        throw new Error(`folder not found: ${srcDir}`);
    }
    const absoluteSrcDir = path_1.default.resolve(srcDir);
    return new project_1.Project({
        projectName,
        srcDir: absoluteSrcDir,
        rootDir,
        module: await loadResourceFolder(absoluteSrcDir),
    });
    async function loadResourceFolder(folderName) {
        return new folder_1.Folder((await Promise.all((await (0, util_1.ls)(folderName)).map(async (file) => await loadResourceFile(file)))).reduce((a, b) => b
            ? {
                tree: {
                    ...a.tree,
                    [b.name]: b,
                },
                path: folderName,
            }
            : a, {
            tree: {},
            path: folderName,
        }));
        async function loadResourceFile(filePath) {
            const stat = await promises_1.default.stat(filePath);
            if (stat.isFile()) {
                const resource = require(filePath).default;
                if ((0, interface_1.isResource)(resource)) {
                    return new file_1.File({
                        filePath,
                        resource,
                    });
                }
                else {
                    return undefined;
                }
            }
            else {
                return loadResourceFolder(filePath);
            }
        }
    }
}
exports.loadProject = loadProject;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1wcm9qZWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2xvYWQtcHJvamVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxnREFBd0I7QUFDeEIsMkRBQTZCO0FBQzdCLDJDQUF5QztBQUN6QyxpQ0FBb0M7QUFDcEMsMENBQW9EO0FBQ3BELHVDQUFvQztBQUVwQyxzQ0FBbUM7QUFNbkM7Ozs7Ozs7Ozs7Ozs7O0dBY0c7QUFDSSxLQUFLLFVBQVUsV0FBVyxDQUFDLE9BQWU7SUFDL0MsT0FBTyxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFFakMsTUFBTSxXQUFXLEdBQUcsY0FBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDdkQsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFBLGFBQU0sRUFBQyxXQUFXLENBQUMsQ0FBQyxFQUFFO1FBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLFdBQVcsRUFBRSxDQUFDLENBQUM7S0FDbkQ7SUFDRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUN4QixDQUFDLE1BQU0sa0JBQUUsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQ25ELENBQUM7SUFDRixNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDO0lBQ2pDLElBQUksT0FBTyxXQUFXLEtBQUssUUFBUSxFQUFFO1FBQ25DLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLFdBQVcsRUFBRSxDQUFDLENBQUM7S0FDckU7SUFDRCwrQkFBK0I7SUFDL0IsTUFBTSxNQUFNLEdBQUcsY0FBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDekMsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFBLGFBQU0sRUFBQyxNQUFNLENBQUMsQ0FBQyxFQUFFO1FBQzNCLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLE1BQU0sRUFBRSxDQUFDLENBQUM7S0FDaEQ7SUFFRCxNQUFNLGNBQWMsR0FBRyxjQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzVDLE9BQU8sSUFBSSxpQkFBTyxDQUFDO1FBQ2pCLFdBQVc7UUFDWCxNQUFNLEVBQUUsY0FBYztRQUN0QixPQUFPO1FBQ1AsTUFBTSxFQUFFLE1BQU0sa0JBQWtCLENBQUMsY0FBYyxDQUFDO0tBQ2pELENBQUMsQ0FBQztJQUVILEtBQUssVUFBVSxrQkFBa0IsQ0FBQyxVQUFrQjtRQUNsRCxPQUFPLElBQUksZUFBTSxDQUNmLENBQ0UsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLENBQ0UsTUFBTSxJQUFBLFNBQUUsRUFBQyxVQUFVLENBQUMsQ0FDckIsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsTUFBTSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUNwRCxDQUNGLENBQUMsTUFBTSxDQUNOLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQ1AsQ0FBQztZQUNDLENBQUMsQ0FBQztnQkFDRSxJQUFJLEVBQUU7b0JBQ0osR0FBRyxDQUFDLENBQUMsSUFBSTtvQkFDVCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2lCQUNaO2dCQUNELElBQUksRUFBRSxVQUFVO2FBQ2pCO1lBQ0gsQ0FBQyxDQUFDLENBQUMsRUFDTTtZQUNYLElBQUksRUFBRSxFQUFFO1lBQ1IsSUFBSSxFQUFFLFVBQVU7U0FDakIsQ0FDRixDQUNGLENBQUM7UUFFRixLQUFLLFVBQVUsZ0JBQWdCLENBQzdCLFFBQWdCO1lBRWhCLE1BQU0sSUFBSSxHQUFHLE1BQU0sa0JBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDckMsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUU7Z0JBQ2pCLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQzNDLElBQUksSUFBQSxzQkFBVSxFQUFDLFFBQVEsQ0FBQyxFQUFFO29CQUN4QixPQUFPLElBQUksV0FBSSxDQUFDO3dCQUNkLFFBQVE7d0JBQ1IsUUFBUTtxQkFDVCxDQUFDLENBQUM7aUJBQ0o7cUJBQU07b0JBQ0wsT0FBTyxTQUFTLENBQUM7aUJBQ2xCO2FBQ0Y7aUJBQU07Z0JBQ0wsT0FBTyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUNyQztRQUNILENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQztBQXpFRCxrQ0F5RUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IGZzIGZyb20gXCJmcy9wcm9taXNlc1wiO1xuaW1wb3J0IHsgaXNSZXNvdXJjZSB9IGZyb20gXCIuL2ludGVyZmFjZVwiO1xuaW1wb3J0IHsgZXhpc3RzLCBscyB9IGZyb20gXCIuL3V0aWxcIjtcbmltcG9ydCB7IEZvbGRlciwgRm9sZGVyUHJvcHMgfSBmcm9tIFwiLi90cmVlL2ZvbGRlclwiO1xuaW1wb3J0IHsgUHJvamVjdCB9IGZyb20gXCIuL3Byb2plY3RcIjtcbmltcG9ydCB7IFRyZWUgfSBmcm9tIFwiLi90cmVlL3RyZWVcIjtcbmltcG9ydCB7IEZpbGUgfSBmcm9tIFwiLi90cmVlL2ZpbGVcIjtcblxuZXhwb3J0IGludGVyZmFjZSBMb2FkUHJvamVjdFByb3BzIHtcbiAgcm9vdERpcj86IHN0cmluZztcbn1cblxuLyoqXG4gKiBMb2FkcyBhIHtAbGluayBQcm9qZWN0fSBmcm9tIHRoZSBmaWxlIHN5c3RlbS5cbiAqIDEuIExvYWQgYDxyb290LWRpcj4vcGFja2FnZS5qc29uYFxuICogICAgLSBlcnJvciBpZiBpdCBkb2VzIG5vdCBleGlzdC5cbiAqIDIuIEV4dHJhY3QgdGhlIGBuYW1lYCBwcm9wZXJ0eSBmcm9tIGBwYWNrYWdlLmpzb25gIGZvciB1c2UgYXMgdGhlIGBwcm9qZWN0TmFtZWAuXG4gKiAgICAtIGVycm9yIGlmIGl0IGRvZXMgbm90IGV4aXN0IG9yIGlzIG5vdCBhIHN0cmluZy5cbiAqIDMuIExvYWQgdGhlIGBzcmMvYCBkaXJlY3RvcnkgZnJvbSBgPHJvb3QtZGlyPi9zcmMvYFxuICogICAgLSBlcnJvciBpZCBpdCBkb2VzIG5vdCBleGlzdFxuICogICAgLSBUT0RPOiBhbGxvdyBmb3IgaXQgdG8gYmUgY29uZmlndXJhYmxlP1xuICogICAgLSBUT0RPOiBzaG91bGQgd2UgYWxsb3cgZm9yIG1vcmUgdGhhbiBvbmUgbW9kdWxlIHJvb3Q/XG4gKlxuICogQHBhcmFtIHJvb3REaXIgdGhlIHtAbGluayBQcm9qZWN0fSdzIHJvb3QgZGlyZWN0b3J5LlxuICogQHJldHVybnMgYSBmdWxseSBsb2FkZWQge0BsaW5rIFByb2plY3R9XG4gKiBAdGhyb3dzIGFuIGVycm9yIGlmIHRoZSBwcm9qZWN0IGlzIG5vdCBzdHJ1Y3R1cmFsbHkgdmFsaWQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkUHJvamVjdChyb290RGlyOiBzdHJpbmcpOiBQcm9taXNlPFByb2plY3Q+IHtcbiAgcmVxdWlyZShcImZ1bmN0aW9ubGVzcy9yZWdpc3RlclwiKTtcblxuICBjb25zdCBwa2dKc29uUGF0aCA9IHBhdGguam9pbihyb290RGlyLCBcInBhY2thZ2UuanNvblwiKTtcbiAgaWYgKCEoYXdhaXQgZXhpc3RzKHBrZ0pzb25QYXRoKSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYGZpbGUgbm90IGZvdW5kOiAke3BrZ0pzb25QYXRofWApO1xuICB9XG4gIGNvbnN0IHBrZ0pzb24gPSBKU09OLnBhcnNlKFxuICAgIChhd2FpdCBmcy5yZWFkRmlsZShwa2dKc29uUGF0aCkpLnRvU3RyaW5nKFwidXRmLThcIilcbiAgKTtcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBwa2dKc29uLm5hbWU7XG4gIGlmICh0eXBlb2YgcHJvamVjdE5hbWUgIT09IFwic3RyaW5nXCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYGV4cGVjdGVkICduYW1lJyB0byBiZSBhIHN0cmluZyBpbiAke3BrZ0pzb25QYXRofWApO1xuICB9XG4gIC8vIFRPRE86IG1ha2Ugc3JjIGNvbmZpZ3VyYWJsZT9cbiAgY29uc3Qgc3JjRGlyID0gcGF0aC5qb2luKHJvb3REaXIsIFwic3JjXCIpO1xuICBpZiAoIShhd2FpdCBleGlzdHMoc3JjRGlyKSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYGZvbGRlciBub3QgZm91bmQ6ICR7c3JjRGlyfWApO1xuICB9XG5cbiAgY29uc3QgYWJzb2x1dGVTcmNEaXIgPSBwYXRoLnJlc29sdmUoc3JjRGlyKTtcbiAgcmV0dXJuIG5ldyBQcm9qZWN0KHtcbiAgICBwcm9qZWN0TmFtZSxcbiAgICBzcmNEaXI6IGFic29sdXRlU3JjRGlyLFxuICAgIHJvb3REaXIsXG4gICAgbW9kdWxlOiBhd2FpdCBsb2FkUmVzb3VyY2VGb2xkZXIoYWJzb2x1dGVTcmNEaXIpLFxuICB9KTtcblxuICBhc3luYyBmdW5jdGlvbiBsb2FkUmVzb3VyY2VGb2xkZXIoZm9sZGVyTmFtZTogc3RyaW5nKTogUHJvbWlzZTxGb2xkZXI+IHtcbiAgICByZXR1cm4gbmV3IEZvbGRlcihcbiAgICAgIChcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgKFxuICAgICAgICAgICAgYXdhaXQgbHMoZm9sZGVyTmFtZSlcbiAgICAgICAgICApLm1hcChhc3luYyAoZmlsZSkgPT4gYXdhaXQgbG9hZFJlc291cmNlRmlsZShmaWxlKSlcbiAgICAgICAgKVxuICAgICAgKS5yZWR1Y2U8Rm9sZGVyUHJvcHM+KFxuICAgICAgICAoYSwgYikgPT5cbiAgICAgICAgICBiXG4gICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICB0cmVlOiB7XG4gICAgICAgICAgICAgICAgICAuLi5hLnRyZWUsXG4gICAgICAgICAgICAgICAgICBbYi5uYW1lXTogYixcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHBhdGg6IGZvbGRlck5hbWUsXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIDogYSxcbiAgICAgICAgPEZvbGRlclByb3BzPntcbiAgICAgICAgICB0cmVlOiB7fSxcbiAgICAgICAgICBwYXRoOiBmb2xkZXJOYW1lLFxuICAgICAgICB9XG4gICAgICApXG4gICAgKTtcblxuICAgIGFzeW5jIGZ1bmN0aW9uIGxvYWRSZXNvdXJjZUZpbGUoXG4gICAgICBmaWxlUGF0aDogc3RyaW5nXG4gICAgKTogUHJvbWlzZTxUcmVlIHwgdW5kZWZpbmVkPiB7XG4gICAgICBjb25zdCBzdGF0ID0gYXdhaXQgZnMuc3RhdChmaWxlUGF0aCk7XG4gICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICBjb25zdCByZXNvdXJjZSA9IHJlcXVpcmUoZmlsZVBhdGgpLmRlZmF1bHQ7XG4gICAgICAgIGlmIChpc1Jlc291cmNlKHJlc291cmNlKSkge1xuICAgICAgICAgIHJldHVybiBuZXcgRmlsZSh7XG4gICAgICAgICAgICBmaWxlUGF0aCxcbiAgICAgICAgICAgIHJlc291cmNlLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBsb2FkUmVzb3VyY2VGb2xkZXIoZmlsZVBhdGgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19