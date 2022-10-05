"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
const file_1 = require("./tree/file");
class Project {
    constructor(props) {
        this.projectName = props.projectName;
        this.rootDir = props.rootDir;
        this.srcDir = props.srcDir;
        this.module = props.module;
        // @ts-ignore - Project, Folder and File are internally consistent, so we break types here
        this.module.parent = this;
        this.resourceFiles = getResourceFiles(this.module);
        this.resourceIndex = new Map(this.resourceFiles.flatMap((file) => [
            [file.address, file],
            [file.resource, file],
            // TS's Map definition seems stupid
        ]));
    }
    lookupResource(key) {
        const resource = this.tryLookupResource(key);
        if (resource === undefined) {
            throw new Error(`address ${key} does not reference a leaf node`);
        }
        return resource;
    }
    tryLookupResource(key) {
        return this.resourceIndex.get(key);
    }
}
exports.Project = Project;
function getResourceFiles(node) {
    if ((0, file_1.isFile)(node)) {
        return [node];
    }
    else {
        return Object.values(node.tree).flatMap(getResourceFiles);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvamVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9wcm9qZWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHNDQUEyQztBQXVCM0MsTUFBYSxPQUFPO0lBa0JsQixZQUFZLEtBQW1CO1FBQzdCLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztRQUNyQyxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7UUFDN0IsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO1FBQzNCLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztRQUMzQiwwRkFBMEY7UUFDMUYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO1FBRTFCLElBQUksQ0FBQyxhQUFhLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRW5ELElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQzFCLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUN4QixDQUFDLElBQUksRUFBRSxFQUFFLENBQ1A7WUFDRSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDO1lBQ3BCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUM7WUFDckIsbUNBQW1DO1NBQ2hCLENBQ3hCLENBQ0YsQ0FBQztJQUNKLENBQUM7SUFFTSxjQUFjLENBQUMsR0FBc0I7UUFDMUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzdDLElBQUksUUFBUSxLQUFLLFNBQVMsRUFBRTtZQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLFdBQVcsR0FBRyxpQ0FBaUMsQ0FBQyxDQUFDO1NBQ2xFO1FBQ0QsT0FBTyxRQUFRLENBQUM7SUFDbEIsQ0FBQztJQUVNLGlCQUFpQixDQUFDLEdBQXNCO1FBQzdDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDckMsQ0FBQztDQUNGO0FBbkRELDBCQW1EQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsSUFBVTtJQUNsQyxJQUFJLElBQUEsYUFBTSxFQUFDLElBQUksQ0FBQyxFQUFFO1FBQ2hCLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNmO1NBQU07UUFDTCxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0tBQzNEO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFJlc291cmNlIH0gZnJvbSBcIi4vaW50ZXJmYWNlXCI7XG5pbXBvcnQgeyBpc0ZpbGUsIEZpbGUgfSBmcm9tIFwiLi90cmVlL2ZpbGVcIjtcbmltcG9ydCB7IEZvbGRlciB9IGZyb20gXCIuL3RyZWUvZm9sZGVyXCI7XG5pbXBvcnQgeyBUcmVlIH0gZnJvbSBcIi4vdHJlZS90cmVlXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvamVjdFByb3BzIHtcbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhpcyB7QGxpbmsgUHJvamVjdH0gYXMgZGVmaW5lZCBpbiBgcGFja2FnZS5qc29uL25hbWVgLlxuICAgKi9cbiAgcmVhZG9ubHkgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgLyoqXG4gICAqIFRoZSByb290IGRpcmVjdG9yeSBvZiB0aGUge0BsaW5rIFByb2plY3R9LCBlLmcuIGBteS1wcm9qZWN0L2AuXG4gICAqL1xuICByZWFkb25seSByb290RGlyOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBUaGUgc291cmNlIGNvZGUgZGlyZWN0b3J5LCBlLmcuIGBteS1wcm9qZWN0L3NyYy9gXG4gICAqL1xuICByZWFkb25seSBzcmNEaXI6IHN0cmluZztcbiAgLyoqXG4gICAqIFRoZSByb290IHtAbGluayBGb2xkZXJ9IGNvbnRhaW5pbmcgYWxsIG9mIHRoaXMge0BsaW5rIFByb2plY3R9J3MgTW9kdWxlcy5cbiAgICovXG4gIHJlYWRvbmx5IG1vZHVsZTogRm9sZGVyO1xufVxuXG5leHBvcnQgY2xhc3MgUHJvamVjdCBpbXBsZW1lbnRzIFByb2plY3RQcm9wcyB7XG4gIHJlYWRvbmx5IHByb2plY3ROYW1lO1xuICByZWFkb25seSByb290RGlyO1xuICByZWFkb25seSBzcmNEaXI7XG4gIHJlYWRvbmx5IG1vZHVsZTtcblxuICAvKipcbiAgICogQWxsIHtAbGluayBGaWxlfXMgaW4gdGhlIHtAbGluayBQcm9qZWN0fS5cbiAgICovXG4gIHJlYWRvbmx5IHJlc291cmNlRmlsZXM6IEZpbGVbXTtcblxuICAvKipcbiAgICogQW4gaW5kZXggb2Yge0BsaW5rIEZpbGV9IHRoYXQgc3VwcG9ydHMgbG9va3VwcyBieTpcbiAgICogMS4gdGhlIGZ1bGx5IHF1YWxpZmllZCBhZGRyZXNzIG9mIGEge0BsaW5rIFJlc291cmNlfS5cbiAgICogMi4gdGhlIHtAbGluayBSZXNvdXJjZX0gaW5zdGFuY2UuXG4gICAqL1xuICByZWFkb25seSByZXNvdXJjZUluZGV4OiBNYXA8c3RyaW5nIHwgUmVzb3VyY2UsIEZpbGU+O1xuXG4gIGNvbnN0cnVjdG9yKHByb3BzOiBQcm9qZWN0UHJvcHMpIHtcbiAgICB0aGlzLnByb2plY3ROYW1lID0gcHJvcHMucHJvamVjdE5hbWU7XG4gICAgdGhpcy5yb290RGlyID0gcHJvcHMucm9vdERpcjtcbiAgICB0aGlzLnNyY0RpciA9IHByb3BzLnNyY0RpcjtcbiAgICB0aGlzLm1vZHVsZSA9IHByb3BzLm1vZHVsZTtcbiAgICAvLyBAdHMtaWdub3JlIC0gUHJvamVjdCwgRm9sZGVyIGFuZCBGaWxlIGFyZSBpbnRlcm5hbGx5IGNvbnNpc3RlbnQsIHNvIHdlIGJyZWFrIHR5cGVzIGhlcmVcbiAgICB0aGlzLm1vZHVsZS5wYXJlbnQgPSB0aGlzO1xuXG4gICAgdGhpcy5yZXNvdXJjZUZpbGVzID0gZ2V0UmVzb3VyY2VGaWxlcyh0aGlzLm1vZHVsZSk7XG5cbiAgICB0aGlzLnJlc291cmNlSW5kZXggPSBuZXcgTWFwKFxuICAgICAgdGhpcy5yZXNvdXJjZUZpbGVzLmZsYXRNYXAoXG4gICAgICAgIChmaWxlKSA9PlxuICAgICAgICAgIFtcbiAgICAgICAgICAgIFtmaWxlLmFkZHJlc3MsIGZpbGVdLFxuICAgICAgICAgICAgW2ZpbGUucmVzb3VyY2UsIGZpbGVdLFxuICAgICAgICAgICAgLy8gVFMncyBNYXAgZGVmaW5pdGlvbiBzZWVtcyBzdHVwaWRcbiAgICAgICAgICBdIGFzIFtzdHJpbmcsIEZpbGVdW11cbiAgICAgIClcbiAgICApO1xuICB9XG5cbiAgcHVibGljIGxvb2t1cFJlc291cmNlKGtleTogUmVzb3VyY2UgfCBzdHJpbmcpOiBGaWxlIHtcbiAgICBjb25zdCByZXNvdXJjZSA9IHRoaXMudHJ5TG9va3VwUmVzb3VyY2Uoa2V5KTtcbiAgICBpZiAocmVzb3VyY2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhZGRyZXNzICR7a2V5fSBkb2VzIG5vdCByZWZlcmVuY2UgYSBsZWFmIG5vZGVgKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc291cmNlO1xuICB9XG5cbiAgcHVibGljIHRyeUxvb2t1cFJlc291cmNlKGtleTogUmVzb3VyY2UgfCBzdHJpbmcpOiBGaWxlIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5yZXNvdXJjZUluZGV4LmdldChrZXkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFJlc291cmNlRmlsZXMobm9kZTogVHJlZSk6IEZpbGVbXSB7XG4gIGlmIChpc0ZpbGUobm9kZSkpIHtcbiAgICByZXR1cm4gW25vZGVdO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKG5vZGUudHJlZSkuZmxhdE1hcChnZXRSZXNvdXJjZUZpbGVzKTtcbiAgfVxufVxuIl19