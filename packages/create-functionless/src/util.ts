import chalk from "chalk";
import spawn from "cross-spawn";
import prompts from "prompts";
import validateProjectName from "validate-npm-package-name";

export function failOnError(
  response: ReturnType<typeof spawn.sync>,
  message: string
) {
  if (response.status !== 0) {
    console.error(chalk.red(message));
    process.exit(1);
  }
}

export async function askProjectName() {
  const defaultName = "new-project";

  const answer = await prompts({
    type: "text",
    name: "projectName",
    message: "Project name:",
    initial: defaultName,
    validate: (name) => {
      const result = validateProjectName(name);
      if (result.validForNewPackages) {
        return true;
      }
      return `Invalid project name: ${name}`;
    },
  });

  if (typeof answer.projectName === "string") {
    return answer.projectName.trim();
  }

  return defaultName;
}

export type PackageManager = "yarn" | "pnpm" | "npm";

export function getPackageManager(): PackageManager {
  const packageManager = process.env.npm_config_user_agent;

  if (packageManager?.startsWith("yarn")) {
    return "yarn";
  } else if (packageManager?.startsWith("pnpm")) {
    return "pnpm";
  } else {
    return "npm";
  }
}

export function installPackages(
  manager: PackageManager,
  dependencies: string[]
) {
  let executable = "npm";
  let command = "install";

  if (manager === "yarn") {
    executable = "yarn";
    command = "add";
  }

  if (manager == "pnpm") {
    executable = "pnpm";
  }

  failOnError(
    spawn.sync(executable, [command, "-D", ...dependencies], {
      stdio: "inherit",
    }),
    "Unable to install dependencies"
  );
}
