import {
  Annotations,
  App,
  AppProps,
  Aspects,
  Aws,
  CfnCondition,
  CfnElement,
  CfnOutput,
  CfnParameter,
  CfnResource,
  DefaultTokenResolver,
  Fn,
  IAspect,
  IFragmentConcatenator,
  IInspectable,
  Intrinsic,
  IPostProcessor,
  IResolvable,
  IResolveContext,
  isResolvableObject,
  ISynthesisSession,
  ITokenResolver,
  Lazy,
  Names,
  Reference,
  ResolveChangeContextOptions,
  Stack,
  Stage,
  StageSynthesisOptions,
  StringConcat,
  Token,
  Tokenization,
  TokenizedStringFragments,
  TreeInspector,
} from "aws-cdk-lib";
import * as cxapi from "aws-cdk-lib/cx-api";
import { Construct, ConstructOrder, Dependable, IConstruct } from "constructs";
import * as zlib from "zlib";
import { RegionInfo } from "aws-cdk-lib/region-info";
import { ArtifactType } from "aws-cdk-lib/cloud-assembly-schema";
import path from "path";
import fs from "fs";

export class AsyncApp extends App {
  constructor(props?: AppProps) {
    super({
      ...props,
      autoSynth: false,
    });

    if (props?.autoSynth !== false) {
      process.once("beforeExit", () => {
        this.synthAsync();
      });
    }
  }

  private assemblyPromise: Promise<cxapi.CloudAssembly> | undefined;

  public synthAsync(
    options?: StageSynthesisOptions
  ): Promise<cxapi.CloudAssembly> {
    if (!this.assemblyPromise || options?.force) {
      this.assemblyPromise = synthesizeAsync(this, options);
    }
    return this.assemblyPromise;
  }
}

export function isSynthesizeAsync(a: any): a is SynthesizeAsync {
  return typeof a?.synthesizeAsync === "function";
}

export interface SynthesizeAsync {
  synthesizeAsync(session: ISynthesisSession): Promise<void>;
}

/**
 * Options for `synthesize()`
 */
export interface SynthesisOptions extends StageSynthesisOptions {
  /**
   * The output directory into which to synthesize the cloud assembly.
   * @default - creates a temporary directory
   */
  readonly outdir?: string;
}

export async function synthesizeAsync(
  root: IConstruct,
  options: SynthesisOptions = {}
): Promise<cxapi.CloudAssembly> {
  await visit(root, "pre", async (construct) => {
    if (isSynthesizeAsync(construct)) {
      console.log("is async", construct.node.id);
      await construct.synthesizeAsync(undefined as unknown as any);
    }
  });

  // we start by calling "synth" on all nested assemblies (which will take care of all their children)
  synthNestedAssemblies(root, options);

  invokeAspects(root);

  injectMetadataResources(root);

  // resolve references
  prepareApp(root);

  // give all children an opportunity to validate now that we've finished prepare
  if (!options.skipValidation) {
    validateTree(root);
  }

  // in unit tests, we support creating free-standing stacks, so we create the
  // assembly builder here.
  const builder = Stage.isStage(root)
    ? root._assemblyBuilder
    : new cxapi.CloudAssemblyBuilder(options.outdir);

  // next, we invoke "onSynthesize" on all of our children. this will allow
  // stacks to add themselves to the synthesized cloud assembly.
  await synthesizeTree(root, builder, options.validateOnSynthesis);

  return builder.buildAssembly();
}

const CUSTOM_SYNTHESIS_SYM = Symbol.for("@aws-cdk/core:customSynthesis");

/**
 * Interface for constructs that want to do something custom during synthesis
 *
 * This feature is intended for use by official AWS CDK libraries only; 3rd party
 * library authors and CDK users should not use this function.
 */
export interface ICustomSynthesis {
  /**
   * Called when the construct is synthesized
   */
  onSynthesize(session: ISynthesisSession): void;
}

export function addCustomSynthesis(
  construct: IConstruct,
  synthesis: ICustomSynthesis
): void {
  Object.defineProperty(construct, CUSTOM_SYNTHESIS_SYM, {
    value: synthesis,
    enumerable: false,
  });
}

function getCustomSynthesis(
  construct: IConstruct
): ICustomSynthesis | undefined {
  return (construct as any)[CUSTOM_SYNTHESIS_SYM];
}

/**
 * Find Assemblies inside the construct and call 'synth' on them
 *
 * (They will in turn recurse again)
 */
function synthNestedAssemblies(
  root: IConstruct,
  options: StageSynthesisOptions
) {
  for (const child of root.node.children) {
    if (Stage.isStage(child)) {
      child.synth(options);
    } else {
      synthNestedAssemblies(child, options);
    }
  }
}

/**
 * Invoke aspects on the given construct tree.
 *
 * Aspects are not propagated across Assembly boundaries. The same Aspect will not be invoked
 * twice for the same construct.
 */
function invokeAspects(root: IConstruct) {
  const invokedByPath: { [nodePath: string]: IAspect[] } = {};

  let nestedAspectWarning = false;
  recurse(root, []);

  function recurse(construct: IConstruct, inheritedAspects: IAspect[]) {
    const node = construct.node;
    const aspects = Aspects.of(construct);
    const allAspectsHere = [...(inheritedAspects ?? []), ...aspects.all];
    const nodeAspectsCount = aspects.all.length;
    for (const aspect of allAspectsHere) {
      let invoked = invokedByPath[node.path];
      if (!invoked) {
        invoked = invokedByPath[node.path] = [];
      }

      if (invoked.includes(aspect)) {
        continue;
      }

      aspect.visit(construct);

      // if an aspect was added to the node while invoking another aspect it will not be invoked, emit a warning
      // the `nestedAspectWarning` flag is used to prevent the warning from being emitted for every child
      if (!nestedAspectWarning && nodeAspectsCount !== aspects.all.length) {
        Annotations.of(construct).addWarning(
          "We detected an Aspect was added via another Aspect, and will not be applied"
        );
        nestedAspectWarning = true;
      }

      // mark as invoked for this node
      invoked.push(aspect);
    }

    for (const child of construct.node.children) {
      if (!Stage.isStage(child)) {
        recurse(child, allAspectsHere);
      }
    }
  }
}

/**
 * Find all stacks and add Metadata Resources to all of them
 *
 * There is no good generic place to do this. Can't do it in the constructor
 * (because adding a child construct makes it impossible to set context on the
 * node), and the generic prepare phase is deprecated.
 *
 * Only do this on [parent] stacks (not nested stacks), don't do this when
 * disabled by the user.
 *
 * Also, only when running via the CLI. If we do it unconditionally,
 * all unit tests everywhere are going to break massively. I've spent a day
 * fixing our own, but downstream users would be affected just as badly.
 *
 * Stop at Assembly boundaries.
 */
function injectMetadataResources(root: IConstruct) {
  visit(root, "post", async (construct) => {
    if (!Stack.isStack(construct) || !construct._versionReportingEnabled) {
      return;
    }

    // Because of https://github.com/aws/aws-cdk/blob/master/packages/assert-internal/lib/synth-utils.ts#L74
    // synthesize() may be called more than once on a stack in unit tests, and the below would break
    // if we execute it a second time. Guard against the constructs already existing.
    const CDKMetadata = "CDKMetadata";
    if (construct.node.tryFindChild(CDKMetadata)) {
      return;
    }

    new MetadataResource(construct, CDKMetadata);
  });
}

/**
 * Synthesize children in post-order into the given builder
 *
 * Stop at Assembly boundaries.
 */
async function synthesizeTree(
  root: IConstruct,
  builder: cxapi.CloudAssemblyBuilder,
  validateOnSynth: boolean = false
) {
  await visit(root, "post", async (construct) => {
    const session = {
      outdir: builder.outdir,
      assembly: builder,
      validateOnSynth,
    };

    // // run async hooks after synchronous synth processes
    // if (isSynthesizeAsync(construct)) {
    //   console.log("is async", construct.node.id);
    //   await construct.synthesizeAsync(session);
    // }

    if (Stack.isStack(construct)) {
      construct.synthesizer.synthesize(session);
    } else if (construct instanceof TreeMetadata) {
      construct._synthesizeTree(session);
    } else {
      const custom = getCustomSynthesis(construct);
      custom?.onSynthesize(session);
    }
  });
}

