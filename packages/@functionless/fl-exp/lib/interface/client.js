"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLocalClient = exports.createClientFactory = void 0;
const sts_1 = __importDefault(require("aws-sdk/clients/sts"));
const credentials_1 = require("../credentials");
const memoize_1 = require("../memoize");
function createClientFactory(clss) {
    return (0, memoize_1.memoize)(async (roleArn) => {
        // eslint-disable-next-line turbo/no-undeclared-env-vars
        if (process.env.FL_LOCAL && roleArn) {
            return createLocalClient(roleArn, clss);
        }
        else {
            return new clss({});
        }
    });
}
exports.createClientFactory = createClientFactory;
async function createLocalClient(roleArn, clss) {
    var _a, _b, _c, _d;
    const sts = new sts_1.default((0, credentials_1.getClientProps)());
    const role = await sts
        .assumeRole({
        RoleArn: roleArn,
        RoleSessionName: "FL_LOCAL",
    })
        .promise();
    return new clss({
        credentials: {
            accessKeyId: (_a = role.Credentials) === null || _a === void 0 ? void 0 : _a.AccessKeyId,
            secretAccessKey: (_b = role.Credentials) === null || _b === void 0 ? void 0 : _b.SecretAccessKey,
            expireTime: (_c = role.Credentials) === null || _c === void 0 ? void 0 : _c.Expiration,
            sessionToken: (_d = role.Credentials) === null || _d === void 0 ? void 0 : _d.SessionToken,
            expired: false,
        },
    });
}
exports.createLocalClient = createLocalClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2ludGVyZmFjZS9jbGllbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsOERBQXNDO0FBRXRDLGdEQUFnRDtBQUNoRCx3Q0FBcUM7QUFFckMsU0FBZ0IsbUJBQW1CLENBSWpDLElBQWlCO0lBQ2pCLE9BQU8sSUFBQSxpQkFBTyxFQUFDLEtBQUssRUFBRSxPQUFnQixFQUFFLEVBQUU7UUFDeEMsd0RBQXdEO1FBQ3hELElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLElBQUksT0FBTyxFQUFFO1lBQ25DLE9BQU8saUJBQWlCLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3pDO2FBQU07WUFDTCxPQUFPLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQ3JCO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBYkQsa0RBYUM7QUFFTSxLQUFLLFVBQVUsaUJBQWlCLENBSXJDLE9BQWUsRUFBRSxJQUFpQjs7SUFDbEMsTUFBTSxHQUFHLEdBQUcsSUFBSSxhQUFHLENBQUMsSUFBQSw0QkFBYyxHQUFFLENBQUMsQ0FBQztJQUN0QyxNQUFNLElBQUksR0FBRyxNQUFNLEdBQUc7U0FDbkIsVUFBVSxDQUFDO1FBQ1YsT0FBTyxFQUFFLE9BQU87UUFDaEIsZUFBZSxFQUFFLFVBQVU7S0FDNUIsQ0FBQztTQUNELE9BQU8sRUFBRSxDQUFDO0lBQ2IsT0FBTyxJQUFJLElBQUksQ0FBQztRQUNkLFdBQVcsRUFBRTtZQUNYLFdBQVcsRUFBRSxNQUFBLElBQUksQ0FBQyxXQUFXLDBDQUFFLFdBQVk7WUFDM0MsZUFBZSxFQUFFLE1BQUEsSUFBSSxDQUFDLFdBQVcsMENBQUUsZUFBZ0I7WUFDbkQsVUFBVSxFQUFFLE1BQUEsSUFBSSxDQUFDLFdBQVcsMENBQUUsVUFBVztZQUN6QyxZQUFZLEVBQUUsTUFBQSxJQUFJLENBQUMsV0FBVywwQ0FBRSxZQUFhO1lBQzdDLE9BQU8sRUFBRSxLQUFLO1NBQ2Y7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDO0FBckJELDhDQXFCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBTVFMgZnJvbSBcImF3cy1zZGsvY2xpZW50cy9zdHNcIjtcbmltcG9ydCB0eXBlIHsgQ3JlZGVudGlhbHMsIENyZWRlbnRpYWxzT3B0aW9ucyB9IGZyb20gXCJhd3Mtc2RrL2xpYi9jcmVkZW50aWFsc1wiO1xuaW1wb3J0IHsgZ2V0Q2xpZW50UHJvcHMgfSBmcm9tIFwiLi4vY3JlZGVudGlhbHNcIjtcbmltcG9ydCB7IG1lbW9pemUgfSBmcm9tIFwiLi4vbWVtb2l6ZVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2xpZW50RmFjdG9yeTxcbiAgQ2xpZW50Q2xhc3MgZXh0ZW5kcyBuZXcgKHByb3BzOiB7XG4gICAgY3JlZGVudGlhbHM/OiBDcmVkZW50aWFscyB8IENyZWRlbnRpYWxzT3B0aW9ucyB8IG51bGw7XG4gIH0pID0+IGFueVxuPihjbHNzOiBDbGllbnRDbGFzcyk6IChyb2xlQXJuPzogc3RyaW5nKSA9PiBQcm9taXNlPEluc3RhbmNlVHlwZTxDbGllbnRDbGFzcz4+IHtcbiAgcmV0dXJuIG1lbW9pemUoYXN5bmMgKHJvbGVBcm4/OiBzdHJpbmcpID0+IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgdHVyYm8vbm8tdW5kZWNsYXJlZC1lbnYtdmFyc1xuICAgIGlmIChwcm9jZXNzLmVudi5GTF9MT0NBTCAmJiByb2xlQXJuKSB7XG4gICAgICByZXR1cm4gY3JlYXRlTG9jYWxDbGllbnQocm9sZUFybiwgY2xzcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgY2xzcyh7fSk7XG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUxvY2FsQ2xpZW50PFxuICBDbGllbnRDbGFzcyBleHRlbmRzIG5ldyAocHJvcHM6IHtcbiAgICBjcmVkZW50aWFsczogQ3JlZGVudGlhbHMgfCBDcmVkZW50aWFsc09wdGlvbnMgfCBudWxsO1xuICB9KSA9PiBhbnlcbj4ocm9sZUFybjogc3RyaW5nLCBjbHNzOiBDbGllbnRDbGFzcyk6IFByb21pc2U8SW5zdGFuY2VUeXBlPENsaWVudENsYXNzPj4ge1xuICBjb25zdCBzdHMgPSBuZXcgU1RTKGdldENsaWVudFByb3BzKCkpO1xuICBjb25zdCByb2xlID0gYXdhaXQgc3RzXG4gICAgLmFzc3VtZVJvbGUoe1xuICAgICAgUm9sZUFybjogcm9sZUFybixcbiAgICAgIFJvbGVTZXNzaW9uTmFtZTogXCJGTF9MT0NBTFwiLFxuICAgIH0pXG4gICAgLnByb21pc2UoKTtcbiAgcmV0dXJuIG5ldyBjbHNzKHtcbiAgICBjcmVkZW50aWFsczoge1xuICAgICAgYWNjZXNzS2V5SWQ6IHJvbGUuQ3JlZGVudGlhbHM/LkFjY2Vzc0tleUlkISxcbiAgICAgIHNlY3JldEFjY2Vzc0tleTogcm9sZS5DcmVkZW50aWFscz8uU2VjcmV0QWNjZXNzS2V5ISxcbiAgICAgIGV4cGlyZVRpbWU6IHJvbGUuQ3JlZGVudGlhbHM/LkV4cGlyYXRpb24hLFxuICAgICAgc2Vzc2lvblRva2VuOiByb2xlLkNyZWRlbnRpYWxzPy5TZXNzaW9uVG9rZW4hLFxuICAgICAgZXhwaXJlZDogZmFsc2UsXG4gICAgfSxcbiAgfSk7XG59XG4iXX0=