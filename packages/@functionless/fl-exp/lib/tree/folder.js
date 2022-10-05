"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Folder = exports.isFolder = void 0;
const path_1 = __importDefault(require("path"));
const FolderFQN = Symbol.for("FolderFQN");
function isFolder(a) {
    return a && typeof a === "object" && FolderFQN in a;
}
exports.isFolder = isFolder;
/**
 * A {@link Folder} represents a folder on the file system containing other {@link Tree}s, e.g. other
 * {@link Folder}s and {@link File}s.
 */
class Folder {
    constructor(props) {
        var _b;
        this[_a] = true;
        // @ts-ignore - parent will be set by the parent.
        this.parent = undefined;
        this.path = props.path;
        this.tree = (_b = props.tree) !== null && _b !== void 0 ? _b : {};
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
    get name() {
        return path_1.default.basename(this.path, ".ts");
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
    get address() {
        if (isFolder(this.parent)) {
            return `${this.parent.address}/${this.name}`;
        }
        else {
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
    get index() {
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
    get _api() {
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
    get _stack() {
        return this.tree._stack;
    }
    /**
     * Determine the name of the Stack this {@link Folder} is contained within.
     *
     * Options:
     * 1. if this {@link Folder} contains a `_stack.ts` file, then the {@link name} is used.
     * 2. if this is the root {@link Folder} of the {@link Project}, then the {@link projectName} is used.
     */
    get stackName() {
        if (this._stack) {
            return this.name;
        }
        else if (isFolder(this.parent)) {
            return this.parent.stackName;
        }
        else {
            return this.parent.projectName;
        }
    }
    /**
     * The {@link Project} containing this {@link Folder}.
     */
    get project() {
        if (isFolder(this.parent)) {
            return this.parent.project;
        }
        else {
            return this.parent;
        }
    }
    /**
     * The name of the {@link Project}
     */
    get projectName() {
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
    get isSrcRoot() {
        return !isFolder(this.parent);
    }
}
exports.Folder = Folder;
_a = FolderFQN;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9sZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3RyZWUvZm9sZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQSxnREFBd0I7QUFJeEIsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUUxQyxTQUFnQixRQUFRLENBQUMsQ0FBTTtJQUM3QixPQUFPLENBQUMsSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksU0FBUyxJQUFJLENBQUMsQ0FBQztBQUN0RCxDQUFDO0FBRkQsNEJBRUM7QUFvQkQ7OztHQUdHO0FBQ0gsTUFBYSxNQUFNO0lBZ0JqQixZQUFZLEtBQWtCOztRQWZyQixRQUFXLEdBQVMsSUFBSSxDQUFDO1FBZ0JoQyxpREFBaUQ7UUFDakQsSUFBSSxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUM7UUFDeEIsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxJQUFJLEdBQUcsTUFBQSxLQUFLLENBQUMsSUFBSSxtQ0FBSSxFQUFFLENBQUM7UUFDN0IsSUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFO1lBQzFCLDBGQUEwRjtZQUMxRixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztRQUNyQixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7Ozs7T0FRRztJQUNILElBQUksSUFBSTtRQUNOLE9BQU8sY0FBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7O09BZUc7SUFDSCxJQUFJLE9BQU87UUFDVCxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDekIsT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUM5QzthQUFNO1lBQ0wsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQztTQUNoQztJQUNILENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSCxJQUFJLEtBQUs7UUFDUCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ3pCLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsSUFBSSxJQUFJO1FBQ04sT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztJQUN4QixDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNILElBQUksTUFBTTtRQUNSLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDMUIsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILElBQUksU0FBUztRQUNYLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNmLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztTQUNsQjthQUFNLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUNoQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO1NBQzlCO2FBQU07WUFDTCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDO1NBQ2hDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxPQUFPO1FBQ1QsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3pCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7U0FDNUI7YUFBTTtZQUNMLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztTQUNwQjtJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksV0FBVztRQUNiLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7SUFDbEMsQ0FBQztJQUVEOzs7Ozs7O09BT0c7SUFDSCxJQUFJLFNBQVM7UUFDWCxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNoQyxDQUFDO0NBQ0Y7QUFsSkQsd0JBa0pDO0tBakpXLFNBQVMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgUHJvamVjdCB9IGZyb20gXCIuLi9wcm9qZWN0XCI7XG5pbXBvcnQgeyBUcmVlIH0gZnJvbSBcIi4vdHJlZVwiO1xuXG5jb25zdCBGb2xkZXJGUU4gPSBTeW1ib2wuZm9yKFwiRm9sZGVyRlFOXCIpO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNGb2xkZXIoYTogYW55KTogYSBpcyBGb2xkZXIge1xuICByZXR1cm4gYSAmJiB0eXBlb2YgYSA9PT0gXCJvYmplY3RcIiAmJiBGb2xkZXJGUU4gaW4gYTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBGb2xkZXJQcm9wcyB7XG4gIC8qKlxuICAgKiBUaGUgYWJzb2x1dGUgZmlsZSBwYXRoIG9mIHRoaXMge0BsaW5rIEZvbGRlcn0uXG4gICAqL1xuICBwYXRoOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBUaGUge0BsaW5rIEZvbGRlckNvbnRlbnRzfSByZXByZXNlbnRpbmcgYWxsIG9mIHRoZSB7QGxpbmsgVHJlZX1zIHdpdGhpbi5cbiAgICovXG4gIHRyZWU6IEZvbGRlckNvbnRlbnRzO1xufVxuXG4vKipcbiAqIEEga2V5LXZhbHVlIHN0b3JlIG9mIGEge0BsaW5rIEZvbGRlcn0ncyBjb250ZW50cy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBGb2xkZXJDb250ZW50cyB7XG4gIHJlYWRvbmx5IFtmaWxlTmFtZTogc3RyaW5nXTogVHJlZTtcbn1cblxuLyoqXG4gKiBBIHtAbGluayBGb2xkZXJ9IHJlcHJlc2VudHMgYSBmb2xkZXIgb24gdGhlIGZpbGUgc3lzdGVtIGNvbnRhaW5pbmcgb3RoZXIge0BsaW5rIFRyZWV9cywgZS5nLiBvdGhlclxuICoge0BsaW5rIEZvbGRlcn1zIGFuZCB7QGxpbmsgRmlsZX1zLlxuICovXG5leHBvcnQgY2xhc3MgRm9sZGVyIGltcGxlbWVudHMgRm9sZGVyUHJvcHMge1xuICByZWFkb25seSBbRm9sZGVyRlFOXTogdHJ1ZSA9IHRydWU7XG5cbiAgLyoqXG4gICAqIFRoZSBwYXJlbnQgdGhhdCBjb250YWlucyB0aGlzIHtAbGluayBGb2xkZXJ9LlxuICAgKi9cbiAgcmVhZG9ubHkgcGFyZW50OiBGb2xkZXIgfCBQcm9qZWN0O1xuXG4gIHJlYWRvbmx5IHBhdGg7XG5cbiAgcmVhZG9ubHkgdHJlZTtcbiAgLyoqXG4gICAqIEEgbGlzdCBvZiBhbGwgdGhlIHtAbGluayB0cmVlfSdzIHtAbGluayBUcmVlfSBub2Rlcy5cbiAgICovXG4gIHJlYWRvbmx5IGZpbGVzOiBUcmVlW107XG5cbiAgY29uc3RydWN0b3IocHJvcHM6IEZvbGRlclByb3BzKSB7XG4gICAgLy8gQHRzLWlnbm9yZSAtIHBhcmVudCB3aWxsIGJlIHNldCBieSB0aGUgcGFyZW50LlxuICAgIHRoaXMucGFyZW50ID0gdW5kZWZpbmVkO1xuICAgIHRoaXMucGF0aCA9IHByb3BzLnBhdGg7XG4gICAgdGhpcy50cmVlID0gcHJvcHMudHJlZSA/PyB7fTtcbiAgICB0aGlzLmZpbGVzID0gT2JqZWN0LnZhbHVlcyhwcm9wcy50cmVlKTtcbiAgICB0aGlzLmZpbGVzLmZvckVhY2goKGZpbGUpID0+IHtcbiAgICAgIC8vIEB0cy1pZ25vcmUgLSBQcm9qZWN0LCBGb2xkZXIgYW5kIEZpbGUgYXJlIGludGVybmFsbHkgY29uc2lzdGVudCwgc28gd2UgYnJlYWsgdHlwZXMgaGVyZVxuICAgICAgZmlsZS5wYXJlbnQgPSB0aGlzO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBcImxvY2FsXCIgbmFtZSBvZiB0aGlzIFJlc291cmNlRm9sZGVyIC0gXCJsb2NhbFwiIG1lYW5pbmcgdGhlIG5hbWVcbiAgICogaXMgb25seSB1bmlxdWUgd2l0aGluIHRoZSBpbW1lZGlhdGUgY29udGVudCBvZiB0aGUgc3Vycm91bmRpbmcge0BsaW5rIEZvbGRlcn0uXG4gICAqXG4gICAqIGUuZ1xuICAgKiBgYGBcbiAgICogc3JjL2EvYi9jLnRzIC0+IFwiY1wiXG4gICAqIGBgYFxuICAgKi9cbiAgZ2V0IG5hbWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gcGF0aC5iYXNlbmFtZSh0aGlzLnBhdGgsIFwiLnRzXCIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBhZGRyZXNzIG9mIHRoZSBSZXNvdXJjZSBpbiB0aGUgYXBwbGljYXRpb24sIGUuZy5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsIGlmIHRoZSBwcm9qZWN0IHN0cnVjdHVyZSBpcyBhcyBmb2xsb3dzLlxuICAgKlxuICAgKiBgYGBcbiAgICogcGFja2FnZS5qc29uXG4gICAqICAgeyBcIm5hbWVcIjogXCJteS1wcm9qZWN0XCIgfVxuICAgKiBzcmMvXG4gICAqICBmb2xkZXIvXG4gICAqICAgIGZpbGUudHNcbiAgICogYGBgXG4gICAqXG4gICAqIDEuIHRoZSBgYWRkcmVzc2Agb2YgYHNyYy9gIGlzIGBteS1wcm9qZWN0YFxuICAgKiAyLiB0aGUgYGFkZHJlc3NgIG9mIGBmb2xkZXJgIGlzIGBteS1wcm9qZWN0L2ZvbGRlcmAuXG4gICAqL1xuICBnZXQgYWRkcmVzcygpOiBzdHJpbmcge1xuICAgIGlmIChpc0ZvbGRlcih0aGlzLnBhcmVudCkpIHtcbiAgICAgIHJldHVybiBgJHt0aGlzLnBhcmVudC5hZGRyZXNzfS8ke3RoaXMubmFtZX1gO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJlbnQucHJvamVjdE5hbWU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBgaW5kZXgudHNgIFJlc291cmNlIGlmIGl0IGV4aXN0cy5cbiAgICogYGBgdHNcbiAgICogc3JjL1xuICAgKiAgIGluZGV4LnRzXG4gICAqIGBgYFxuICAgKi9cbiAgZ2V0IGluZGV4KCk6IFRyZWUgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLnRyZWUuaW5kZXg7XG4gIH1cblxuICAvKipcbiAgICogVGhlIGBfYXBpLnRzYCBSZXNvdXJjZSBpZiBpdCBleGlzdHMuXG4gICAqIGBgYHRzXG4gICAqIHNyYy9cbiAgICogICBteS1hcGkvXG4gICAqICAgICBfYXBpLnRzXG4gICAqIGBgYFxuICAgKi9cbiAgZ2V0IF9hcGkoKTogVHJlZSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMudHJlZS5fYXBpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBgX3N0YWNrLnRzYCBSZXNvdXJjZSBpZiBpdCBleGlzdHMuXG4gICAqIGBgYHRzXG4gICAqIHNyYy9cbiAgICogICBteS1zdGFjay9cbiAgICogICAgIF9zdGFjay50c1xuICAgKiBgYGBcbiAgICovXG4gIGdldCBfc3RhY2soKTogVHJlZSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMudHJlZS5fc3RhY2s7XG4gIH1cblxuICAvKipcbiAgICogRGV0ZXJtaW5lIHRoZSBuYW1lIG9mIHRoZSBTdGFjayB0aGlzIHtAbGluayBGb2xkZXJ9IGlzIGNvbnRhaW5lZCB3aXRoaW4uXG4gICAqXG4gICAqIE9wdGlvbnM6XG4gICAqIDEuIGlmIHRoaXMge0BsaW5rIEZvbGRlcn0gY29udGFpbnMgYSBgX3N0YWNrLnRzYCBmaWxlLCB0aGVuIHRoZSB7QGxpbmsgbmFtZX0gaXMgdXNlZC5cbiAgICogMi4gaWYgdGhpcyBpcyB0aGUgcm9vdCB7QGxpbmsgRm9sZGVyfSBvZiB0aGUge0BsaW5rIFByb2plY3R9LCB0aGVuIHRoZSB7QGxpbmsgcHJvamVjdE5hbWV9IGlzIHVzZWQuXG4gICAqL1xuICBnZXQgc3RhY2tOYW1lKCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuX3N0YWNrKSB7XG4gICAgICByZXR1cm4gdGhpcy5uYW1lO1xuICAgIH0gZWxzZSBpZiAoaXNGb2xkZXIodGhpcy5wYXJlbnQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJlbnQuc3RhY2tOYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJlbnQucHJvamVjdE5hbWU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRoZSB7QGxpbmsgUHJvamVjdH0gY29udGFpbmluZyB0aGlzIHtAbGluayBGb2xkZXJ9LlxuICAgKi9cbiAgZ2V0IHByb2plY3QoKTogUHJvamVjdCB7XG4gICAgaWYgKGlzRm9sZGVyKHRoaXMucGFyZW50KSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyZW50LnByb2plY3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcmVudDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGhlIG5hbWUgb2YgdGhlIHtAbGluayBQcm9qZWN0fVxuICAgKi9cbiAgZ2V0IHByb2plY3ROYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMucHJvamVjdC5wcm9qZWN0TmFtZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJcyB0aGlzIHtAbGluayBGb2xkZXJ9IGF0IHRoZSByb290IG9mIHRoZSBgc3JjL2AgZGlyZWN0b3J5LlxuICAgKiBgYGB0c1xuICAgKiBzcmMvXG4gICAqICAgbXktc3RhY2svICAgICAgICMgeWVzXG4gICAqICAgICBuZXN0ZWQtc3RhY2svICMgbm9cbiAgICogYGBgXG4gICAqL1xuICBnZXQgaXNTcmNSb290KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhaXNGb2xkZXIodGhpcy5wYXJlbnQpO1xuICB9XG59XG4iXX0=