interface ValidationError {
  readonly message: string;
  readonly source: IConstruct;
}

/**
 * Validate all constructs in the given construct tree
 */
function validateTree(root: IConstruct) {
  const errors = new Array<ValidationError>();

  visit(root, "pre", async (construct) => {
    for (const message of construct.node.validate()) {
      errors.push({ message, source: construct });
    }
  });

  if (errors.length > 0) {
    const errorList = errors
      .map((e) => `[${e.source.node.path}] ${e.message}`)
      .join("\n  ");
    throw new Error(
      `Validation failed with the following errors:\n  ${errorList}`
    );
  }
}

/**
 * Visit the given construct tree in either pre or post order, stopping at Assemblies
 */
async function visit(
  root: IConstruct,
  order: "pre" | "post",
  cb: (x: IConstruct) => Promise<void>
) {
  if (order === "pre") {
    console.log(root.node.id);
    await cb(root);
  }

  for (const child of root.node.children) {
    console.log(root.node.id, child.node.id);
    if (Stage.isStage(child)) {
      continue;
    }
    await visit(child, order, cb);
  }

  if (order === "post") {
    console.log(root.node.id);
    await cb(root);
  }
}

/**
 * Prepares the app for synthesis. This function is called by the root `prepare`
 * (normally this the App, but if a Stack is a root, it is called by the stack),
 * which means it's the last 'prepare' that executes.
 *
 * It takes care of reifying cross-references between stacks (or nested stacks),
 * and of creating assets for nested stack templates.
 *
 * @param root The root of the construct tree.
 */
export function prepareApp(root: IConstruct) {
  // apply dependencies between resources in depending subtrees
  for (const dependency of findTransitiveDeps(root)) {
    const targetCfnResources = findCfnResources(dependency.target);
    const sourceCfnResources = findCfnResources(dependency.source);

    for (const target of targetCfnResources) {
      for (const source of sourceCfnResources) {
        source.addDependsOn(target);
      }
    }
  }

  resolveReferences(root);

  // depth-first (children first) queue of nested stacks. We will pop a stack
  // from the head of this queue to prepare its template asset.
  //
  // Depth-first since the a nested stack's template hash will be reflected in
  // its parent's template, which then changes the parent's hash, etc.
  const queue = findAllNestedStacks(root);

  if (queue.length > 0) {
    while (queue.length > 0) {
      const nested = queue.shift()!;
      defineNestedStackAsset(nested);
    }

    // ▷[ Given the legacy synthesizer and a 3-or-deeper nesting of nested stacks ]
    //
    // Adding nested stack assets may haved added CfnParameters to the top-level
    // stack which are referenced in a deeper-level stack. The values of these
    // parameters need to be carried through to the right location via Nested
    // Stack parameters, which `resolveReferences()` will do.
    //
    // Yes, this may add `Parameter` elements to a template whose hash has
    // already been calculated, but the invariant that if the functional part
    // of the template changes its hash will change is still upheld.
    resolveReferences(root);
  }
}

/**
 * Prepares the assets for nested stacks in this app.
 * @returns `true` if assets were added to the parent of a nested stack, which
 * implies that another round of reference resolution is in order. If this
 * function returns `false`, we know we are done.
 */
function defineNestedStackAsset(nestedStack: Stack) {
  // this is needed temporarily until we move NestedStack to '@aws-cdk/core'.
  const nested: INestedStackPrivateApi = nestedStack as any;
  nested._prepareTemplateAsset();
}

function findAllNestedStacks(root: IConstruct) {
  const result = new Array<Stack>();

  const includeStack = (stack: IConstruct): stack is Stack => {
    if (!Stack.isStack(stack)) {
      return false;
    }
    if (!stack.nested) {
      return false;
    }

    // test: if we are not within a stage, then include it.
    if (!Stage.of(stack)) {
      return true;
    }

    return Stage.of(stack) === root;
  };

  // create a list of all nested stacks in depth-first post order this means
  // that we first prepare the leaves and then work our way up.
  for (const stack of root.node.findAll(
    ConstructOrder.POSTORDER /* <== important */
  )) {
    if (includeStack(stack)) {
      result.push(stack);
    }
  }

  return result;
}

/**
 * Find all resources in a set of constructs
 */
function findCfnResources(root: IConstruct): CfnResource[] {
  return root.node.findAll().filter(CfnResource.isCfnResource);
}

interface INestedStackPrivateApi {
  _prepareTemplateAsset(): boolean;
}

/**
 * Return all dependencies registered on this node or any of its children
 */
function findTransitiveDeps(root: IConstruct): Dependency[] {
  const found = new Map<IConstruct, Set<IConstruct>>(); // Deduplication map
  const ret = new Array<Dependency>();

  for (const source of root.node.findAll()) {
    for (const dependable of source.node.dependencies) {
      for (const target of Dependable.of(dependable).dependencyRoots) {
        let foundTargets = found.get(source);
        if (!foundTargets) {
          found.set(source, (foundTargets = new Set()));
        }

        if (!foundTargets.has(target)) {
          ret.push({ source, target });
          foundTargets.add(target);
        }
      }
    }
  }

  return ret;
}

interface Dependency {
  readonly source: IConstruct;
  readonly target: IConstruct;
}

/**
 * This is called from the App level to resolve all references defined. Each
 * reference is resolved based on it's consumption context.
 */
export function resolveReferences(scope: IConstruct): void {
  const edges = findAllReferences(scope);

  for (const { source, value } of edges) {
    const consumer = Stack.of(source);

    // resolve the value in the context of the consumer
    if (!value.hasValueForStack(consumer)) {
      const resolved = resolveValue(consumer, value);
      value.assignValueForStack(consumer, resolved);
    }
  }
}

/**
 * Resolves the value for `reference` in the context of `consumer`.
 */
function resolveValue(consumer: Stack, reference: CfnReference): IResolvable {
  const producer = Stack.of(reference.target);

  // produce and consumer stacks are the same, we can just return the value itself.
  if (producer === consumer) {
    return reference;
  }

  // unsupported: stacks from different apps
  if (producer.node.root !== consumer.node.root) {
    throw new Error(
      "Cannot reference across apps. Consuming and producing stacks must be defined within the same CDK app."
    );
  }

  // unsupported: stacks are not in the same environment
  if (producer.environment !== consumer.environment) {
    throw new Error(
      `Stack "${consumer.node.path}" cannot consume a cross reference from stack "${producer.node.path}". ` +
        "Cross stack references are only supported for stacks deployed to the same environment or between nested stacks and their parent stack"
    );
  }

  // ----------------------------------------------------------------------
  // consumer is nested in the producer (directly or indirectly)
  // ----------------------------------------------------------------------

  // if the consumer is nested within the producer (directly or indirectly),
  // wire through a CloudFormation parameter and then resolve the reference with
  // the parent stack as the consumer.
  if (consumer.nestedStackParent && isNested(consumer, producer)) {
    const parameterValue = resolveValue(consumer.nestedStackParent, reference);
    return createNestedStackParameter(consumer, reference, parameterValue);
  }

  // ----------------------------------------------------------------------
  // producer is a nested stack
  // ----------------------------------------------------------------------

  // if the producer is nested, always publish the value through a
  // cloudformation output and resolve recursively with the Fn::GetAtt
  // of the output in the parent stack.

  // one might ask, if the consumer is not a parent of the producer,
  // why not just use export/import? the reason is that we cannot
  // generate an "export name" from a nested stack because the export
  // name must contain the stack name to ensure uniqueness, and we
  // don't know the stack name of a nested stack before we deploy it.
  // therefore, we can only export from a top-level stack.
  if (producer.nested) {
    const outputValue = createNestedStackOutput(producer, reference);
    return resolveValue(consumer, outputValue);
  }

  // ----------------------------------------------------------------------
  // export/import
  // ----------------------------------------------------------------------

  // export the value through a cloudformation "export name" and use an
  // Fn::ImportValue in the consumption site.

  // add a dependency between the producer and the consumer. dependency logic
  // will take care of applying the dependency at the right level (e.g. the
  // top-level stacks).
  consumer.addDependency(
    producer,
    `${consumer.node.path} -> ${reference.target.node.path}.${reference.displayName}`
  );

  return createImportValue(reference);
}

