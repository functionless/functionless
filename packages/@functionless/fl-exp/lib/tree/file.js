"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.File = exports.isFile = void 0;
const path_1 = __importDefault(require("path"));
const ResourceFileFQN = Symbol.for("ResourceFileFQN");
function isFile(a) {
    return a && typeof a === "object" && ResourceFileFQN in a;
}
exports.isFile = isFile;
class File {
    constructor(props) {
        this[_a] = true;
        // @ts-ignore - parent will be set by our parent
        this.parent = undefined;
        this.resource = props.resource;
        this.filePath = props.filePath;
        this.fileName = path_1.default.basename(this.filePath);
        this.name = path_1.default.basename(this.fileName, ".ts");
    }
    /**
     * Name of the Stack this Resource belongs in.
     */
    get stackName() {
        return this.parent.stackName;
    }
    /**
     * The address of the Resource in the application, e.g.
     */
    get address() {
        if (this.name === "_stack" || this.name === "_api") {
            return this.parent.address;
        }
        else {
            return `${this.parent.address}/${this.name}`;
        }
    }
    /**
     * The {@link Project} containing this {@link File}.
     */
    get project() {
        return this.parent.project;
    }
    /**
     * The name of the {@link Project} containing this {@link File}.
     */
    get projectName() {
        return this.project.projectName;
    }
}
exports.File = File;
_a = ResourceFileFQN;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy90cmVlL2ZpbGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBLGdEQUF3QjtBQUt4QixNQUFNLGVBQWUsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFFdEQsU0FBZ0IsTUFBTSxDQUFDLENBQU07SUFDM0IsT0FBTyxDQUFDLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLGVBQWUsSUFBSSxDQUFDLENBQUM7QUFDNUQsQ0FBQztBQUZELHdCQUVDO0FBZUQsTUFBYSxJQUFJO0lBc0JmLFlBQVksS0FBZ0I7UUFyQm5CLFFBQWlCLEdBQVMsSUFBSSxDQUFDO1FBc0J0QyxnREFBZ0Q7UUFDaEQsSUFBSSxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUM7UUFDeEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDO1FBQy9CLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQztRQUMvQixJQUFJLENBQUMsUUFBUSxHQUFHLGNBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzdDLElBQUksQ0FBQyxJQUFJLEdBQUcsY0FBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksU0FBUztRQUNYLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7SUFDL0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxPQUFPO1FBQ1QsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtZQUNsRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1NBQzVCO2FBQU07WUFDTCxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1NBQzlDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxPQUFPO1FBQ1QsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztJQUM3QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJLFdBQVc7UUFDYixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDO0lBQ2xDLENBQUM7Q0FDRjtBQTlERCxvQkE4REM7S0E3RFcsZUFBZSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBSZXNvdXJjZSB9IGZyb20gXCIuLi9pbnRlcmZhY2VcIjtcbmltcG9ydCB7IFByb2plY3QgfSBmcm9tIFwiLi4vcHJvamVjdFwiO1xuaW1wb3J0IHsgRm9sZGVyIH0gZnJvbSBcIi4vZm9sZGVyXCI7XG5cbmNvbnN0IFJlc291cmNlRmlsZUZRTiA9IFN5bWJvbC5mb3IoXCJSZXNvdXJjZUZpbGVGUU5cIik7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0ZpbGUoYTogYW55KTogYSBpcyBGaWxlIHtcbiAgcmV0dXJuIGEgJiYgdHlwZW9mIGEgPT09IFwib2JqZWN0XCIgJiYgUmVzb3VyY2VGaWxlRlFOIGluIGE7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZVByb3BzIHtcbiAgLyoqXG4gICAqIFRoZSBpbnN0YW5jZSBvZiB0aGUge0BsaW5rIFJlc291cmNlfS5cbiAgICovXG4gIHJlc291cmNlOiBSZXNvdXJjZTtcbiAgLyoqXG4gICAqIEFic29sdXRlIGZpbGUgcGF0aCB0byB0aGUgbG9jYXRpb24gb2YgdGhpcyByZXNvdXJjZSBvbiBkaXNrLlxuICAgKlxuICAgKiBlLmcuIGAvVXNlcnMvdXNlcm5hbWUvd29ya3NwYWNlL3Byb2plY3Qvc3JjL2hhbmRsZXIudHNgXG4gICAqL1xuICBmaWxlUGF0aDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRmlsZSBpbXBsZW1lbnRzIEZpbGVQcm9wcyB7XG4gIHJlYWRvbmx5IFtSZXNvdXJjZUZpbGVGUU5dOiB0cnVlID0gdHJ1ZTtcblxuICAvKipcbiAgICogVGhlIHBhcmVudCB7QGxpbmsgRm9sZGVyfSB0aGF0IGNvbnRhaW5zIHRoaXMge0BsaW5rIEZpbGV9LlxuICAgKi9cbiAgcmVhZG9ubHkgcGFyZW50OiBGb2xkZXI7XG4gIHJlYWRvbmx5IHJlc291cmNlO1xuICByZWFkb25seSBmaWxlUGF0aDtcblxuICAvKipcbiAgICogVGhlIGJhc2UgZmlsZSBuYW1lLCBlLmcuIGBoYW5kbGVyLnRzYFxuICAgKi9cbiAgcmVhZG9ubHkgZmlsZU5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogVGhlIGxvY2FsIElEIG9mIHRoZSByZXNvdXJjZSwgZS5nLiBgaGFuZGxlcmAuXG4gICAqXG4gICAqIFRoZSBsb2NhbCBJRCBpcyBkZXJpdmVkIGJ5IGRyb3BwaW5nIHRoZSBleHRlbnNpb24gZnJvbSB0aGUge0BsaW5rIGZpbGVOYW1lfS5cbiAgICovXG4gIHJlYWRvbmx5IG5hbWU7XG5cbiAgY29uc3RydWN0b3IocHJvcHM6IEZpbGVQcm9wcykge1xuICAgIC8vIEB0cy1pZ25vcmUgLSBwYXJlbnQgd2lsbCBiZSBzZXQgYnkgb3VyIHBhcmVudFxuICAgIHRoaXMucGFyZW50ID0gdW5kZWZpbmVkO1xuICAgIHRoaXMucmVzb3VyY2UgPSBwcm9wcy5yZXNvdXJjZTtcbiAgICB0aGlzLmZpbGVQYXRoID0gcHJvcHMuZmlsZVBhdGg7XG4gICAgdGhpcy5maWxlTmFtZSA9IHBhdGguYmFzZW5hbWUodGhpcy5maWxlUGF0aCk7XG4gICAgdGhpcy5uYW1lID0gcGF0aC5iYXNlbmFtZSh0aGlzLmZpbGVOYW1lLCBcIi50c1wiKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBTdGFjayB0aGlzIFJlc291cmNlIGJlbG9uZ3MgaW4uXG4gICAqL1xuICBnZXQgc3RhY2tOYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50LnN0YWNrTmFtZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgYWRkcmVzcyBvZiB0aGUgUmVzb3VyY2UgaW4gdGhlIGFwcGxpY2F0aW9uLCBlLmcuXG4gICAqL1xuICBnZXQgYWRkcmVzcygpOiBzdHJpbmcge1xuICAgIGlmICh0aGlzLm5hbWUgPT09IFwiX3N0YWNrXCIgfHwgdGhpcy5uYW1lID09PSBcIl9hcGlcIikge1xuICAgICAgcmV0dXJuIHRoaXMucGFyZW50LmFkZHJlc3M7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBgJHt0aGlzLnBhcmVudC5hZGRyZXNzfS8ke3RoaXMubmFtZX1gO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUge0BsaW5rIFByb2plY3R9IGNvbnRhaW5pbmcgdGhpcyB7QGxpbmsgRmlsZX0uXG4gICAqL1xuICBnZXQgcHJvamVjdCgpOiBQcm9qZWN0IHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnQucHJvamVjdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgbmFtZSBvZiB0aGUge0BsaW5rIFByb2plY3R9IGNvbnRhaW5pbmcgdGhpcyB7QGxpbmsgRmlsZX0uXG4gICAqL1xuICBnZXQgcHJvamVjdE5hbWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5wcm9qZWN0LnByb2plY3ROYW1lO1xuICB9XG59XG4iXX0=