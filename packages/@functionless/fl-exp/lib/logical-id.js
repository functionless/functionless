"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logicalIdForPath = exports.resolveStackDetail = void 0;
const cloudformation_1 = __importDefault(require("aws-sdk/clients/cloudformation"));
const crypto_1 = __importDefault(require("crypto"));
const credentials_1 = require("./credentials");
async function resolveStackDetail(stackName, logicalId) {
    const cfnClient = new cloudformation_1.default((0, credentials_1.getClientProps)());
    const { StackResourceDetail } = await cfnClient
        .describeStackResource({
        StackName: stackName,
        LogicalResourceId: logicalId,
    })
        .promise();
    if (!StackResourceDetail) {
        return;
    }
    return StackResourceDetail;
}
exports.resolveStackDetail = resolveStackDetail;
function logicalIdForPath(idPath) {
    var _a;
    const parts = idPath.split("/").filter((part) => part !== "Resource");
    const md5 = crypto_1.default.createHash("md5").update(parts.join("")).digest("hex");
    const localId = (_a = parts.at(parts.length - 1)) === null || _a === void 0 ? void 0 : _a.replace(/[^A-Za-z0-9]+/g, "");
    return `${localId}${md5}`.slice(0, 255);
}
exports.logicalIdForPath = logicalIdForPath;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9naWNhbC1pZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9sb2dpY2FsLWlkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLG9GQUE0RDtBQUM1RCxvREFBNEI7QUFDNUIsK0NBQStDO0FBRXhDLEtBQUssVUFBVSxrQkFBa0IsQ0FBQyxTQUFpQixFQUFFLFNBQWlCO0lBQzNFLE1BQU0sU0FBUyxHQUFHLElBQUksd0JBQWMsQ0FBQyxJQUFBLDRCQUFjLEdBQUUsQ0FBQyxDQUFDO0lBRXZELE1BQU0sRUFBRSxtQkFBbUIsRUFBRSxHQUFHLE1BQU0sU0FBUztTQUM1QyxxQkFBcUIsQ0FBQztRQUNyQixTQUFTLEVBQUUsU0FBUztRQUNwQixpQkFBaUIsRUFBRSxTQUFTO0tBQzdCLENBQUM7U0FDRCxPQUFPLEVBQUUsQ0FBQztJQUViLElBQUksQ0FBQyxtQkFBbUIsRUFBRTtRQUN4QixPQUFPO0tBQ1I7SUFFRCxPQUFPLG1CQUFtQixDQUFDO0FBQzdCLENBQUM7QUFmRCxnREFlQztBQUVELFNBQWdCLGdCQUFnQixDQUFDLE1BQWM7O0lBQzdDLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLENBQUM7SUFDdEUsTUFBTSxHQUFHLEdBQUcsZ0JBQU0sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDMUUsTUFBTSxPQUFPLEdBQUcsTUFBQSxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLDBDQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLENBQUUsQ0FBQztJQUMzRSxPQUFPLEdBQUcsT0FBTyxHQUFHLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDMUMsQ0FBQztBQUxELDRDQUtDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IENsb3VkRm9ybWF0aW9uIGZyb20gXCJhd3Mtc2RrL2NsaWVudHMvY2xvdWRmb3JtYXRpb25cIjtcbmltcG9ydCBjcnlwdG8gZnJvbSBcImNyeXB0b1wiO1xuaW1wb3J0IHsgZ2V0Q2xpZW50UHJvcHMgfSBmcm9tIFwiLi9jcmVkZW50aWFsc1wiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZVN0YWNrRGV0YWlsKHN0YWNrTmFtZTogc3RyaW5nLCBsb2dpY2FsSWQ6IHN0cmluZykge1xuICBjb25zdCBjZm5DbGllbnQgPSBuZXcgQ2xvdWRGb3JtYXRpb24oZ2V0Q2xpZW50UHJvcHMoKSk7XG5cbiAgY29uc3QgeyBTdGFja1Jlc291cmNlRGV0YWlsIH0gPSBhd2FpdCBjZm5DbGllbnRcbiAgICAuZGVzY3JpYmVTdGFja1Jlc291cmNlKHtcbiAgICAgIFN0YWNrTmFtZTogc3RhY2tOYW1lLFxuICAgICAgTG9naWNhbFJlc291cmNlSWQ6IGxvZ2ljYWxJZCxcbiAgICB9KVxuICAgIC5wcm9taXNlKCk7XG5cbiAgaWYgKCFTdGFja1Jlc291cmNlRGV0YWlsKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgcmV0dXJuIFN0YWNrUmVzb3VyY2VEZXRhaWw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dpY2FsSWRGb3JQYXRoKGlkUGF0aDogc3RyaW5nKSB7XG4gIGNvbnN0IHBhcnRzID0gaWRQYXRoLnNwbGl0KFwiL1wiKS5maWx0ZXIoKHBhcnQpID0+IHBhcnQgIT09IFwiUmVzb3VyY2VcIik7XG4gIGNvbnN0IG1kNSA9IGNyeXB0by5jcmVhdGVIYXNoKFwibWQ1XCIpLnVwZGF0ZShwYXJ0cy5qb2luKFwiXCIpKS5kaWdlc3QoXCJoZXhcIik7XG4gIGNvbnN0IGxvY2FsSWQgPSBwYXJ0cy5hdChwYXJ0cy5sZW5ndGggLSAxKT8ucmVwbGFjZSgvW15BLVphLXowLTldKy9nLCBcIlwiKSE7XG4gIHJldHVybiBgJHtsb2NhbElkfSR7bWQ1fWAuc2xpY2UoMCwgMjU1KTtcbn1cbiJdfQ==