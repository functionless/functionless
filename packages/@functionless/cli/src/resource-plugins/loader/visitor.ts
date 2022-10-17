import * as swc from "@swc/core";
import Visitor from "@swc/core/Visitor";

/**
 * Type which consumers can implement to transform their modules
 */
export type ModuleVisitor = Partial<Omit<Visitor, "visitProgram">>;

/**
 * Apply a given module transformer to the specified swc module
 */
export function transformModuleWithVisitor(
  m: swc.Module,
  visitor: ModuleVisitor
): swc.Module {
  return linkModuleVisitor(visitor).visitModule(m);
}

/**
 * An swc visitor that doesn't balk on visitTsType
 */
class BaseVisitor extends Visitor {
  visitTsType(n: swc.TsType): swc.TsType {
    return n;
  }
}

/**
 * Get all Visitor 'visit' functions
 * @returns
 */
function getVisitorEntries(): [string, (node: any) => any][] {
  const baseVisitor = new BaseVisitor();
  const getPropertyNames = (obj: any): string[] => {
    const proto = Object.getPrototypeOf(obj);
    return [
      ...Object.getOwnPropertyNames(obj),
      ...(proto ? getPropertyNames(proto) : []),
    ];
  };
  return getPropertyNames(baseVisitor)
    .filter((n) => n.startsWith("visit"))
    .map((n) => [n, Reflect.get(baseVisitor, n, baseVisitor)]);
}

const visitorEntries = getVisitorEntries();

/**
 * Given partially implemented module visitor, back it up with swc's Visitor class
 * to provide a complete walking visitor that isn't inheritance-based
 * @param moduleVisitor
 * @returns
 */
function linkModuleVisitor(
  moduleVisitor: ModuleVisitor
): Required<ModuleVisitor> {
  const visitor = {} as Required<ModuleVisitor>;
  visitorEntries.forEach(([name, baseMethod]) => {
    Reflect.defineProperty(visitor, name, {
      value: (arg: any) => {
        const transformerMethod = Reflect.get(
          moduleVisitor,
          name,
          moduleVisitor
        );
        const transformed = transformerMethod
          ? Reflect.apply(transformerMethod, moduleVisitor, [arg])
          : arg;
        return Reflect.apply(baseMethod, visitor, [transformed]);
      },
    });
  });
  return visitor;
}
