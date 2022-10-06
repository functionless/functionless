#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import spawn from "cross-spawn";
import fs from "fs";
import mustache from "mustache";
import path from "path";

const packageJson = require("../package.json");
import { loadTemplatePlan } from "./plan";
import {
  askProjectName,
  failOnError,
  getPackageManager,
  installPackages,
} from "./util";

const program = new Command();

let projectName: string | undefined;
let templateName = "default";

program
  .name(packageJson.name)
  .version(packageJson.version)
  .arguments("[projectName]")
  .option(
    "-t --template [templateName]",
    "name of the template to use [default]"
  )
  .action((name, options) => {
    if (typeof name === "string") {
      projectName = name;
    }
    if (typeof options.template === "string") {
      templateName = options.template;
    }
  })
  .parse(process.argv);

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function run() {
  const packageMangager = getPackageManager();

  const templatePlan = await loadTemplatePlan(templateName);

  if (!projectName) {
    projectName = await askProjectName();
  }

  console.log();
  console.log(`Creating ${chalk.green(projectName)}...`);

  const root = path.resolve(projectName);

  try {
    await fs.promises.mkdir(root);
  } catch (err: any) {
    if (err.code === "EEXIST") {
      console.error(`${chalk.red(`Folder already exists: ${projectName}`)}`);
    }
    process.exit(1);
  }

  const renderTemplate = async (
    sourcePath: string,
    localPath: string,
    data: Record<string, unknown>
  ) => {
    const templateContent = mustache.render(
      await fs.promises.readFile(sourcePath, "utf-8"),
      data
    );
    // Npm won't include `.gitignore` files in a package.
    // This allows you to add .template as a file ending
    // and it will be removed when rendered in the end
    // project.
    const destinationPath = path.join(root, localPath.replace(".template", ""));
    await fs.promises.mkdir(path.dirname(destinationPath), {
      recursive: true,
    });
    await fs.promises.writeFile(destinationPath, templateContent);
  };

  const templateData = {
    projectName,
  };

  for (const mapping of templatePlan.fileMappings) {
    // Sequential because order of file rendering matters
    // for templates that extend other templates.
    await renderTemplate(mapping.sourcePath, mapping.localPath, templateData);
  }

  process.chdir(root);

  console.log();
  console.log("Installing packages...");
  console.log();

  installPackages(packageMangager, templatePlan.devDependencies);

  console.log();
  console.log("Initializing git repository...");
  console.log();

  const gitErrorMessage = "Error initializing git repository.";

  failOnError(
    spawn.sync("git", ["init", "-q"], {
      stdio: "inherit",
    }),
    gitErrorMessage
  );

  failOnError(
    spawn.sync("git", ["add", "."], {
      stdio: "inherit",
    }),
    gitErrorMessage
  );

  failOnError(
    spawn.sync("git", ["commit", "-q", "-m", "initial commit"], {
      stdio: "inherit",
    }),
    gitErrorMessage
  );

  console.log(chalk.green("Project ready!"));
  console.log();
  console.log(`Run ${chalk.yellow(`cd ./${projectName}`)} to get started.`);

  process.exit(0);
}
