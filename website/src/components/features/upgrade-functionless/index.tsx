import { Code } from "../../code";
import ASL from "./asl.mdx";
import StepFunction from "./step-function.mdx";

export const UpgradeToFunctionlessCode = () => (
  <div className="grid grid-cols-4 gap-8">
    <div className="col-span-4">
      <Code
        fileName="src/user-service/get-user.ts"
        language="typescript"
        introDelayMs={250}
      >
        <StepFunction />
      </Code>
    </div>
    <div className="col-span-3 -ml-7 -mr-7 -mt-16">
      <Code fileName="state-machine.json" language="json" introDelayMs={2500}>
        <ASL />
      </Code>
    </div>
  </div>
);