/**
 * Finds all the CloudFormation references in a construct tree.
 */
function findAllReferences(root: IConstruct) {
  const result = new Array<{ source: CfnElement; value: CfnReference }>();
  for (const consumer of root.node.findAll()) {
    // include only CfnElements (i.e. resources)
    if (!CfnElement.isCfnElement(consumer)) {
      continue;
    }

    try {
      const tokens = findTokens(consumer, () => consumer._toCloudFormation());

      // iterate over all the tokens (e.g. intrinsic functions, lazies, etc) that
      // were found in the cloudformation representation of this resource.
      for (const token of tokens) {
        // include only CfnReferences (i.e. "Ref" and "Fn::GetAtt")
        if (!CfnReference.isCfnReference(token)) {
          continue;
        }

        result.push({
          source: consumer,
          value: token,
        });
      }
    } catch (e: any) {
      // Note: it might be that the properties of the CFN object aren't valid.
      // This will usually be preventatively caught in a construct's validate()
      // and turned into a nicely descriptive error, but we're running prepare()
      // before validate(). Swallow errors that occur because the CFN layer
      // doesn't validate completely.
      //
      // This does make the assumption that the error will not be rectified,
      // but the error will be thrown later on anyway. If the error doesn't
      // get thrown down the line, we may miss references.
      if (e.type === "CfnSynthesisError") {
        continue;
      }

      throw e;
    }
  }

  return result;
}

// ------------------------------------------------------------------------------------------------
// export/import
// ------------------------------------------------------------------------------------------------

/**
 * Imports a value from another stack by creating an "Output" with an "ExportName"
 * and returning an "Fn::ImportValue" token.
 */
function createImportValue(reference: Reference): Intrinsic {
  const exportingStack = Stack.of(reference.target);

  const importExpr = exportingStack.exportValue(reference);

  // I happen to know this returns a Fn.importValue() which implements Intrinsic.
  return Tokenization.reverseCompleteString(importExpr) as Intrinsic;
}

// ------------------------------------------------------------------------------------------------
// nested stacks
// ------------------------------------------------------------------------------------------------

/**
 * Adds a CloudFormation parameter to a nested stack and assigns it with the
 * value of the reference.
 */
function createNestedStackParameter(
  nested: Stack,
  reference: CfnReference,
  value: IResolvable
) {
  const paramId = generateUniqueId(nested, reference, "reference-to-");
  let param = nested.node.tryFindChild(paramId) as CfnParameter;
  if (!param) {
    param = new CfnParameter(nested, paramId, { type: "String" });

    // Ugly little hack until we move NestedStack to this module.
    if (!("setParameter" in nested)) {
      throw new Error(
        'assertion failed: nested stack should have a "setParameter" method'
      );
    }

    (nested as any).setParameter(param.logicalId, Token.asString(value));
  }

  return param.value as CfnReference;
}

/**
 * Adds a CloudFormation output to a nested stack and returns an "Fn::GetAtt"
 * intrinsic that can be used to reference this output in the parent stack.
 */
function createNestedStackOutput(
  producer: Stack,
  reference: Reference
): CfnReference {
  const outputId = generateUniqueId(producer, reference);
  let output = producer.node.tryFindChild(outputId) as CfnOutput;
  if (!output) {
    output = new CfnOutput(producer, outputId, {
      value: Token.asString(reference),
    });
  }

  if (!producer.nestedStackResource) {
    throw new Error("assertion failed");
  }

  return producer.nestedStackResource.getAtt(
    `Outputs.${output.logicalId}`
  ) as CfnReference;
}

/**
 * Translate a Reference into a nested stack into a value in the parent stack
 *
 * Will create Outputs along the chain of Nested Stacks, and return the final `{ Fn::GetAtt }`.
 */
export function referenceNestedStackValueInParent(
  reference: Reference,
  targetStack: Stack
) {
  let currentStack = Stack.of(reference.target);
  if (currentStack !== targetStack && !isNested(currentStack, targetStack)) {
    throw new Error(
      `Referenced resource must be in stack '${targetStack.node.path}', got '${reference.target.node.path}'`
    );
  }

  while (currentStack !== targetStack) {
    reference = createNestedStackOutput(Stack.of(reference.target), reference);
    currentStack = Stack.of(reference.target);
  }

  return reference;
}

/**
 * @returns true if this stack is a direct or indirect parent of the nested
 * stack `nested`.
 *
 * If `child` is not a nested stack, always returns `false` because it can't
 * have a parent, dah.
 */
function isNested(nested: Stack, parent: Stack): boolean {
  // if the parent is a direct parent
  if (nested.nestedStackParent === parent) {
    return true;
  }

  // we reached a top-level (non-nested) stack without finding the parent
  if (!nested.nestedStackParent) {
    return false;
  }

  // recurse with the child's direct parent
  return isNested(nested.nestedStackParent, parent);
}

/**
 * Generates a unique id for a `Reference`
 * @param stack A stack used to resolve tokens
 * @param ref The reference
 * @param prefix Optional prefix for the id
 * @returns A unique id
 */
function generateUniqueId(stack: Stack, ref: Reference, prefix = "") {
  // we call "resolve()" to ensure that tokens do not creep in (for example, if the reference display name includes tokens)
  return stack.resolve(
    `${prefix}${Names.nodeUniqueId(ref.target.node)}${ref.displayName}`
  );
}

const CFN_REFERENCE_SYMBOL = Symbol.for("@aws-cdk/core.CfnReference");

/**
 * An enum that allows controlling how will the created reference
 * be rendered in the resulting CloudFormation template.
 */
export enum ReferenceRendering {
  /**
   * Used for rendering a reference inside Fn::Sub expressions,
   * which mean these must resolve to "${Sth}" instead of { Ref: "Sth" }.
   */
  FN_SUB,

  /**
   * Used for rendering Fn::GetAtt with its arguments in string form
   * (as opposed to the more common arguments in array form, which we render by default).
   */
  GET_ATT_STRING,
}

/**
 * A Token that represents a CloudFormation reference to another resource
 *
 * If these references are used in a different stack from where they are
 * defined, appropriate CloudFormation `Export`s and `Fn::ImportValue`s will be
 * synthesized automatically instead of the regular CloudFormation references.
 *
 * Additionally, the dependency between the stacks will be recorded, and the toolkit
 * will make sure to deploy producing stack before the consuming stack.
 *
 * This magic happens in the prepare() phase, where consuming stacks will call
 * `consumeFromStack` on these Tokens and if they happen to be exported by a different
 * Stack, we'll register the dependency.
 */
export class CfnReference extends Reference {
  /**
   * Check whether this is actually a Reference
   */
  public static isCfnReference(x: IResolvable): x is CfnReference {
    return CFN_REFERENCE_SYMBOL in x;
  }

  /**
   * Return the CfnReference for the indicated target
   *
   * Will make sure that multiple invocations for the same target and intrinsic
   * return the same CfnReference. Because CfnReferences accumulate state in
   * the prepare() phase (for the purpose of cross-stack references), it's
   * important that the state isn't lost if it's lazily created, like so:
   *
   *     Lazy.string({ produce: () => new CfnReference(...) })
   *
   */
  public static for(
    target: CfnElement,
    attribute: string,
    refRender?: ReferenceRendering
  ) {
    return CfnReference.singletonReference(target, attribute, refRender, () => {
      const cfnIntrinsic =
        refRender === ReferenceRendering.FN_SUB
          ? "${" +
            target.logicalId +
            (attribute === "Ref" ? "" : `.${attribute}`) +
            "}"
          : attribute === "Ref"
          ? { Ref: target.logicalId }
          : {
              "Fn::GetAtt":
                refRender === ReferenceRendering.GET_ATT_STRING
                  ? `${target.logicalId}.${attribute}`
                  : [target.logicalId, attribute],
            };
      return new CfnReference(cfnIntrinsic, attribute, target);
    });
  }

