import { Project } from "./project";
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
export declare function loadProject(rootDir: string): Promise<Project>;
//# sourceMappingURL=load-project.d.ts.map