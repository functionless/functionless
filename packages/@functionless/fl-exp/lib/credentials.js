"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientProps = void 0;
const aws_sdk_1 = require("aws-sdk");
// export function getCredentials() {
//   return new SsoCredentials({
//     profile: "sam",
//   });
// }
function getClientProps() {
    return {
        credentialProvider: getCredentialProvider(),
        // region: getRegion(),
    };
}
exports.getClientProps = getClientProps;
function getCredentialProvider() {
    return new aws_sdk_1.CredentialProviderChain(aws_sdk_1.CredentialProviderChain.defaultProviders);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlZGVudGlhbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvY3JlZGVudGlhbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQWtEO0FBRWxELHFDQUFxQztBQUNyQyxnQ0FBZ0M7QUFDaEMsc0JBQXNCO0FBQ3RCLFFBQVE7QUFDUixJQUFJO0FBQ0osU0FBZ0IsY0FBYztJQUM1QixPQUFPO1FBQ0wsa0JBQWtCLEVBQUUscUJBQXFCLEVBQUU7UUFDM0MsdUJBQXVCO0tBQ3hCLENBQUM7QUFDSixDQUFDO0FBTEQsd0NBS0M7QUFFRCxTQUFTLHFCQUFxQjtJQUM1QixPQUFPLElBQUksaUNBQXVCLENBQUMsaUNBQXVCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztBQUMvRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ3JlZGVudGlhbFByb3ZpZGVyQ2hhaW4gfSBmcm9tIFwiYXdzLXNka1wiO1xuXG4vLyBleHBvcnQgZnVuY3Rpb24gZ2V0Q3JlZGVudGlhbHMoKSB7XG4vLyAgIHJldHVybiBuZXcgU3NvQ3JlZGVudGlhbHMoe1xuLy8gICAgIHByb2ZpbGU6IFwic2FtXCIsXG4vLyAgIH0pO1xuLy8gfVxuZXhwb3J0IGZ1bmN0aW9uIGdldENsaWVudFByb3BzKCkge1xuICByZXR1cm4ge1xuICAgIGNyZWRlbnRpYWxQcm92aWRlcjogZ2V0Q3JlZGVudGlhbFByb3ZpZGVyKCksXG4gICAgLy8gcmVnaW9uOiBnZXRSZWdpb24oKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0Q3JlZGVudGlhbFByb3ZpZGVyKCkge1xuICByZXR1cm4gbmV3IENyZWRlbnRpYWxQcm92aWRlckNoYWluKENyZWRlbnRpYWxQcm92aWRlckNoYWluLmRlZmF1bHRQcm92aWRlcnMpO1xufVxuIl19