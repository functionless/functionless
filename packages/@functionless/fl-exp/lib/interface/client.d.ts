import type { Credentials, CredentialsOptions } from "aws-sdk/lib/credentials";
export declare function createClientFactory<ClientClass extends new (props: {
    credentials?: Credentials | CredentialsOptions | null;
}) => any>(clss: ClientClass): (roleArn?: string) => Promise<InstanceType<ClientClass>>;
export declare function createLocalClient<ClientClass extends new (props: {
    credentials: Credentials | CredentialsOptions | null;
}) => any>(roleArn: string, clss: ClientClass): Promise<InstanceType<ClientClass>>;
//# sourceMappingURL=client.d.ts.map