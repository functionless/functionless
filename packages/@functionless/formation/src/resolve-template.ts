import {
  isFnEquals,
  isFnNot,
  isFnAnd,
  isFnOr,
  isConditionRef,
} from "./condition";
import { Expression } from "./expression";
import {
  IntrinsicFunction,
  isFnBase64,
  isFnContains,
  isFnEachMemberEquals,
  isFnEachMemberIn,
  isFnFindInMap,
  isFnGetAtt,
  isFnIf,
  isFnJoin,
  isFnRefAll,
  isFnSelect,
  isFnSplit,
  isFnSub,
  isFnValueOf,
  isFnValueOfAll,
  isIntrinsicFunction,
  isRef,
  isRefString,
  parseRefString,
} from "./function";
import { Dependency } from "./graph";
import { Parameter } from "./parameter";
import { isPseudoParameter, PseudoParameter } from "./pseudo-parameter";
import { PhysicalResource } from "./resource";
import { RuleFunction, isRuleFunction } from "./rule";
import { UpdateState } from "./stack";
import { CloudFormationTemplate } from "./template";
import { isDeepEqual } from "./util";
import { Value } from "./value";
import { assertIsListOfStrings, assertIsString } from "./asserts";

export interface TemplateResult<V extends Value = Value> {
  resolvedDependencies?: Dependency[];
  unresolvedDependencies?: Dependency[];
  /**
   * The resolved value.
   *
   * If there are any unresolvedDependencies, this will fail.
   */
  value: () => Promise<V> | V;
}

export interface ParameterResolver {
  resolve(paramName: string, definition: Parameter): Promise<Value>;
}

export interface ResourceResolver {
  resolve(
    logicalId: string,
    templateResolver: TemplateResolver
  ): Promise<
    | {
        value: () =>
          | Promise<PhysicalResource | undefined>
          | PhysicalResource
          | undefined;
      }
    | undefined
  >;
}

export interface ConditionResolver {
  resolve(
    conditionName: string,
    condition: RuleFunction,
    templateResolver: TemplateResolver
  ): Promise<boolean> | boolean;
}

export interface PseudoParameterResolver {
  resolve(pseudoParameterName: PseudoParameter): Promise<Value> | Value;
}

// TODO: update all of the resolvers to be like the resource resolver
//       the resource resolver can return undefined to signify that the resource
//       is not resolvable (vs all or nothing).
export interface TemplateResolverProps {
  resourceReferenceResolver?: ResourceResolver;
  conditionReferenceResolver?: ConditionResolver;
  parameterReferenceResolver?: ParameterResolver;
  pseudoParameterResolver?: PseudoParameterResolver;
}

export class TemplateResolver {
  constructor(
    private template: CloudFormationTemplate,
    private props: TemplateResolverProps
  ) {}

  /**
   * Evaluates an {@link Expression} to a {@link PhysicalProperty}.
   *
   * This property may come from evaluating an intrinsic function or by fetching
   * an attribute from a physically deployed resource.
   *
   * @param expr expression to evaluate
   * @param state the {@link UpdateState} being evaluated
   * @returns the physical property as a primitive JSON object
   */
  public async evaluateExpr(expr: Expression): Promise<TemplateResult<Value>> {
    if (expr === undefined || expr === null) {
      return { value: () => expr };
    } else if (isIntrinsicFunction(expr)) {
      return this.evaluateIntrinsicFunction(expr);
    } else if (typeof expr === "string") {
      if (isRefString(expr)) {
        return this.evaluateIntrinsicFunction(parseRefString(expr));
      } else if (isPseudoParameter(expr)) {
        return this.evaluatePseudoParameter(expr as PseudoParameter);
      } else {
        return { value: () => expr };
      }
    } else if (Array.isArray(expr)) {
      const exprResults = await Promise.all(
        expr
          // hack to remove NoValue from an array
          .filter(
            (v) =>
              !(
                v &&
                typeof v === "object" &&
                "Ref" in v &&
                v.Ref === "AWS::NoValue"
              )
          )
          .map((e) => this.evaluateExpr(e))
      );

      return {
        resolvedDependencies: exprResults.flatMap(
          (e) => e.resolvedDependencies ?? []
        ),
        unresolvedDependencies: exprResults.flatMap(
          (e) => e.unresolvedDependencies ?? []
        ),
        value: () => Promise.all(exprResults.map((e) => e.value())),
      };
    } else if (typeof expr === "object") {
      const exprResults = await Promise.all(
        Object.entries(expr).map(
          async ([k, v]) => [k, await this.evaluateExpr(v)] as const
        )
      );

      return {
        resolvedDependencies: exprResults.flatMap(
          ([, v]) => v.resolvedDependencies ?? []
        ),
        unresolvedDependencies: exprResults.flatMap(
          ([, v]) => v.unresolvedDependencies ?? []
        ),
        value: async () =>
          Object.fromEntries(
            await Promise.all(
              exprResults.map(async ([k, { value }]) => [k, await value()])
            )
          ),
      };
    } else {
      return { value: () => expr };
    }
  }

