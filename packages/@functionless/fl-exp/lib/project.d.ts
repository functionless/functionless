import { Resource } from "./interface";
import { File } from "./tree/file";
import { Folder } from "./tree/folder";
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
export declare class Project implements ProjectProps {
    readonly projectName: string;
    readonly rootDir: string;
    readonly srcDir: string;
    readonly module: Folder;
    /**
     * All {@link File}s in the {@link Project}.
     */
    readonly resourceFiles: File[];
    /**
     * An index of {@link File} that supports lookups by:
     * 1. the fully qualified address of a {@link Resource}.
     * 2. the {@link Resource} instance.
     */
    readonly resourceIndex: Map<string | Resource, File>;
    constructor(props: ProjectProps);
    lookupResource(key: Resource | string): File;
    tryLookupResource(key: Resource | string): File | undefined;
}
//# sourceMappingURL=project.d.ts.map