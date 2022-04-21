import { Stack } from "aws-cdk-lib";
import * as cxapi from "@aws-cdk/cx-api";
import { CloudFormationDeployments } from "aws-cdk/lib/api/cloudformation-deployments";
import { SdkProvider } from "aws-cdk/lib/api/aws-auth";
import { AsyncApp } from "../src";

export const clientConfig = {
  endpoint: "http://localhost:4566",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
  region: "us-east-1",
  sslEnabled: false,
  s3ForcePathStyle: true,
};

export const deployStack = async (app: AsyncApp, stack: Stack) => {
  const cloudAssembly = await app.synthAsync();

  const sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults({
    httpOptions: clientConfig as any,
  });

  // @ts-ignore
  sdkProvider.sdkOptions = {
    // @ts-ignore
    ...sdkProvider.sdkOptions,
    endpoint: clientConfig.endpoint,
    s3ForcePathStyle: clientConfig.s3ForcePathStyle,
    accessKeyId: clientConfig.credentials.accessKeyId,
    secretAccessKey: clientConfig.credentials.secretAccessKey,
    credentials: clientConfig.credentials,
  };

  const cfn = new CloudFormationDeployments({
    sdkProvider,
  });

  const assembly = new cxapi.CloudAssembly(cloudAssembly.directory);
  const stackArtifact = cxapi.CloudFormationStackArtifact.fromManifest(
    assembly,
    stack.artifactId,
    cloudAssembly.getStackArtifact(stack.artifactId).manifest
  ) as cxapi.CloudFormationStackArtifact;

  console.log(JSON.stringify(stackArtifact.template, null, 4));

  await cfn.deployStack({
    stack: stackArtifact,
    force: true,
  });
};
