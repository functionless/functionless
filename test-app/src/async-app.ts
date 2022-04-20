import { ISynthesisSession, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { AsyncApp, SynthesizeAsync } from "functionless";

const app = new AsyncApp();

const stack = new Stack(app, "stack");

export interface AsyncHookProps {
  hook: (session: ISynthesisSession) => Promise<void>; 
}

class AsyncHook extends Construct implements SynthesizeAsync {
  readonly hook: (session: ISynthesisSession) => Promise<void>;
  constructor(scope: Construct, id: string, props: AsyncHookProps) {
    super(scope, id);

    this.hook = props.hook;
  }
  
  public synthesizeAsync(session: ISynthesisSession): Promise<void> {
    return this.hook(session);
  }
}

new AsyncHook(stack, "Hook", {
  async hook(_session) {
    console.log("hook");
  }
});

