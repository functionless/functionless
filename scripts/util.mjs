import prettier from "prettier";
import path from "path";
import fs from "fs/promises";

export async function ls(dir) {
  return (await fs.readdir(dir)).map((d) => path.join(dir, d));
}

export async function readJsonFile(file) {
  try {
    return JSON.parse((await fs.readFile(file)).toString("utf-8"));
  } catch (err) {
    console.error("Failed to read JSON file", file, err);
  }
}

export async function writeJsonFile(file, obj) {
  await fs.writeFile(
    file,
    prettier.format(JSON.stringify(obj, null, 2), {
      parser: "json",
    })
  );
}
