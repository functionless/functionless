import path from "path";
import { Resource } from "./resource";
import { File } from "./tree/file";
import { Folder } from "./tree/folder";
import { getResourceFiles } from "./tree/tree";

export interface ProjectProps {
  /**
   * Name of this {@link Project} as defined in `package.json/name`.
   */
  readonly projectName: string;
  /**
   * The root directory of the {@link Project}, e.g. `my-project/`.
   */
  readonly rootDir: string;
  /**
   * The source code directory, e.g. `my-project/src/`
   */
  readonly srcDir: string;
  /**
   * The root {@link Folder} containing all of this {@link Project}'s Modules.
   */
  readonly module: Folder;
}

export class Project implements ProjectProps {
  readonly projectName;
  readonly rootDir;
  readonly srcDir;
  readonly module;

  /**
   * All {@link File}s in the {@link Project}.
   */
  readonly resourceFiles: File[];

  /**
   * An index of {@link File} that supports lookups by:
   * 1. the fully qualified address of a {@link Resource}.
   * 2. the {@link Resource} instance.
   * 3. Absolute filepath
   * 4. Relative filepath
   */
  readonly resourceIndex: Map<string | Resource, File>;

  constructor(props: ProjectProps) {
    this.projectName = props.projectName;
    this.rootDir = props.rootDir;
    this.srcDir = props.srcDir;
    this.module = props.module;
    // @ts-ignore - Project, Folder and File are internally consistent, so we break types here
    this.module.parent = this;

    this.resourceFiles = getResourceFiles(this.module);

    this.resourceIndex = new Map(
      this.resourceFiles.flatMap(
        (file) =>
          [
            [file.address, file],
            [file.resource, file],
            [file.filePath, file],
            [path.relative(process.cwd(), file.filePath), file],
            // TS's Map definition seems stupid
          ] as [string, File][]
      )
    );
  }

  public lookupResource(key: Resource | string): File {
    const resource = this.tryLookupResource(key);
    if (resource === undefined) {
      throw new Error(`address ${key} does not reference a leaf node`);
    }
    return resource;
  }

  public tryLookupResource(key: Resource | string): File | undefined {
    return this.resourceIndex.get(key);
  }
}
