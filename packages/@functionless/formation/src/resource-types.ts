export interface SQSQueuePolicyResource {
  PolicyDocument: object;
  Queues: string[];
}

export interface BasePolicyResource {
  Groups?: string[];
  PolicyDocument: any;
  Roles?: string[];
  Users?: string[];
}

export interface ManagedPolicyResource extends BasePolicyResource {
  Description?: string;
  ManagedPolicyName?: string;
  Path?: string;
}

export interface PolicyResource extends BasePolicyResource {
  PolicyName: string;
}
