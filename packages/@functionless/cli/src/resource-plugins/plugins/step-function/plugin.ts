import { ResourcePlugin } from "../../plugin";
import { resourceLoader } from "./resource-loader";

const stepFunctionPlugin: ResourcePlugin = {
  kind: ["fl.StepFunction", "fl.ExpressStepFunction"],
  resourceLoader,
};

export default stepFunctionPlugin;
