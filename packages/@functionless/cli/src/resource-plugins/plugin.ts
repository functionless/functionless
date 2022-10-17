import { AtLeastOne } from "../util";
import { ResourceLoader } from "./loader/loader";

/**
 * Type of a resource plugin.
 * It is intended to contain all sorts of functionality to support providing resources to functionless apps
 */
export interface ResourcePlugin {
  kind: AtLeastOne<string>;
  resourceLoader: ResourceLoader<any, any>;
}