  /**
   * Return a CfnReference that references a pseudo referencd
   */
  public static forPseudo(pseudoName: string, scope: Construct) {
    return CfnReference.singletonReference(
      scope,
      `Pseudo:${pseudoName}`,
      undefined,
      () => {
        const cfnIntrinsic = { Ref: pseudoName };
        return new CfnReference(cfnIntrinsic, pseudoName, scope);
      }
    );
  }

  /**
   * Static table where we keep singleton CfnReference instances
   */
  private static referenceTable = new Map<
    Construct,
    Map<string, CfnReference>
  >();

  /**
   * Get or create the table.
   * Passing fnSub = true allows cloudformation-include to correctly handle Fn::Sub.
   */
  private static singletonReference(
    target: Construct,
    attribKey: string,
    refRender: ReferenceRendering | undefined,
    fresh: () => CfnReference
  ) {
    let attribs = CfnReference.referenceTable.get(target);
    if (!attribs) {
      attribs = new Map();
      CfnReference.referenceTable.set(target, attribs);
    }
    let cacheKey = attribKey;
    switch (refRender) {
      case ReferenceRendering.FN_SUB:
        cacheKey += "Fn::Sub";
        break;
      case ReferenceRendering.GET_ATT_STRING:
        cacheKey += "Fn::GetAtt::String";
        break;
    }
    let ref = attribs.get(cacheKey);
    if (!ref) {
      ref = fresh();
      attribs.set(cacheKey, ref);
    }
    return ref;
  }

  /**
   * The Tokens that should be returned for each consuming stack (as decided by the producing Stack)
   */
  private readonly replacementTokens: Map<Stack, IResolvable>;
  private readonly targetStack: Stack;

  protected constructor(value: any, displayName: string, target: IConstruct) {
    // prepend scope path to display name
    super(value, target, displayName);

    this.replacementTokens = new Map<Stack, IResolvable>();
    this.targetStack = Stack.of(target);

    Object.defineProperty(this, CFN_REFERENCE_SYMBOL, { value: true });
  }

  public resolve(context: IResolveContext): any {
    // If we have a special token for this consuming stack, resolve that. Otherwise resolve as if
    // we are in the same stack.
    const consumingStack = Stack.of(context.scope);
    const token = this.replacementTokens.get(consumingStack);

    // if (!token && this.isCrossStackReference(consumingStack) && !context.preparing) {
    // eslint-disable-next-line max-len
    //   throw new Error(`Cross-stack reference (${context.scope.node.path} -> ${this.target.node.path}) has not been assigned a value--call prepare() first`);
    // }

    if (token) {
      return token.resolve(context);
    } else {
      return super.resolve(context);
    }
  }

  public hasValueForStack(stack: Stack) {
    if (stack === this.targetStack) {
      return true;
    }

    return this.replacementTokens.has(stack);
  }

  public assignValueForStack(stack: Stack, value: IResolvable) {
    if (stack === this.targetStack) {
      throw new Error("cannot assign a value for the same stack");
    }

    if (this.hasValueForStack(stack)) {
      throw new Error(
        "Cannot assign a reference value twice to the same stack. Use hasValueForStack to check first"
      );
    }

    this.replacementTokens.set(stack, value);
  }
  /**
   * Implementation of toString() that will use the display name
   */
  public toString(): string {
    return Token.asString(this, {
      displayHint: `${this.target.node.id}.${this.displayName}`,
    });
  }
}

const glob = global as any;

const STRING_SYMBOL = Symbol.for("@aws-cdk/core.TokenMap.STRING");
const LIST_SYMBOL = Symbol.for("@aws-cdk/core.TokenMap.LIST");
const NUMBER_SYMBOL = Symbol.for("@aws-cdk/core.TokenMap.NUMBER");

/**
 * Central place where we keep a mapping from Tokens to their String representation
 *
 * The string representation is used to embed token into strings,
 * and stored to be able to reverse that mapping.
 *
 * All instances of TokenStringMap share the same storage, so that this process
 * works even when different copies of the library are loaded.
 */
export class TokenMap {
  /**
   * Singleton instance of the token string map
   */
  public static instance(): TokenMap {
    if (!glob.__cdkTokenMap) {
      glob.__cdkTokenMap = new TokenMap();
    }
    return glob.__cdkTokenMap;
  }

  private readonly stringTokenMap = new Map<string, IResolvable>();
  private readonly numberTokenMap = new Map<number, IResolvable>();

  /**
   * Counter to assign unique IDs to tokens
   *
   * Start at a random number to prevent people from accidentally taking
   * dependencies on token values between runs.
   *
   * This is most prominent in tests, where people will write:
   *
   * ```ts
   * sha256(JSON.stringify({ ...some structure that can contain tokens ... }))
   * ```
   *
   * This should have been:
   *
   * ```ts
   * sha256(JSON.stringify(stack.resolve({ ...some structure that can contain tokens ... })))
   * ```
   *
   * The hash value is hard to inspect for correctness. It will LOOK consistent
   * during testing, but will break as soon as someone stringifies another
   * token before the run.
   *
   * By changing the starting number for tokens, we ensure that the hash is almost
   * guaranteed to be different during a few test runs, so the hashing of unresolved
   * tokens can be detected.
   */
  private tokenCounter = Math.floor(Math.random() * 10);

  /**
   * Generate a unique string for this Token, returning a key
   *
   * Every call for the same Token will produce a new unique string, no
   * attempt is made to deduplicate. Token objects should cache the
   * value themselves, if required.
   *
   * The token can choose (part of) its own representation string with a
   * hint. This may be used to produce aesthetically pleasing and
   * recognizable token representations for humans.
   */
  public registerString(token: IResolvable, displayHint?: string): string {
    return cachedValue(token, STRING_SYMBOL, () => {
      const key = this.registerStringKey(token, displayHint);
      return `${BEGIN_STRING_TOKEN_MARKER}${key}${END_TOKEN_MARKER}`;
    });
  }

  /**
   * Generate a unique string for this Token, returning a key
   */
  public registerList(token: IResolvable, displayHint?: string): string[] {
    return cachedValue(token, LIST_SYMBOL, () => {
      const key = this.registerStringKey(token, displayHint);
      return [`${BEGIN_LIST_TOKEN_MARKER}${key}${END_TOKEN_MARKER}`];
    });
  }

  /**
   * Create a unique number representation for this Token and return it
   */
  public registerNumber(token: IResolvable): number {
    return cachedValue(token, NUMBER_SYMBOL, () => {
      return this.registerNumberKey(token);
    });
  }

  /**
   * Lookup a token from an encoded value
   */
  public tokenFromEncoding(x: any): IResolvable | undefined {
    if (isResolvableObject(x)) {
      return x;
    }
    if (typeof x === "string") {
      return this.lookupString(x);
    }
    if (Array.isArray(x)) {
      return this.lookupList(x);
    }
    if (Token.isUnresolved(x)) {
      return x;
    }
    return undefined;
  }

  /**
   * Reverse a string representation into a Token object
   */
  public lookupString(s: string): IResolvable | undefined {
    const fragments = this.splitString(s);
    if (fragments.tokens.length > 0 && fragments.length === 1) {
      return fragments.firstToken;
    }
    return undefined;
  }

  /**
   * Reverse a string representation into a Token object
   */
  public lookupList(xs: string[]): IResolvable | undefined {
    if (xs.length !== 1) {
      return undefined;
    }
    const str = TokenString.forListToken(xs[0]);
    const fragments = str.split(this.lookupToken.bind(this));
    if (fragments.length === 1) {
      return fragments.firstToken;
    }
    return undefined;
  }

  /**
   * Split a string into literals and Tokens
   */
  public splitString(s: string): TokenizedStringFragments {
    const str = TokenString.forString(s);
    return str.split(this.lookupToken.bind(this));
  }

  /**
   * Reverse a number encoding into a Token, or undefined if the number wasn't a Token
   */
  public lookupNumberToken(x: number): IResolvable | undefined {
    const tokenIndex = extractTokenDouble(x);
    if (tokenIndex === undefined) {
      return undefined;
    }
    const t = this.numberTokenMap.get(tokenIndex);
    if (t === undefined) {
      throw new Error("Encoded representation of unknown number Token found");
    }
    return t;
  }

