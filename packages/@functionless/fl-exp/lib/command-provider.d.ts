import { StackResourceDetail } from "aws-sdk/clients/cloudformation";
import { Command } from "commander";
interface CommandDefinition<Kind extends string = string> {
    resourceKind: Kind;
    handler: (command: Command, resourceKind: Kind, details: StackResourceDetail) => void;
}
export declare function registerCommand(definition: CommandDefinition): void;
export declare function dispatch(resourceKind: string, resourceDetail: StackResourceDetail): Promise<void>;
export {};
//# sourceMappingURL=command-provider.d.ts.map