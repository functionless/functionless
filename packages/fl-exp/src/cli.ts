// eslint-disable-next-line turbo/no-undeclared-env-vars
process.env.AWS_SDK_LOAD_CONFIG = "1";

import { program } from "commander";
import { loadProject } from "./load-project";

program.command("synth").action(async () => {
  const { cdkSynth } = await import("./commands/cdk-synth");
  return cdkSynth();
});

program.command("ls").action(async () => {
  const project = await loadProject(process.cwd());

  project.resourceFiles.forEach((file) => {
    console.log(file.address);
  });
});

program
  .argument("<resource-path>")
  .action((...args) => {
    console.log(args);
  })
  .action(async (resourcePath, ...args) => {
    const { invoke } = await import("./commands/resource");
    return invoke(resourcePath, args);
  });

program.command("local").action(async () => {
  const { localServer } = await import("./commands/local");
  return localServer();
});

program.parse(process.argv);