  /**
   * Find a Token by key.
   *
   * This excludes the token markers.
   */
  public lookupToken(key: string): IResolvable {
    const token = this.stringTokenMap.get(key);
    if (!token) {
      throw new Error(`Unrecognized token key: ${key}`);
    }
    return token;
  }

  private registerStringKey(token: IResolvable, displayHint?: string): string {
    const counter = this.tokenCounter++;
    const representation = (displayHint || "TOKEN").replace(
      new RegExp(`[^${VALID_KEY_CHARS}]`, "g"),
      "."
    );
    const key = `${representation}.${counter}`;
    this.stringTokenMap.set(key, token);
    return key;
  }

  private registerNumberKey(token: IResolvable): number {
    const counter = this.tokenCounter++;
    const dbl = createTokenDouble(counter);
    // Register in the number map, as well as a string representation of that token
    // in the string map.
    this.numberTokenMap.set(counter, token);
    this.stringTokenMap.set(`${dbl}`, token);
    return dbl;
  }
}

// This file should not be exported to consumers, resolving should happen through Construct.resolve()
const tokenMap = TokenMap.instance();

/**
 * Resolved complex values will have a type hint applied.
 *
 * The type hint will be based on the type of the input value that was resolved.
 *
 * If the value was encoded, the type hint will be the type of the encoded value. In case
 * of a plain `IResolvable`, a type hint of 'string' will be assumed.
 */
const RESOLUTION_TYPEHINT_SYM = Symbol.for("@aws-cdk/core.resolvedTypeHint");

/**
 * Prefix used for intrinsic keys
 *
 * If a key with this prefix is found in an object, the actual value of the
 * key doesn't matter. The value of this key will be an `[ actualKey, actualValue ]`
 * tuple, and the `actualKey` will be a value which otherwise couldn't be represented
 * in the types of `string | number | symbol`, which are the only possible JavaScript
 * object keys.
 */
export const INTRINSIC_KEY_PREFIX = "$IntrinsicKey$";

/**
 * Type hints for resolved values
 */
export enum ResolutionTypeHint {
  STRING = "string",
  NUMBER = "number",
  LIST = "list",
}

/**
 * Options to the resolve() operation
 *
 * NOT the same as the ResolveContext; ResolveContext is exposed to Token
 * implementors and resolution hooks, whereas this struct is just to bundle
 * a number of things that would otherwise be arguments to resolve() in a
 * readable way.
 */
export interface IResolveOptions {
  scope: IConstruct;
  preparing: boolean;
  resolver: ITokenResolver;
  prefix?: string[];

  /**
   * Whether or not to allow intrinsics in keys of an object
   *
   * Because keys of an object must be strings, a (resolved) intrinsic, which
   * is an object, cannot be stored in that position. By default, we reject these
   * intrinsics if we encounter them.
   *
   * If this is set to `true`, in order to store the complex value in a map,
   * keys that happen to evaluate to intrinsics will be added with a unique key
   * identified by an uncomming prefix, mapped to a tuple that represents the
   * actual key/value-pair. The map will look like this:
   *
   * {
   *    '$IntrinsicKey$0': [ { Ref: ... }, 'value1' ],
   *    '$IntrinsicKey$1': [ { Ref: ... }, 'value2' ],
   *    'regularKey': 'value3',
   *    ...
   * }
   *
   * Callers should only set this option to `true` if they are prepared to deal with
   * the object in this weird shape, and massage it back into a correct object afterwards.
   *
   * (A regular but uncommon string was chosen over something like symbols or
   * other ways of tagging the extra values in order to simplify the implementation which
   * maintains the desired behavior `resolve(resolve(x)) == resolve(x)`).
   *
   * @default false
   */
  allowIntrinsicKeys?: boolean;

  /**
   * Whether to remove undefined elements from arrays and objects when resolving.
   *
   * @default true
   */
  removeEmpty?: boolean;
}

/**
 * Resolves an object by evaluating all tokens and removing any undefined or empty objects or arrays.
 * Values can only be primitives, arrays or tokens. Other objects (i.e. with methods) will be rejected.
 *
 * @param obj The object to resolve.
 * @param prefix Prefix key path components for diagnostics.
 */
export function resolve(obj: any, options: IResolveOptions): any {
  const prefix = options.prefix || [];
  const pathName = "/" + prefix.join("/");

  /**
   * Make a new resolution context
   */
  function makeContext(appendPath?: string): [IResolveContext, IPostProcessor] {
    const newPrefix =
      appendPath !== undefined ? prefix.concat([appendPath]) : options.prefix;

    let postProcessor: IPostProcessor | undefined;

    const context: IResolveContext = {
      preparing: options.preparing,
      scope: options.scope as IConstruct,
      // @ts-ignore
      documentPath: newPrefix ?? [],
      registerPostProcessor(pp) {
        postProcessor = pp;
      },
      resolve(x: any, changeOptions?: ResolveChangeContextOptions) {
        return resolve(x, { ...options, ...changeOptions, prefix: newPrefix });
      },
    };

    return [
      context,
      {
        postProcess(x) {
          return postProcessor ? postProcessor.postProcess(x, context) : x;
        },
      },
    ];
  }

  // protect against cyclic references by limiting depth.
  if (prefix.length > 200) {
    throw new Error(
      "Unable to resolve object tree with circular reference. Path: " + pathName
    );
  }

  // whether to leave the empty elements when resolving - false by default
  const leaveEmpty = options.removeEmpty === false;

  //
  // undefined
  //

  if (typeof obj === "undefined") {
    return undefined;
  }

  //
  // null
  //

  if (obj === null) {
    return null;
  }

  //
  // functions - not supported (only tokens are supported)
  //

  if (typeof obj === "function") {
    throw new Error(
      `Trying to resolve a non-data object. Only token are supported for lazy evaluation. Path: ${pathName}. Object: ${obj}`
    );
  }

  //
  // string - potentially replace all stringified Tokens
  //
  if (typeof obj === "string") {
    // If this is a "list element" Token, it should never occur by itself in string context
    if (TokenString.forListToken(obj).test()) {
      throw new Error(
        "Found an encoded list token string in a scalar string context. Use 'Fn.select(0, list)' (not 'list[0]') to extract elements from token lists."
      );
    }

    // Otherwise look for a stringified Token in this object
    const str = TokenString.forString(obj);
    if (str.test()) {
      const fragments = str.split(tokenMap.lookupToken.bind(tokenMap));
      return tagResolvedValue(
        options.resolver.resolveString(fragments, makeContext()[0]),
        ResolutionTypeHint.STRING
      );
    }
    return obj;
  }

  //
  // number - potentially decode Tokenized number
  //
  if (typeof obj === "number") {
    return tagResolvedValue(
      resolveNumberToken(obj, makeContext()[0]),
      ResolutionTypeHint.NUMBER
    );
  }

  //
  // primitives - as-is
  //

  if (typeof obj !== "object" || obj instanceof Date) {
    return obj;
  }

  //
  // arrays - resolve all values, remove undefined and remove empty arrays
  //

  if (Array.isArray(obj)) {
    if (containsListTokenElement(obj)) {
      return tagResolvedValue(
        options.resolver.resolveList(obj, makeContext()[0]),
        ResolutionTypeHint.LIST
      );
    }

    const arr = obj
      .map((x, i) => makeContext(`${i}`)[0].resolve(x))
      .filter((x) => leaveEmpty || typeof x !== "undefined");

    return arr;
  }

  //
  // tokens - invoke 'resolve' and continue to resolve recursively
  //

  if (unresolved(obj)) {
    const [context, postProcessor] = makeContext();
    const ret = tagResolvedValue(
      options.resolver.resolveToken(obj, context, postProcessor),
      ResolutionTypeHint.STRING
    );
    return ret;
  }

  //
  // objects - deep-resolve all values
  //

  // Must not be a Construct at this point, otherwise you probably made a typo
  // mistake somewhere and resolve will get into an infinite loop recursing into
  // child.parent <---> parent.children
  if (isConstruct(obj)) {
    throw new Error("Trying to resolve() a Construct at " + pathName);
  }

  const result: any = {};
  let intrinsicKeyCtr = 0;
  for (const key of Object.keys(obj)) {
    const value = makeContext(String(key))[0].resolve(obj[key]);

    // skip undefined
    if (typeof value === "undefined") {
      if (leaveEmpty) {
        result[key] = undefined;
      }
      continue;
    }

    // Simple case -- not an unresolved key
    if (!unresolved(key)) {
      result[key] = value;
      continue;
    }

    const resolvedKey = makeContext()[0].resolve(key);
    if (typeof resolvedKey === "string") {
      result[resolvedKey] = value;
    } else {
      if (!options.allowIntrinsicKeys) {
        // eslint-disable-next-line max-len
        throw new Error(
          `"${String(
            key
          )}" is used as the key in a map so must resolve to a string, but it resolves to: ${JSON.stringify(
            resolvedKey
          )}. Consider using "CfnJson" to delay resolution to deployment-time`
        );
      }

      // Can't represent this object in a JavaScript key position, but we can store it
      // in value position. Use a unique symbol as the key.
      result[`${INTRINSIC_KEY_PREFIX}${intrinsicKeyCtr++}`] = [
        resolvedKey,
        value,
      ];
    }
  }

  // Because we may be called to recurse on already resolved values (that already have type hints applied)
  // and we just copied those values into a fresh object, be sure to retain any type hints.
  const previousTypeHint = resolvedTypeHint(obj);
  return previousTypeHint ? tagResolvedValue(result, previousTypeHint) : result;
}

