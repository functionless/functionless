import { StackResourceDetail } from "aws-sdk/clients/cloudformation";
import { Command } from "commander";

interface CommandDefinition<Kind extends string = string> {
  resourceKind: Kind;
  handler: (
    command: Command,
    resourceKind: Kind,
    details: StackResourceDetail
  ) => void;
}

const registry: {
  [kind in string]: CommandDefinition;
} = {};

export function registerCommand(definition: CommandDefinition) {
  registry[definition.resourceKind] = definition;
}

export async function dispatch(
  resourceKind: string,
  resourceDetail: StackResourceDetail
) {
  const found = registry[resourceKind];
  const command = new Command();

  if (found) {
    found.handler(command, found.resourceKind, resourceDetail);
  }
  command.parse([process.argv[0]!, ...process.argv.slice(2)]);
}
