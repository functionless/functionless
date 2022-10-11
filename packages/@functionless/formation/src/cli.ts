import { program } from "commander";
import fs from "fs/promises";
import {
  displayTopoEntries,
  displayTopoOrder,
  TopoDisplayEntry,
} from "./display";
import { Stack, StackState } from "./stack";
import { CloudFormationTemplate } from "./template";
import * as sts from "@aws-sdk/client-sts";

const STS = new sts.STSClient({});

program
  .command("show")
  .argument("<template>")
  .action(async (t) => {
    // TODO may not exist
    const templateStr = (await fs.readFile(t)).toString("utf-8");
    const template = JSON.parse(templateStr) as CloudFormationTemplate;

    console.log(await displayTopoOrder(template, true));
  });

program
  .command("deploy")
  .argument("<template>")
  .option("-a, --asset-file <file>", "assets file")
  .option("-s, --stack-name <stack>", "stack name when not provided")
  .option(
    "-p, --previous <prev>",
    "location of the previous stack state to load"
  )
  .option("-o, --output-path <out>", "location to save the stack state")
  .action(async (t, options) => {
    // TODO may not exist
    const templateStr = (await fs.readFile(t)).toString("utf-8");
    const template = JSON.parse(templateStr) as CloudFormationTemplate;

    const caller = await STS.send(new sts.GetCallerIdentityCommand({}));

    if (!options.stackName) {
      throw new Error("stack name must be provided");
    }

    let previousState: StackState | undefined;
    if (options.previous) {
      previousState = JSON.parse(
        (await fs.readFile(options.previous)).toString()
      ) as StackState;
    }

    const stack = new Stack({
      account: caller.Account!,
      region: "us-east-1",
      stackName: options.stackName,
      previousState,
      // TODO bootstrap the right creds
    });

    const start = new Date();

    const output = await stack.updateStack(
      template,
      // TODO: support stack parameters
      undefined,
      options.assetFile
    );

    if (options.outputPath) {
      await fs.writeFile(options.outputPath, JSON.stringify(output));
    }

    console.log(`Complete: ${new Date().getTime() - start.getTime()}ms`);
  });

program
  .command("plan")
  .argument("<template>")
  .option("-a, --asset-file <file>", "assets file")
  .option("-s, --stack-name <stack>", "stack name when not provided")
  .option(
    "-p, --previous <prev>",
    "location of the previous stack state to load"
  )
  .action(async (t, options) => {
    // TODO may not exist
    const templateStr = (await fs.readFile(t)).toString("utf-8");
    const template = JSON.parse(templateStr) as CloudFormationTemplate;

    const caller = await STS.send(new sts.GetCallerIdentityCommand({}));

    if (!options.stackName) {
      throw new Error("stack name must be provided");
    }

    let previousState: StackState | undefined;
    if (options.previous) {
      previousState = JSON.parse(
        (await fs.readFile(options.previous)).toString()
      ) as StackState;
    }

    const stack = new Stack({
      account: caller.Account!,
      region: "us-east-1",
      stackName: options.stackName,
      previousState,
      // TODO bootstrap the right creds
    });

    const start = new Date();

    const output = await stack.planUpdateStack(
      template,
      // TODO: support stack parameters
      undefined,
      options.assetFile
    );

    // TODO: pretty print
    console.log(output.assetState);
    console.log(output.conditionValues);

    const skippedResources = Object.entries(output.resourceOperationMap)
      .filter(([, x]) => x === "SKIP_UPDATE")
      .map((s) => s[0]);

    const displayEntry: TopoDisplayEntry[] = [
      // Display is a more compact way
      ...skippedResources?.map((x) => ({
        name: x,
        level: 1,
        additional: "SKIP_UPDATE",
      })),
      ...(output.topoSortedCreateUpdates?.map((x) => ({
        name: x.resourceId,
        level: x.level,
        additional: output.resourceOperationMap[x.resourceId],
      })) ?? []),
      // TODO invert levels
      ...(output.topoSortedDeletes?.map((x) => ({
        name: x.resourceId,
        level: x.level,
        additional: "DELETE",
      })) ?? []),
    ];

    console.log("Plan:");
    console.log(displayTopoEntries(displayEntry, true));

    console.log(`Complete: ${new Date().getTime() - start.getTime()}ms`);
  });

program.parse(process.argv);
