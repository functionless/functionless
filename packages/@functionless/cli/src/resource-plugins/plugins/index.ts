import { ResourcePlugin } from "../plugin";
import stepFunction from "./step-function/plugin";
import table from "./table/plugin";

/**
 * List of plugins to handle resource loading
 */
export const resourcePlugins: ResourcePlugin[] = [stepFunction, table];
