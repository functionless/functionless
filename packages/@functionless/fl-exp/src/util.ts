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
