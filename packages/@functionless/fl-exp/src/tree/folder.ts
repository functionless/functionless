import path from "path";
import { Project } from "../project";
import { Tree } from "./tree";

const FolderFQN = Symbol.for("FolderFQN");

export function isFolder(a: any): a is Folder {
  return a && typeof a === "object" && FolderFQN in a;
}

export interface FolderProps {
  /**
   * The absolute file path of this {@link Folder}.
   */
  path: string;
  /**
   * The {@link FolderContents} representing all of the {@link Tree}s within.
   */
  tree: FolderContents;
}

/**
 * A key-value store of a {@link Folder}'s contents.
 */
export interface FolderContents {
  readonly [fileName: string]: Tree;
}

/**
 * A {@link Folder} represents a folder on the file system containing other {@link Tree}s, e.g. other
 * {@link Folder}s and {@link File}s.
 */
export class Folder implements FolderProps {
  readonly [FolderFQN]: true = true;

  /**
   * The parent that contains this {@link Folder}.
   */
  readonly parent: Folder | Project;

  readonly path;

  readonly tree;
  /**
   * A list of all the {@link tree}'s {@link Tree} nodes.
   */
  readonly files: Tree[];

  constructor(props: FolderProps) {
    // @ts-ignore - parent will be set by the parent.
    this.parent = undefined;
    this.path = props.path;
    this.tree = props.tree ?? {};
    this.files = Object.values(props.tree);
    this.files.forEach((file) => {
      // @ts-ignore - Project, Folder and File are internally consistent, so we break types here
      file.parent = this;
    });
  }

  /**
   * The "local" name of this ResourceFolder - "local" meaning the name
   * is only unique within the immediate content of the surrounding {@link Folder}.
   *
   * e.g
   * ```
   * src/a/b/c.ts -> "c"
   * ```
   */
  get name(): string {
    return path.basename(this.path, ".ts");
  }

  /**
   * The address of the Resource in the application, e.g.
   *
   * For example, if the project structure is as follows.
   *
   * ```
   * package.json
   *   { "name": "my-project" }
   * src/
   *  folder/
   *    file.ts
   * ```
   *
   * 1. the `address` of `src/` is `my-project`
   * 2. the `address` of `folder` is `my-project/folder`.
   */
  get address(): string {
    if (isFolder(this.parent)) {
      return `${this.parent.address}/${this.name}`;
    } else {
      return this.parent.projectName;
    }
  }

  /**
   * The `index.ts` Resource if it exists.
   * ```ts
   * src/
   *   index.ts
   * ```
   */
  get index(): Tree | undefined {
    return this.tree.index;
  }

  /**
   * The `_api.ts` Resource if it exists.
   * ```ts
   * src/
   *   my-api/
   *     _api.ts
   * ```
   */
  get _api(): Tree | undefined {
    return this.tree._api;
  }

  /**
   * The `_stack.ts` Resource if it exists.
   * ```ts
   * src/
   *   my-stack/
   *     _stack.ts
   * ```
   */
  get _stack(): Tree | undefined {
    return this.tree._stack;
  }

  /**
   * Determine the name of the Stack this {@link Folder} is contained within.
   *
   * Options:
   * 1. if this {@link Folder} contains a `_stack.ts` file, then the {@link name} is used.
   * 2. if this is the root {@link Folder} of the {@link Project}, then the {@link projectName} is used.
   */
  get stackName(): string {
    if (this._stack) {
      return this.name;
    } else if (isFolder(this.parent)) {
      return this.parent.stackName;
    } else {
      return this.parent.projectName;
    }
  }

  /**
   * The {@link Project} containing this {@link Folder}.
   */
  get project(): Project {
    if (isFolder(this.parent)) {
      return this.parent.project;
    } else {
      return this.parent;
    }
  }

  /**
   * The name of the {@link Project}
   */
  get projectName(): string {
    return this.project.projectName;
  }

  /**
   * Is this {@link Folder} at the root of the `src/` directory.
   * ```ts
   * src/
   *   my-stack/       # yes
   *     nested-stack/ # no
   * ```
   */
  get isSrcRoot(): boolean {
    return !isFolder(this.parent);
  }
}
