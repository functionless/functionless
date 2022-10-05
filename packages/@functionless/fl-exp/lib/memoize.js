"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoize = void 0;
function memoize(f) {
    let t;
    let set = false;
    return ((input) => {
        if (!set) {
            t = f(input);
        }
        return t;
    });
}
exports.memoize = memoize;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVtb2l6ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9tZW1vaXplLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLFNBQWdCLE9BQU8sQ0FBaUMsQ0FBSTtJQUMxRCxJQUFJLENBQWtCLENBQUM7SUFDdkIsSUFBSSxHQUFHLEdBQUcsS0FBSyxDQUFDO0lBQ2hCLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO1FBQ2hCLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDUixDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ2Q7UUFDRCxPQUFPLENBQUUsQ0FBQztJQUNaLENBQUMsQ0FBTSxDQUFDO0FBQ1YsQ0FBQztBQVRELDBCQVNDIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIG1lbW9pemU8RiBleHRlbmRzIChpbnB1dD86IGFueSkgPT4gYW55PihmOiBGKTogRiB7XG4gIGxldCB0OiBhbnkgfCB1bmRlZmluZWQ7XG4gIGxldCBzZXQgPSBmYWxzZTtcbiAgcmV0dXJuICgoaW5wdXQpID0+IHtcbiAgICBpZiAoIXNldCkge1xuICAgICAgdCA9IGYoaW5wdXQpO1xuICAgIH1cbiAgICByZXR1cm4gdCE7XG4gIH0pIGFzIEY7XG59XG4iXX0=