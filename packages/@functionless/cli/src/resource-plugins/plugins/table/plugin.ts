import { ResourcePlugin } from "../../plugin";
import { resourceLoader } from "./resource-loader";

const tablePlugin: ResourcePlugin = {
  kind: "fl.Table",
  resourceLoader: resourceLoader,
};

export default tablePlugin;
