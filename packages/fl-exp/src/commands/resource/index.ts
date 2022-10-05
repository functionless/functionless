import { dispatch } from "../../command-provider";
import { logicalIdForPath, resolveStackDetail } from "../../logical-id";

import "./api-method";
import "./lambda-function";
import "./express-step-function";
import "./step-function";
import { File } from "../../tree/file";

require("functionless/register");

export async function invoke(resourceFile: File, _args: string[]) {
  const absoluteResourcePath = resourceFile.filePath;
  const resourceId = resourceFile.address;

  const logicalId = logicalIdForPath(resourceId);

  const smartResource = (await import(absoluteResourcePath)).default;
  if (smartResource) {
    const stackDetail = await resolveStackDetail(
      resourceFile.stackName,
      logicalId
    );

    if (!stackDetail) {
      return;
    }

    dispatch(smartResource.kind, stackDetail);
  }
}
