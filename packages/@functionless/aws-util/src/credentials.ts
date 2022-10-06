import { CredentialProviderChain } from "aws-sdk";

// export function getCredentials() {
//   return new SsoCredentials({
//     profile: "sam",
//   });
// }
export function getClientProps() {
  return {
    credentialProvider: getCredentialProvider(),
    // region: getRegion(),
  };
}

function getCredentialProvider() {
  return new CredentialProviderChain(CredentialProviderChain.defaultProviders);
}
