import path from "path";
import { Resource } from "@functionless/aws";
import { Project } from "../project";
import { Folder } from "./folder";

const ResourceFileFQN = Symbol.for("ResourceFileFQN");

export function isFile(a: any): a is File {
  return a && typeof a === "object" && ResourceFileFQN in a;
}

export interface FileProps {
  /**
   * The instance of the {@link Resource}.
   */
  resource: Resource;
  /**
   * Absolute file path to the location of this resource on disk.
   *
   * e.g. `/Users/username/workspace/project/src/handler.ts`
   */
  filePath: string;
}

export class File implements FileProps {
  readonly [ResourceFileFQN]: true = true;

  /**
   * The parent {@link Folder} that contains this {@link File}.
   */
  readonly parent: Folder;
  readonly resource;
  readonly filePath;

  /**
   * The base file name, e.g. `handler.ts`
   */
  readonly fileName: string;

  /**
   * The local ID of the resource, e.g. `handler`.
   *
   * The local ID is derived by dropping the extension from the {@link fileName}.
   */
  readonly name;

  constructor(props: FileProps) {
    // @ts-ignore - parent will be set by our parent
    this.parent = undefined;
    this.resource = props.resource;
    this.filePath = props.filePath;
    this.fileName = path.basename(this.filePath);
    this.name = path.basename(this.fileName, ".ts");
  }

  /**
   * Name of the Stack this Resource belongs in.
   */
  get stackName(): string {
    return this.parent.stackName;
  }

  /**
   * The address of the Resource in the application, e.g.
   */
  get address(): string {
    if (this.name === "_stack" || this.name === "_api") {
      return this.parent.address;
    } else {
      return `${this.parent.address}/${this.name}`;
    }
  }

  /**
   * The {@link Project} containing this {@link File}.
   */
  get project(): Project {
    return this.parent.project;
  }

  /**
   * The name of the {@link Project} containing this {@link File}.
   */
  get projectName(): string {
    return this.project.projectName;
  }
}
