import { Stmt } from "./statement";

const EnvironmentSymbol = Symbol.for("functionless.Environment");

export class Environment {
  public static get(): Environment {
    const env = Environment.tryGet();
    if (env === undefined) {
      throw new Error(
        `Environment does not exist, the current stack frame is not within a functionless Environment`
      );
    }
    return env;
  }

  public static tryGet(): Environment | undefined {
    return (global as any)[EnvironmentSymbol];
  }

  public static isSet(): boolean {
    return Environment.tryGet() !== undefined;
  }

  public static init(): Environment {
    return ((global as any)[EnvironmentSymbol] = new Environment());
  }

  public static unset(): void {
    delete (global as any)[EnvironmentSymbol];
  }

  public static closure<T>(
    fn: (stack: Environment) => T
  ): readonly [Environment, T] {
    if (Environment.isSet()) {
      throw new Error(`cannot call Environment.closure within another closure`);
    }
    const environment = Environment.init();
    const result = [environment, fn(environment)] as const;
    Environment.unset();
    return result;
  }

  public readonly statements: Stmt[] = [];

  private constructor() {}

  public addStatement(statement: Stmt): number {
    this.statements.push(statement);
    return this.statements.length - 1;
  }
}
