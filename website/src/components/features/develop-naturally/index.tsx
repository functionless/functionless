import { Code } from "../../code";
import Function from "./get-user.mdx";
import IamPolicy from "./iam.mdx";

export const DevelopNaturallyCode = () => (
  <div className="grid grid-cols-4 gap-8">
    <div className="col-span-4">
      <Code
        fileName="src/user-service/get-user.ts"
        language="typescript"
        introDelayMs={250}
      >
        <Function />
      </Code>
    </div>
    <div className="col-span-4 -ml-7 -mr-7 -mt-16">
      <Code fileName="policy.json" language="json" introDelayMs={1800}>
        <IamPolicy />
      </Code>
    </div>
  </div>
);