/**
 * Find all Tokens that are used in the given structure
 */
export function findTokens(scope: IConstruct, fn: () => any): IResolvable[] {
  const resolver = new RememberingTokenResolver(new StringConcat());

  resolve(fn(), { scope, prefix: [], resolver, preparing: true });

  return resolver.tokens;
}

/**
 * Remember all Tokens encountered while resolving
 */
export class RememberingTokenResolver extends DefaultTokenResolver {
  private readonly tokensSeen = new Set<IResolvable>();

  public resolveToken(
    t: IResolvable,
    context: IResolveContext,
    postProcessor: IPostProcessor
  ) {
    this.tokensSeen.add(t);
    return super.resolveToken(t, context, postProcessor);
  }

  public resolveString(s: TokenizedStringFragments, context: IResolveContext) {
    const ret = super.resolveString(s, context);
    return ret;
  }

  public get tokens(): IResolvable[] {
    return Array.from(this.tokensSeen);
  }
}

/**
 * Determine whether an object is a Construct
 *
 * Not in 'construct.ts' because that would lead to a dependency cycle via 'uniqueid.ts',
 * and this is a best-effort protection against a common programming mistake anyway.
 */
function isConstruct(x: any): boolean {
  return x._children !== undefined && x._metadata !== undefined;
}

function resolveNumberToken(x: number, context: IResolveContext): any {
  const token = TokenMap.instance().lookupNumberToken(x);
  if (token === undefined) {
    return x;
  }
  return context.resolve(token);
}

/**
 * Apply a type hint to a resolved value
 *
 * The type hint will only be applied to objects.
 *
 * These type hints are used for correct JSON-ification of intrinsic values.
 */
function tagResolvedValue(value: any, typeHint: ResolutionTypeHint): any {
  if (typeof value !== "object" || value == null) {
    return value;
  }
  Object.defineProperty(value, RESOLUTION_TYPEHINT_SYM, {
    value: typeHint,
    configurable: true,
  });
  return value;
}

/**
 * Return the type hint from the given value
 *
 * If the value is not a resolved value (i.e, the result of resolving a token),
 * `undefined` will be returned.
 *
 * These type hints are used for correct JSON-ification of intrinsic values.
 */
export function resolvedTypeHint(value: any): ResolutionTypeHint | undefined {
  if (typeof value !== "object" || value == null) {
    return undefined;
  }
  return value[RESOLUTION_TYPEHINT_SYM];
}

/**
 * Get a cached value for an object, storing it on the object in a symbol
 */
function cachedValue<A extends object, B>(x: A, sym: symbol, prod: () => B) {
  let cached = (x as any)[sym as any];
  if (cached === undefined) {
    cached = prod();
    Object.defineProperty(x, sym, { value: cached });
  }
  return cached;
}

export const BEGIN_STRING_TOKEN_MARKER = "${Token[";
export const BEGIN_LIST_TOKEN_MARKER = "#{Token[";
export const END_TOKEN_MARKER = "]}";

export const VALID_KEY_CHARS = "a-zA-Z0-9:._-";

const QUOTED_BEGIN_STRING_TOKEN_MARKER = regexQuote(BEGIN_STRING_TOKEN_MARKER);
const QUOTED_BEGIN_LIST_TOKEN_MARKER = regexQuote(BEGIN_LIST_TOKEN_MARKER);
const QUOTED_END_TOKEN_MARKER = regexQuote(END_TOKEN_MARKER);

// Sometimes the number of digits is different
export const STRINGIFIED_NUMBER_PATTERN = "-1\\.\\d{10,16}e\\+289";

const STRING_TOKEN_REGEX = new RegExp(
  `${QUOTED_BEGIN_STRING_TOKEN_MARKER}([${VALID_KEY_CHARS}]+)${QUOTED_END_TOKEN_MARKER}|(${STRINGIFIED_NUMBER_PATTERN})`,
  "g"
);
const LIST_TOKEN_REGEX = new RegExp(
  `${QUOTED_BEGIN_LIST_TOKEN_MARKER}([${VALID_KEY_CHARS}]+)${QUOTED_END_TOKEN_MARKER}`,
  "g"
);

/**
 * A string with markers in it that can be resolved to external values
 */
export class TokenString {
  /**
   * Returns a `TokenString` for this string.
   */
  public static forString(s: string) {
    return new TokenString(s, STRING_TOKEN_REGEX);
  }

  /**
   * Returns a `TokenString` for this string (must be the first string element of the list)
   */
  public static forListToken(s: string) {
    return new TokenString(s, LIST_TOKEN_REGEX);
  }

  constructor(private readonly str: string, private readonly re: RegExp) {}

  /**
   * Split string on markers, substituting markers with Tokens
   */
  public split(lookup: (id: string) => IResolvable): TokenizedStringFragments {
    const ret = new TokenizedStringFragments();

    let rest = 0;
    this.re.lastIndex = 0; // Reset
    let m = this.re.exec(this.str);
    while (m) {
      if (m.index > rest) {
        ret.addLiteral(this.str.substring(rest, m.index));
      }

      ret.addToken(lookup(m[1] ?? m[2]));

      rest = this.re.lastIndex;
      m = this.re.exec(this.str);
    }

    if (rest < this.str.length) {
      ret.addLiteral(this.str.substring(rest));
    }

    return ret;
  }

  /**
   * Indicates if this string includes tokens.
   */
  public test(): boolean {
    this.re.lastIndex = 0; // Reset
    return this.re.test(this.str);
  }
}

/**
 * Quote a string for use in a regex
 */
export function regexQuote(s: string) {
  return s.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
}

/**
 * Concatenator that disregards the input
 *
 * Can be used when traversing the tokens is important, but the
 * result isn't.
 */
export class NullConcat implements IFragmentConcatenator {
  public join(_left: any | undefined, _right: any | undefined): any {
    return undefined;
  }
}

export function containsListTokenElement(xs: any[]) {
  return xs.some(
    (x) => typeof x === "string" && TokenString.forListToken(x).test()
  );
}

/**
 * Returns true if obj is a token (i.e. has the resolve() method or is a string
 * that includes token markers), or it's a listifictaion of a Token string.
 *
 * @param obj The object to test.
 */
export function unresolved(obj: any): boolean {
  if (typeof obj === "string") {
    return TokenString.forString(obj).test();
  } else if (typeof obj === "number") {
    return extractTokenDouble(obj) !== undefined;
  } else if (Array.isArray(obj) && obj.length === 1) {
    return (
      typeof obj[0] === "string" && TokenString.forListToken(obj[0]).test()
    );
  } else {
    return isResolvableObject(obj);
  }
}

