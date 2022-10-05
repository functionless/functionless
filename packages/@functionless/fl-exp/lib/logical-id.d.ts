import CloudFormation from "aws-sdk/clients/cloudformation";
export declare function resolveStackDetail(stackName: string, logicalId: string): Promise<CloudFormation.StackResourceDetail | undefined>;
export declare function logicalIdForPath(idPath: string): string;
//# sourceMappingURL=logical-id.d.ts.map