  /**
   * Evaluate a CloudFormation {@link IntrinsicFunction} to a {@link PhysicalProperty}.
   *
   * @param expr intrinsic function expression
   * @returns the physical value of the function
   */
  private async evaluateIntrinsicFunction(
    expr: IntrinsicFunction
  ): Promise<TemplateResult> {
    if (isRef(expr)) {
      if (isPseudoParameter(expr.Ref)) {
        return this.evaluatePseudoParameter(expr.Ref as PseudoParameter);
      }
      const paramDef = this.template.Parameters?.[expr.Ref];
      if (paramDef !== undefined) {
        if (this.props.parameterReferenceResolver) {
          return {
            resolvedDependencies: [{ parameter: expr.Ref }],
            value: () =>
              this.props.parameterReferenceResolver!.resolve(
                expr.Ref,
                paramDef
              ),
          };
        } else {
          return {
            unresolvedDependencies: [{ parameter: expr.Ref }],
            value: () => {
              throw new Error(`Parameter ${expr.Ref} is unresolved.`);
            },
          };
        }
      } else {
        return await this.resolveFromResource(expr.Ref, async (resource) => {
          if (resource?.Type === "AWS::SQS::Queue") {
            return resource.Attributes.QueueUrl;
          }
          return resource?.PhysicalId;
        });
        // TODO: find a way to abstract this
      }
    } else if (isFnGetAtt(expr)) {
      const [logicalId, attributeName] = expr["Fn::GetAtt"];
      return await this.resolveFromResource(logicalId, async (resource) => {
        if (resource === undefined) {
          throw new Error(
            `Resource '${logicalId}' does not exist, perhaps a Condition is preventing it from being created?`
          );
        }
        const attributeValue = resource.Attributes[attributeName];
        if (attributeValue === undefined) {
          throw new Error(
            `attribute '${attributeName}' does not exist on resource '${logicalId}' of type '${resource.Type}'`
          );
        }
        return attributeValue;
      });
    } else if (isFnJoin(expr)) {
      const [delimiter, values] = expr["Fn::Join"];
      const valueResults = await Promise.all(
        values.map((value) => this.evaluateExpr(value))
      );
      return {
        resolvedDependencies: valueResults.flatMap(
          (e) => e.resolvedDependencies ?? []
        ),
        unresolvedDependencies: valueResults.flatMap(
          (e) => e.unresolvedDependencies ?? []
        ),
        value: async () =>
          (await Promise.all(valueResults.map((v) => v.value()))).join(
            delimiter
          ),
      };
    } else if (isFnSelect(expr)) {
      const [index, listOfObjects] = expr["Fn::Select"];
      if (isIntrinsicFunction(listOfObjects)) {
        const result = await this.evaluateIntrinsicFunction(listOfObjects);
        return {
          ...result,
          value: async () => {
            const evaled = await result.value();
            if (!Array.isArray(evaled)) {
              throw new Error(`Expected an array, found: ${evaled}`);
            } else if (index in evaled) {
              return evaled[index];
            } else {
              throw new Error(
                `index ${index} out of bounds in list: ${evaled}`
              );
            }
          },
        };
      }
      if (index in listOfObjects) {
        return this.evaluateExpr(listOfObjects[index]!);
      } else {
        throw new Error(
          `index ${index} out of bounds in list: ${listOfObjects}`
        );
      }
    } else if (isFnSplit(expr)) {
      const [delimiter, sourceStringExpr] = expr["Fn::Split"];
      const sourceStringResult = await this.evaluateExpr(sourceStringExpr);
      return {
        ...sourceStringResult,
        value: async () => {
          const sourceString = await sourceStringResult.value();
          if (typeof sourceString !== "string") {
            throw new Error(
              `Fn::Split must operate on a String, but received: ${typeof sourceString}`
            );
          }
          return sourceString.split(delimiter);
        },
      };
    } else if (isFnSub(expr)) {
      const [string, variables] =
        typeof expr["Fn::Sub"] === "string"
          ? [expr["Fn::Sub"], {}]
          : expr["Fn::Sub"];

      const foundPseudoParameters = [...string.matchAll(/\$\{([^\}]*)\}/g)]
        .flat()
        .filter(isPseudoParameter)
        .map((x) => [x, this.evaluatePseudoParameter(x)] as const);

      const resolvedValuesResults = await Promise.all(
        Object.entries(variables).map(
          async ([varName, varVal]) =>
            [varName, await this.evaluateExpr(varVal)] as const
        )
      );

      return {
        resolvedDependencies: [
          ...resolvedValuesResults,
          ...(foundPseudoParameters ?? []),
        ].flatMap(([, r]) => r.resolvedDependencies ?? []),
        unresolvedDependencies: [
          ...resolvedValuesResults,
          ...(foundPseudoParameters ?? []),
        ].flatMap(([, r]) => r.unresolvedDependencies ?? []),
        value: async () => {
          const resolvedValues = Object.fromEntries(
            await Promise.all(
              resolvedValuesResults.map(
                async ([k, r]) => [k, await r.value()] as const
              )
            )
          );
          const resolvedPseudoParameters = Object.fromEntries(
            await Promise.all(
              (foundPseudoParameters ?? []).map(
                async ([x, v]) => [x, await v.value()] as const
              )
            )
          );
          // match "something ${this} something"
          return string.replace(/\$\{([^\}]*)\}/g, (_, varName) => {
            const varVal =
              varName in resolvedValues
                ? resolvedValues[varName]
                : isPseudoParameter(varName)
                ? resolvedPseudoParameters[varName]
                : undefined;
            if (
              typeof varVal === "string" ||
              typeof varVal === "number" ||
              typeof varVal === "boolean"
            ) {
              return `${varVal}`;
            } else {
              throw new Error(
                `Variable '${varName}' in Fn::Sub did not resolve to a String, Number or Boolean: ${varVal}`
              );
            }
          });
        },
      };
    } else if (isFnBase64(expr)) {
      const exprValResult = await this.evaluateExpr(expr["Fn::Base64"]);
      return {
        ...exprValResult,
        value: async () => {
          const exprVal = await exprValResult.value();
          if (typeof exprVal === "string") {
            return Buffer.from(exprVal, "utf8").toString("base64");
          } else {
            throw new Error(
              `Fn::Base64 can only convert String values to Base64, but got '${typeof exprVal}'`
            );
          }
        },
      };
    } else if (isFnFindInMap(expr)) {
      const [mapName, topLevelKeyExpr, secondLevelKeyExpr] =
        expr["Fn::FindInMap"];

      const topLevelKeyResult = await this.evaluateExpr(topLevelKeyExpr);
      const secondLevelKeyResult = await this.evaluateExpr(secondLevelKeyExpr);

      return {
        resolvedDependencies: [
          ...(topLevelKeyResult.resolvedDependencies ?? []),
          ...(secondLevelKeyResult.resolvedDependencies ?? []),
        ],
        unresolvedDependencies: [
          ...(topLevelKeyResult.unresolvedDependencies ?? []),
          ...(secondLevelKeyResult.unresolvedDependencies ?? []),
        ],
        value: async () => {
          const [topLevelKey, secondLevelKey] = await Promise.all([
            topLevelKeyResult.value(),
            secondLevelKeyResult.value(),
          ]);

          if (typeof topLevelKey !== "string") {
            throw new Error(
              `The topLevelKey in Fn::FindInMap must be a string, but got ${typeof topLevelKeyExpr}`
            );
          }
          if (typeof secondLevelKey !== "string") {
            throw new Error(
              `The secondLevelKey in Fn::FindInMap must be a string, but got ${typeof secondLevelKeyExpr}`
            );
          }
          const value =
            this.template.Mappings?.[mapName]?.[topLevelKey]?.[secondLevelKey];
          if (value === undefined) {
            throw new Error(
              `Could not find map value: ${mapName}.${topLevelKey}.${secondLevelKey}`
            );
          }
          return value;
        },
      };
    } else if (isFnRefAll(expr)) {
      const parameters = Object.entries(this.template.Parameters ?? {}).filter(
        ([, def]) => def.Type === expr["Fn::RefAll"]
      );
      const dependencies = parameters.map(([name]) => ({
        parameter: name,
      }));

      if (this.props.parameterReferenceResolver) {
        return {
          resolvedDependencies: dependencies,
          value: async () =>
            await Promise.all(
              parameters.map(([name, def]) =>
                this.props.parameterReferenceResolver!.resolve(name, def)
              )
            ),
        };
      } else {
        return {
          unresolvedDependencies: dependencies,
          value: () => {
            throw new Error("Parameters are not resolved");
          },
        };
      }
    } else if (isFnIf(expr)) {
      const [_when, thenExpr, elseExpr] = expr["Fn::If"];

      const whenResult =
        typeof _when === "string"
          ? this.resolveFromCondition(_when, async (resolver) =>
              resolver.resolve(_when, this.template.Conditions?.[_when]!, this)
            )
          : await this.evaluateRuleFunction(_when);

      if (!whenResult) {
        throw new Error(
          "When clause of Fn::If must be defined and if it is a reference, it must exist."
        );
      }

      const thenExprResult = await this.evaluateExpr(thenExpr);
      const elseExprResult = await this.evaluateExpr(elseExpr);

      return {
        resolvedDependencies: [
          ...(whenResult.resolvedDependencies ?? []),
          ...(thenExprResult.resolvedDependencies ?? []),
          ...(elseExprResult.resolvedDependencies ?? []),
        ],
        unresolvedDependencies: [
          ...(whenResult.unresolvedDependencies ?? []),
          ...(thenExprResult.unresolvedDependencies ?? []),
          ...(elseExprResult.unresolvedDependencies ?? []),
        ],
        value: async () => {
          const when = await whenResult.value();
          return when ? thenExprResult.value() : elseExprResult.value();
        },
      };
    }

    throw new Error(
      `expression not implemented: ${Object.keys(expr).join(",")}`
    );
  }

  private resolveFromCondition(
    conditionName: string,
    resolve: (
      conditionResolver: ConditionResolver,
      conditionName: string
    ) => Promise<boolean>
  ): TemplateResult<boolean> {
    if (this.props.conditionReferenceResolver) {
      return {
        resolvedDependencies: [{ condition: conditionName }],
        value: () =>
          resolve(this.props.conditionReferenceResolver!, conditionName),
      };
    } else {
      return {
        unresolvedDependencies: [{ condition: conditionName }],
        value: () => {
          throw new Error(`Condition ${conditionName} is unresolved`);
        },
      };
    }
  }

  private async resolveFromResource(
    logicalId: string,
    resolve: (
      resource: PhysicalResource | undefined,
      logicalId: string
    ) => Promise<Value>
  ): Promise<TemplateResult<Value>> {
    if (this.props.resourceReferenceResolver) {
      const resourceResult = await this.props.resourceReferenceResolver.resolve(
        logicalId,
        this
      );
      if (resourceResult) {
        return {
          resolvedDependencies: [{ logicalId }],
          value: async () => resolve(await resourceResult.value(), logicalId),
        };
      } else {
        return {
          unresolvedDependencies: [{ logicalId }],
          value: () => {
            throw new Error(`Resource ${logicalId} is unresolved`);
          },
        };
      }
    } else {
      return {
        unresolvedDependencies: [{ logicalId }],
        value: () => {
          throw new Error(`Resource ${logicalId} is unresolved`);
        },
      };
    }
  }

  /**
   * Evaluate a {@link RuleFunction} or {@link ConditionFunction} to a boolean.
   */
  public async evaluateRuleFunction(
    expr: RuleFunction
  ): Promise<TemplateResult<boolean>> {
    if (isFnEquals(expr)) {
      const [left, right] = await Promise.all(
        expr["Fn::Equals"].map((expr) =>
          isRuleFunction(expr)
            ? this.evaluateRuleFunction(expr)
            : this.evaluateExpr(expr)
        )
      );
      return {
        resolvedDependencies: [
          ...(left?.resolvedDependencies ?? []),
          ...(right?.resolvedDependencies ?? []),
        ],
        unresolvedDependencies: [
          ...(left?.unresolvedDependencies ?? []),
          ...(right?.unresolvedDependencies ?? []),
        ],
        value: async () => {
          return isDeepEqual(await left?.value(), await right?.value());
        },
      };
    } else if (isFnNot(expr)) {
      const [conditionExpr, ...rest] = expr["Fn::Not"];
      if (!conditionExpr || rest.length > 0) {
        throw new Error(
          `Malformed input to Fn::Not - you must provide exactly one [{condition}].`
        );
      }
      const conditionExprResult = isRuleFunction(expr)
        ? await this.evaluateRuleFunction(expr)
        : await this.evaluateExpr(expr);
      return {
        ...conditionExprResult,
        value: async () => {
          const condition = await conditionExprResult.value();
          if (typeof condition === "boolean") {
            return !condition;
          } else {
            throw new Error(
              `Malformed input to Fn::Not - expected a boolean but received ${typeof condition}`
            );
          }
        },
      };
    } else if (isFnAnd(expr)) {
      if (expr["Fn::And"].length === 0) {
        throw new Error(
          `Malformed input to Fn::And - your must provide at least one [{condition}].`
        );
      }
      const results = await Promise.all(
        expr["Fn::And"].map((expr) =>
          isRuleFunction(expr)
            ? this.evaluateRuleFunction(expr)
            : this.evaluateExpr(expr)
        )
      );
      return {
        resolvedDependencies: results.flatMap(
          (r) => r.resolvedDependencies ?? []
        ),
        unresolvedDependencies: results.flatMap(
          (r) => r.unresolvedDependencies ?? []
        ),
        value: async () => {
          const values = await Promise.all(results.map((r) => r.value()));
          if (values.some((v) => typeof v !== "boolean")) {
            throw new Error(
              `Malformed input to Fn::And - expected a boolean but received ${typeof values
                .map((v) => typeof v)
                .filter((v) => v !== "boolean")
                .join(",")}`
            );
          }
          return values.every((a) => a);
        },
      };
    } else if (isFnOr(expr)) {
      if (expr["Fn::Or"].length === 0) {
        throw new Error(
          `Malformed input to Fn::Or - your must provide at least one [{condition}].`
        );
      }
      const results = await Promise.all(
        expr["Fn::Or"].map((expr) =>
          isRuleFunction(expr)
            ? this.evaluateRuleFunction(expr)
            : this.evaluateExpr(expr)
        )
      );
      return {
        resolvedDependencies: results.flatMap(
          (r) => r.resolvedDependencies ?? []
        ),
        unresolvedDependencies: results.flatMap(
          (r) => r.unresolvedDependencies ?? []
        ),
        value: async () => {
          const values = await Promise.all(results.map((r) => r.value()));
          if (values.some((v) => typeof v !== "boolean")) {
            throw new Error(
              `Malformed input to Fn::Or - expected a boolean but received ${typeof values
                .map((v) => typeof v)
                .filter((v) => v !== "boolean")
                .join(",")}`
            );
          }
          return values.some((a) => a);
        },
      };
    } else if (isFnContains(expr)) {
      const [listOfStringsResults, stringResults] = await Promise.all(
        expr["Fn::Contains"].map((expr) => this.evaluateExpr(expr))
      );

      return {
        resolvedDependencies: [
          ...(listOfStringsResults?.resolvedDependencies ?? []),
          ...(stringResults?.resolvedDependencies ?? []),
        ],
        unresolvedDependencies: [
          ...(listOfStringsResults?.unresolvedDependencies ?? []),
          ...(stringResults?.unresolvedDependencies ?? []),
        ],
        value: async () => {
          const [listOfStrings, string] = await Promise.all([
            listOfStringsResults!.value(),
            stringResults!.value(),
          ]);

          assertIsListOfStrings(listOfStrings, "listOfStrings");
          assertIsString(string, "string");

          return listOfStrings.includes(string);
        },
      };
    } else if (isFnEachMemberEquals(expr)) {
      const [listOfStringsResults, stringResults] = await Promise.all(
        expr["Fn::EachMemberEquals"].map((expr) => this.evaluateExpr(expr))
      );

      return {
        resolvedDependencies: [
          ...(listOfStringsResults?.resolvedDependencies ?? []),
          ...(stringResults?.resolvedDependencies ?? []),
        ],
        unresolvedDependencies: [
          ...(listOfStringsResults?.unresolvedDependencies ?? []),
          ...(stringResults?.unresolvedDependencies ?? []),
        ],
        value: async () => {
          const [listOfStrings, string] = await Promise.all([
            listOfStringsResults!.value(),
            stringResults!.value(),
          ]);

          assertIsListOfStrings(listOfStrings, "listOfStrings");
          assertIsString(string, "string");

          return listOfStrings.find((s) => s !== string) === undefined;
        },
      };
    } else if (isFnEachMemberIn(expr)) {
      const [stringsToCheckResults, stringsToMatchResults] = await Promise.all(
        expr["Fn::EachMemberIn"].map((expr) => this.evaluateExpr(expr))
      );

      return {
        resolvedDependencies: [
          ...(stringsToCheckResults?.resolvedDependencies ?? []),
          ...(stringsToMatchResults?.resolvedDependencies ?? []),
        ],
        unresolvedDependencies: [
          ...(stringsToCheckResults?.unresolvedDependencies ?? []),
          ...(stringsToMatchResults?.unresolvedDependencies ?? []),
        ],
        value: async () => {
          const [stringsToCheck, stringsToMatch] = await Promise.all([
            stringsToCheckResults!.value(),
            stringsToMatchResults!.value(),
          ]);

          assertIsListOfStrings(stringsToCheck, "stringsToCheck");
          assertIsString(stringsToMatch, "stringsToMatch");

          return stringsToCheck.every((check) =>
            stringsToMatch.includes(check)
          );
        },
      };
    } else if (isFnValueOf(expr)) {
      throw new Error("Fn::ValueOf is not yet supported");
    } else if (isFnValueOfAll(expr)) {
      throw new Error("Fn::ValueOfAll is not yet supported");
    } else if (isFnRefAll(expr)) {
      throw new Error("Fn::refAll is not yet supported");
    } else if (isConditionRef(expr)) {
      if (this.props.conditionReferenceResolver) {
        return {
          resolvedDependencies: [{ condition: expr.Condition }],
          value: () =>
            this.props.conditionReferenceResolver!.resolve(
              expr.Condition,
              this.template.Conditions?.[expr.Condition]!,
              this
            ),
        };
      } else {
        return {
          unresolvedDependencies: [{ condition: expr.Condition }],
          value: () => {
            throw new Error(`Condition ${expr.Condition} is unresolved.`);
          },
        };
      }
    }
    const __exhaustive: never = expr;
    return __exhaustive;
  }

  /**
   * Evaluate a {@link PseudoParameter} and return its value.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html
   */
  private evaluatePseudoParameter(expr: PseudoParameter): TemplateResult {
    if (this.props.pseudoParameterResolver) {
      return {
        resolvedDependencies: [{ pseudoParameter: expr }],
        value: () => this.props.pseudoParameterResolver!.resolve(expr),
      };
    } else {
      return {
        unresolvedDependencies: [{ pseudoParameter: expr }],
        value: () => {
          throw new Error("Pseudo Parameters are not resolved");
        },
      };
    }
  }
}