/**
 * Bit pattern in the top 16 bits of a double to indicate a Token
 *
 * An IEEE double in LE memory order looks like this (grouped
 * into octets, then grouped into 32-bit words):
 *
 * mmmmmmmm.mmmmmmmm.mmmmmmmm.mmmmmmmm | mmmmmmmm.mmmmmmmm.EEEEmmmm.sEEEEEEE
 *
 * - m: mantissa (52 bits)
 * - E: exponent (11 bits)
 * - s: sign (1 bit)
 *
 * We put the following marker into the top 16 bits (exponent and sign), and
 * use the mantissa part to encode the token index. To save some bit twiddling
 * we use all top 16 bits for the tag. That loses us 4 mantissa bits to store
 * information in but we still have 48, which is going to be plenty for any
 * number of tokens to be created during the lifetime of any CDK application.
 *
 * Can't have all bits set because that makes a NaN, so unset the least
 * significant exponent bit.
 *
 * Currently not supporting BE architectures.
 */
// eslint-disable-next-line no-bitwise
const DOUBLE_TOKEN_MARKER_BITS = 0xfbff << 16;

/**
 * Highest encodable number
 */
const MAX_ENCODABLE_INTEGER = Math.pow(2, 48) - 1;

/**
 * Get 2^32 as a number, so we can do multiplication and div instead of bit shifting
 *
 * Necessary because in JavaScript, bit operations implicitly convert
 * to int32 and we need them to work on "int64"s.
 *
 * So instead of x >> 32, we do Math.floor(x / 2^32), and vice versa.
 */
const BITS32 = Math.pow(2, 32);

/**
 * Return a special Double value that encodes the given nonnegative integer
 *
 * We use this to encode Token ordinals.
 */
export function createTokenDouble(x: number) {
  if (Math.floor(x) !== x || x < 0) {
    throw new Error("Can only encode positive integers");
  }
  if (x > MAX_ENCODABLE_INTEGER) {
    throw new Error(`Got an index too large to encode: ${x}`);
  }

  const buf = new ArrayBuffer(8);
  const ints = new Uint32Array(buf);

  /* eslint-disable no-bitwise */
  ints[0] = x & 0x0000ffffffff; // Bottom 32 bits of number

  // This needs an "x >> 32" but that will make it a 32-bit number instead
  // of a 64-bit number.
  ints[1] = (shr32(x) & 0xffff) | DOUBLE_TOKEN_MARKER_BITS; // Top 16 bits of number and the mask
  /* eslint-enable no-bitwise */

  return new Float64Array(buf)[0];
}

/**
 * Shift a 64-bit int right 32 bits
 */
function shr32(x: number) {
  return Math.floor(x / BITS32);
}

/**
 * Shift a 64-bit left 32 bits
 */
function shl32(x: number) {
  return x * BITS32;
}

/**
 * Extract the encoded integer out of the special Double value
 *
 * Returns undefined if the float is a not an encoded token.
 */
export function extractTokenDouble(encoded: number): number | undefined {
  const buf = new ArrayBuffer(8);
  new Float64Array(buf)[0] = encoded;

  const ints = new Uint32Array(buf);

  /* eslint-disable no-bitwise */
  if ((ints[1] & 0xffff0000) !== DOUBLE_TOKEN_MARKER_BITS) {
    return undefined;
  }

  // Must use + instead of | here (bitwise operations
  // will force 32-bits integer arithmetic, + will not).
  return ints[0] + shl32(ints[1] & 0xffff);
  /* eslint-enable no-bitwise */
}

const STRINGIFIED_NUMBER_REGEX = new RegExp(STRINGIFIED_NUMBER_PATTERN);

/**
 * Return whether the given string contains accidentally stringified number tokens
 */
export function stringContainsNumberTokens(x: string) {
  return !!x.match(STRINGIFIED_NUMBER_REGEX);
}

/**
 * Construct that will render the metadata resource
 */
export class MetadataResource extends Construct {
  constructor(scope: Stack, id: string) {
    super(scope, id);

    const metadataServiceExists =
      Token.isUnresolved(scope.region) ||
      RegionInfo.get(scope.region).cdkMetadataResourceAvailable;
    if (metadataServiceExists) {
      const resource = new CfnResource(this, "Default", {
        type: "AWS::CDK::Metadata",
        properties: {
          Analytics: Lazy.string({
            produce: () => formatAnalytics(constructInfoFromStack(scope)),
          }),
        },
      });

      // In case we don't actually know the region, add a condition to determine it at deploy time
      if (Token.isUnresolved(scope.region)) {
        const condition = new CfnCondition(this, "Condition", {
          expression: makeCdkMetadataAvailableCondition(),
        });

        // To not cause undue template changes
        condition.overrideLogicalId("CDKMetadataAvailable");

        resource.cfnOptions.condition = condition;
      }
    }
  }
}

function makeCdkMetadataAvailableCondition() {
  return Fn.conditionOr(
    ...RegionInfo.regions
      .filter((ri) => ri.cdkMetadataResourceAvailable)
      .map((ri) => Fn.conditionEquals(Aws.REGION, ri.name))
  );
}

/** Convenience type for arbitrarily-nested map */
class Trie extends Map<string, Trie> {}

/**
 * Formats a list of construct fully-qualified names (FQNs) and versions into a (possibly compressed) prefix-encoded string.
 *
 * The list of ConstructInfos is logically formatted into:
 * ${version}!${fqn} (e.g., "1.90.0!aws-cdk-lib.Stack")
 * and then all of the construct-versions are grouped with common prefixes together, grouping common parts in '{}' and separating items with ','.
 *
 * Example:
 * [1.90.0!aws-cdk-lib.Stack, 1.90.0!aws-cdk-lib.Construct, 1.90.0!aws-cdk-lib.service.Resource, 0.42.1!aws-cdk-lib-experiments.NewStuff]
 * Becomes:
 * 1.90.0!aws-cdk-lib.{Stack,Construct,service.Resource},0.42.1!aws-cdk-lib-experiments.NewStuff
 *
 * The whole thing is then either included directly as plaintext as:
 * v2:plaintext:{prefixEncodedList}
 * Or is compressed and base64-encoded, and then formatted as:
 * v2:deflate64:{prefixEncodedListCompressedAndEncoded}
 *
 * Exported/visible for ease of testing.
 */
export function formatAnalytics(infos: ConstructInfo[]) {
  const trie = new Trie();
  infos.forEach((info) => insertFqnInTrie(`${info.version}!${info.fqn}`, trie));

  const plaintextEncodedConstructs = prefixEncodeTrie(trie);
  const compressedConstructsBuffer = zlib.gzipSync(
    Buffer.from(plaintextEncodedConstructs)
  );

  // set OS flag to "unknown" in order to ensure we get consistent results across operating systems
  // see https://github.com/aws/aws-cdk/issues/15322
  setGzipOperatingSystemToUnknown(compressedConstructsBuffer);

  const compressedConstructs = compressedConstructsBuffer.toString("base64");
  return `v2:deflate64:${compressedConstructs}`;
}

/**
 * Splits after non-alphanumeric characters (e.g., '.', '/') in the FQN
 * and insert each piece of the FQN in nested map (i.e., simple trie).
 */
function insertFqnInTrie(fqn: string, trie: Trie) {
  for (const fqnPart of fqn.replace(/[^a-z0-9]/gi, "$& ").split(" ")) {
    const nextLevelTreeRef = trie.get(fqnPart) ?? new Trie();
    trie.set(fqnPart, nextLevelTreeRef);
    trie = nextLevelTreeRef;
  }
  return trie;
}

/**
 * Prefix-encodes a "trie-ish" structure, using '{}' to group and ',' to separate siblings.
 *
 * Example input:
 * ABC,ABD,AEF
 *
 * Example trie:
 * A --> B --> C
 *  |     \--> D
 *  \--> E --> F
 *
 * Becomes:
 * A{B{C,D},EF}
 */
function prefixEncodeTrie(trie: Trie) {
  let prefixEncoded = "";
  let isFirstEntryAtLevel = true;
  [...trie.entries()].forEach(([key, value]) => {
    if (!isFirstEntryAtLevel) {
      prefixEncoded += ",";
    }
    isFirstEntryAtLevel = false;
    prefixEncoded += key;
    if (value.size > 1) {
      prefixEncoded += "{";
      prefixEncoded += prefixEncodeTrie(value);
      prefixEncoded += "}";
    } else {
      prefixEncoded += prefixEncodeTrie(value);
    }
  });
  return prefixEncoded;
}

