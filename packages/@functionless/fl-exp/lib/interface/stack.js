"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stack = exports.isStack = exports.StackKind = void 0;
exports.StackKind = "fl.Stack";
function isStack(a) {
    return (a === null || a === void 0 ? void 0 : a.kind) === exports.StackKind;
}
exports.isStack = isStack;
function Stack(props) {
    return {
        kind: exports.StackKind,
        props,
    };
}
exports.Stack = Stack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW50ZXJmYWNlL3N0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVhLFFBQUEsU0FBUyxHQUFHLFVBQVUsQ0FBQztBQU9wQyxTQUFnQixPQUFPLENBQUMsQ0FBTTtJQUM1QixPQUFPLENBQUEsQ0FBQyxhQUFELENBQUMsdUJBQUQsQ0FBQyxDQUFFLElBQUksTUFBSyxpQkFBUyxDQUFDO0FBQy9CLENBQUM7QUFGRCwwQkFFQztBQUVELFNBQWdCLEtBQUssQ0FBQyxLQUFrQjtJQUN0QyxPQUFrQjtRQUNoQixJQUFJLEVBQUUsaUJBQVM7UUFDZixLQUFLO0tBQ04sQ0FBQztBQUNKLENBQUM7QUFMRCxzQkFLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgU3RhY2tQcm9wcyB9IGZyb20gXCJhd3MtY2RrLWxpYi9jb3JlL2xpYi9zdGFja1wiO1xuXG5leHBvcnQgY29uc3QgU3RhY2tLaW5kID0gXCJmbC5TdGFja1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFN0YWNrRGVjbCB7XG4gIGtpbmQ6IHR5cGVvZiBTdGFja0tpbmQ7XG4gIHByb3BzPzogU3RhY2tQcm9wcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU3RhY2soYTogYW55KTogYSBpcyBTdGFja0RlY2wge1xuICByZXR1cm4gYT8ua2luZCA9PT0gU3RhY2tLaW5kO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gU3RhY2socHJvcHM/OiBTdGFja1Byb3BzKSB7XG4gIHJldHVybiA8U3RhY2tEZWNsPntcbiAgICBraW5kOiBTdGFja0tpbmQsXG4gICAgcHJvcHMsXG4gIH07XG59XG4iXX0=