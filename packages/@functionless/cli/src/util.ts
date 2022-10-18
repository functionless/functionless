import path from "path";
import fs from "fs/promises";
import { constants } from "fs";

export async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ls(dir: string): Promise<string[]> {
  return (await fs.readdir(dir)).map((file) => path.resolve(dir, file));
}

/**
 * One or more of something
 */
export type AtLeastOne<T> = T | T[];

export function matchAtLeastOne<T>(t: AtLeastOne<T> | undefined, val: T) {
  return !t || (Array.isArray(t) ? t.includes(val) : t === val);
}
