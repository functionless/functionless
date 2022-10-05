import CloudFormation from "aws-sdk/clients/cloudformation";
import crypto from "crypto";
import { getClientProps } from "./credentials";

export async function resolveStackDetail(stackName: string, logicalId: string) {
  const cfnClient = new CloudFormation(getClientProps());

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

export function logicalIdForPath(idPath: string) {
  const parts = idPath.split("/").filter((part) => part !== "Resource");
  const md5 = crypto.createHash("md5").update(parts.join("")).digest("hex");
  const localId = parts.at(parts.length - 1)?.replace(/[^A-Za-z0-9]+/g, "")!;
  return `${localId}${md5}`.slice(0, 255);
}
