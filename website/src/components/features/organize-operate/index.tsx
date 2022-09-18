import { Code } from "../../code";
import HelloCli from "./cli.mdx";
import HelloFunction from "./function.mdx";

export const OrganizeOperateFeature = () => (
  <div className="grid grid-cols-4 gap-8">
    <div className="col-span-3">
      <Code
        fileName="src/my-stack/hello.ts"
        language="typescript"
        introDelayMs={250}
      >
        <HelloFunction />
      </Code>
    </div>
    <div className="col-span-3 ml-7 -mt-16">
      <Code
        fileName="-zsh"
        language="json"
        introDelayMs={1800}
        lineNumbers={false}
      >
        <HelloCli />
      </Code>
    </div>
  </div>
);
