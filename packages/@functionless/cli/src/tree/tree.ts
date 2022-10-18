import { File, isFile } from "./file";
import type { Folder } from "./folder";

export type Tree = File | Folder;

export function getResourceFiles(node: Tree): File[] {
  if (isFile(node)) {
    return [node];
  } else {
    return Object.values(node.tree).flatMap(getResourceFiles);
  }
}