/**
 * Sets the OS flag to "unknown" in order to ensure we get consistent results across operating systems.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc1952#page-5
 *
 *   +---+---+---+---+---+---+---+---+---+---+
 *   |ID1|ID2|CM |FLG|     MTIME     |XFL|OS |
 *   +---+---+---+---+---+---+---+---+---+---+
 *   | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
 *   +---+---+---+---+---+---+---+---+---+---+
 *
 * OS (Operating System)
 * =====================
 * This identifies the type of file system on which compression
 * took place.  This may be useful in determining end-of-line
 * convention for text files.  The currently defined values are
 * as follows:
 *      0 - FAT filesystem (MS-DOS, OS/2, NT/Win32)
 *      1 - Amiga
 *      2 - VMS (or OpenVMS)
 *      3 - Unix
 *      4 - VM/CMS
 *      5 - Atari TOS
 *      6 - HPFS filesystem (OS/2, NT)
 *      7 - Macintosh
 *      8 - Z-System
 *      9 - CP/M
 *     10 - TOPS-20
 *     11 - NTFS filesystem (NT)
 *     12 - QDOS
 *     13 - Acorn RISCOS
 *    255 - unknown
 *
 * @param gzipBuffer A gzip buffer
 */
function setGzipOperatingSystemToUnknown(gzipBuffer: Buffer) {
  // check that this is indeed a gzip buffer (https://datatracker.ietf.org/doc/html/rfc1952#page-6)
  if (gzipBuffer[0] !== 0x1f || gzipBuffer[1] !== 0x8b) {
    throw new Error("Expecting a gzip buffer (must start with 0x1f8b)");
  }

  gzipBuffer[9] = 255;
}

const ALLOWED_FQN_PREFIXES = [
  // SCOPES
  "@aws-cdk/",
  "@aws-cdk-containers/",
  "@aws-solutions-konstruk/",
  "@aws-solutions-constructs/",
  "@amzn/",
  // PACKAGES
  "aws-rfdk.",
  "aws-cdk-lib.",
  "monocdk.",
];

/**
 * Symbol for accessing jsii runtime information
 *
 * Introduced in jsii 1.19.0, cdk 1.90.0.
 */
const JSII_RUNTIME_SYMBOL = Symbol.for("jsii.rtti");

/**
 * Source information on a construct (class fqn and version)
 */
export interface ConstructInfo {
  readonly fqn: string;
  readonly version: string;
}

export function constructInfoFromConstruct(
  construct: IConstruct
): ConstructInfo | undefined {
  const jsiiRuntimeInfo =
    Object.getPrototypeOf(construct).constructor[JSII_RUNTIME_SYMBOL];
  if (
    typeof jsiiRuntimeInfo === "object" &&
    jsiiRuntimeInfo !== null &&
    typeof jsiiRuntimeInfo.fqn === "string" &&
    typeof jsiiRuntimeInfo.version === "string"
  ) {
    return { fqn: jsiiRuntimeInfo.fqn, version: jsiiRuntimeInfo.version };
  } else if (jsiiRuntimeInfo) {
    // There is something defined, but doesn't match our expectations. Fail fast and hard.
    throw new Error(
      `malformed jsii runtime info for construct: '${construct.node.path}'`
    );
  }
  return undefined;
}

/**
 * For a given stack, walks the tree and finds the runtime info for all constructs within the tree.
 * Returns the unique list of construct info present in the stack,
 * as long as the construct fully-qualified names match the defined allow list.
 */
export function constructInfoFromStack(stack: Stack): ConstructInfo[] {
  const isDefined = (
    value: ConstructInfo | undefined
  ): value is ConstructInfo => value !== undefined;

  const allConstructInfos = constructsInStack(stack)
    .map((construct) => constructInfoFromConstruct(construct))
    .filter(isDefined)
    .filter((info) =>
      ALLOWED_FQN_PREFIXES.find((prefix) => info.fqn.startsWith(prefix))
    );

  // Adds the jsii runtime as a psuedo construct for reporting purposes.
  allConstructInfos.push({
    fqn: "jsii-runtime.Runtime",
    version: getJsiiAgentVersion(),
  });

  // Filter out duplicate values
  const uniqKeys = new Set();
  return allConstructInfos.filter((construct) => {
    const constructKey = `${construct.fqn}@${construct.version}`;
    const isDuplicate = uniqKeys.has(constructKey);
    uniqKeys.add(constructKey);
    return !isDuplicate;
  });
}

/**
 * Returns all constructs under the parent construct (including the parent),
 * stopping when it reaches a boundary of another stack (e.g., Stack, Stage, NestedStack).
 */
function constructsInStack(construct: IConstruct): IConstruct[] {
  const constructs = [construct];
  construct.node.children
    .filter((child) => !Stage.isStage(child) && !Stack.isStack(child))
    .forEach((child) => constructs.push(...constructsInStack(child)));
  return constructs;
}

function getJsiiAgentVersion() {
  let jsiiAgent = process.env.JSII_AGENT;

  // if JSII_AGENT is not specified, we will assume this is a node.js runtime
  // and plug in our node.js version
  if (!jsiiAgent) {
    jsiiAgent = `node.js/${process.version}`;
  }

  // Sanitize the agent to remove characters which might mess with the downstream
  // prefix encoding & decoding. In particular the .NET jsii agent takes a form like:
  // DotNet/5.0.3/.NETCoreApp,Version=v3.1/1.0.0.0
  // The `,` in the above messes with the prefix decoding when reporting the analytics.
  jsiiAgent = jsiiAgent.replace(/[^a-z0-9.-/=_]/gi, "-");

  return jsiiAgent;
}

const FILE_PATH = "tree.json";

/**
 * Construct that is automatically attached to the top-level `App`.
 * This generates, as part of synthesis, a file containing the construct tree and the metadata for each node in the tree.
 * The output is in a tree format so as to preserve the construct hierarchy.
 *
 */
export class TreeMetadata extends Construct {
  constructor(scope: Construct) {
    super(scope, "Tree");
  }

  /**
   * Create tree.json
   * @internal
   */
  public _synthesizeTree(session: ISynthesisSession) {
    const lookup: { [path: string]: Node } = {};

    const visit = (construct: IConstruct): Node => {
      const children = construct.node.children.map((c) => {
        try {
          return visit(c);
        } catch (e) {
          Annotations.of(this).addWarning(
            `Failed to render tree metadata for node [${c.node.id}]. Reason: ${e}`
          );
          return undefined;
        }
      });
      const childrenMap = children
        .filter((child) => child !== undefined)
        .reduce((map, child) => Object.assign(map, { [child!.id]: child }), {});

      const node: Node = {
        id: construct.node.id || "App",
        path: construct.node.path,
        children:
          Object.keys(childrenMap).length === 0 ? undefined : childrenMap,
        attributes: this.synthAttributes(construct),
        constructInfo: constructInfoFromConstruct(construct),
      };

      lookup[node.path] = node;

      return node;
    };

    const tree = {
      version: "tree-0.1",
      tree: visit(this.node.root),
    };

    const builder = session.assembly;
    fs.writeFileSync(
      path.join(builder.outdir, FILE_PATH),
      JSON.stringify(tree, undefined, 2),
      { encoding: "utf-8" }
    );

    builder.addArtifact("Tree", {
      type: ArtifactType.CDK_TREE,
      properties: {
        file: FILE_PATH,
      },
    });
  }

  private synthAttributes(
    construct: IConstruct
  ): { [key: string]: any } | undefined {
    // check if a construct implements IInspectable
    function canInspect(inspectable: any): inspectable is IInspectable {
      return inspectable.inspect !== undefined;
    }

    const inspector = new TreeInspector();

    // get attributes from the inspector
    if (canInspect(construct)) {
      construct.inspect(inspector);
      return Stack.of(construct).resolve(inspector.attributes);
    }
    return undefined;
  }
}

interface Node {
  readonly id: string;
  readonly path: string;
  readonly children?: { [key: string]: Node };
  readonly attributes?: { [key: string]: any };

  /**
   * Information on the construct class that led to this node, if available
   */
  readonly constructInfo?: ConstructInfo;
}
