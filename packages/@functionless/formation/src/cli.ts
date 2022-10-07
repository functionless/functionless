import { program } from "commander";
import fs from "fs/promises";
import { displayTopoOrder } from "./display";
import { Stack } from "./stack";
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

    console.log(displayTopoOrder(template, true));
  });

program
  .command("deploy")
  .argument("<template>")
  .option("-a, --asset-file <file>", "assets file")
  .option("-s, --stack-name <stack>", "stack name when not provided")
  .action(async (t, options) => {
    // TODO may not exist
    const templateStr = (await fs.readFile(t)).toString("utf-8");
    const template = JSON.parse(templateStr) as CloudFormationTemplate;

    const caller = await STS.send(new sts.GetCallerIdentityCommand({}));

    if (!options.stackName) {
      throw new Error("stack name must be provided");
    }

    const stack = new Stack({
      account: caller.Account!,
      region: "us-east-1",
      stackName: options.stackName,
      // TODO bootstrap the right creds
    });

    const start = new Date();

    await stack.updateStack(
      template,
      // TODO: support stack parameters
      undefined,
      options.assetFile
    );

    console.log(`Complete: ${new Date().getTime() - start.getTime()}ms`);
  });

program.parse(process.argv);
