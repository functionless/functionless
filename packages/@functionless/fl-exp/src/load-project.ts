import path from "path";
import fs from "fs/promises";
import { isResource } from "@functionless/aws";
import { exists, ls } from "./util";
import { Folder, FolderProps } from "./tree/folder";
import { Project } from "./project";
import { Tree } from "./tree/tree";
import { File } from "./tree/file";

export interface LoadProjectProps {
  rootDir?: string;
}

/**
 * Loads a {@link Project} from the file system.
 * 1. Load `<root-dir>/package.json`
 *    - error if it does not exist.
 * 2. Extract the `name` property from `package.json` for use as the `projectName`.
 *    - error if it does not exist or is not a string.
 * 3. Load the `src/` directory from `<root-dir>/src/`
 *    - error id it does not exist
 *    - TODO: allow for it to be configurable?
 *    - TODO: should we allow for more than one module root?
 *
 * @param rootDir the {@link Project}'s root directory.
 * @returns a fully loaded {@link Project}
 * @throws an error if the project is not structurally valid.
 */
export async function loadProject(rootDir: string): Promise<Project> {
  require("@functionless/register");

  const pkgJsonPath = path.join(rootDir, "package.json");
  if (!(await exists(pkgJsonPath))) {
    throw new Error(`file not found: ${pkgJsonPath}`);
  }
  const pkgJson = JSON.parse(
    (await fs.readFile(pkgJsonPath)).toString("utf-8")
  );
  const projectName = pkgJson.name;
  if (typeof projectName !== "string") {
    throw new Error(`expected 'name' to be a string in ${pkgJsonPath}`);
  }
  // TODO: make src configurable?
  const srcDir = path.join(rootDir, "src");
  if (!(await exists(srcDir))) {
    throw new Error(`folder not found: ${srcDir}`);
  }

  const absoluteSrcDir = path.resolve(srcDir);
  return new Project({
    projectName,
    srcDir: absoluteSrcDir,
    rootDir,
    module: await loadResourceFolder(absoluteSrcDir),
  });

  async function loadResourceFolder(folderName: string): Promise<Folder> {
    return new Folder(
      (
        await Promise.all(
          (
            await ls(folderName)
          ).map(async (file) => await loadResourceFile(file))
        )
      ).reduce<FolderProps>(
        (a, b) =>
          b
            ? {
                tree: {
                  ...a.tree,
                  [b.name]: b,
                },
                path: folderName,
              }
            : a,
        <FolderProps>{
          tree: {},
          path: folderName,
        }
      )
    );

    async function loadResourceFile(
      filePath: string
    ): Promise<Tree | undefined> {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const resource = require(filePath).default;
        if (isResource(resource)) {
          return new File({
            filePath,
            resource,
          });
        } else {
          return undefined;
        }
      } else {
        return loadResourceFolder(filePath);
      }
    }
  }
}
