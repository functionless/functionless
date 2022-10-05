import { Resource } from "../interface";
import { Project } from "../project";
import { Folder } from "./folder";
declare const ResourceFileFQN: unique symbol;
export declare function isFile(a: any): a is File;
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
export declare class File implements FileProps {
    readonly [ResourceFileFQN]: true;
    /**
     * The parent {@link Folder} that contains this {@link File}.
     */
    readonly parent: Folder;
    readonly resource: Resource;
    readonly filePath: string;
    /**
     * The base file name, e.g. `handler.ts`
     */
    readonly fileName: string;
    /**
     * The local ID of the resource, e.g. `handler`.
     *
     * The local ID is derived by dropping the extension from the {@link fileName}.
     */
    readonly name: string;
    constructor(props: FileProps);
    /**
     * Name of the Stack this Resource belongs in.
     */
    get stackName(): string;
    /**
     * The address of the Resource in the application, e.g.
     */
    get address(): string;
    /**
     * The {@link Project} containing this {@link File}.
     */
    get project(): Project;
    /**
     * The name of the {@link Project} containing this {@link File}.
     */
    get projectName(): string;
}
export {};
//# sourceMappingURL=file.d.ts.map