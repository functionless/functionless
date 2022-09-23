import GetUser from "@site/src/content/home/features/snippets/get-user.mdx";
import Policy from "@site/src/content/home/features/snippets/policy.mdx";
import { Code, Terminal } from "../../code";
import { VisibilityWindow } from "../../visibilityWindow";

export const Aside = () => (
  <VisibilityWindow visibiltyThreshold={0.5} delayMs={250}>
    {(visible: boolean) => (
      <div className="flex flex-col">
        <Code
          animate={visible}
          fileName="src/user-service/get-user.ts"
          language="typescript"
          introDelayMs={250}
        >
          <GetUser />
        </Code>
        <div className="-mt-2 -ml-2 -mr-8">
          <Terminal
            animate={visible}
            title="cat policy.json"
            language="bash"
            introDelayMs={1500}
          >
            <Policy />
          </Terminal>
        </div>
      </div>
    )}
  </VisibilityWindow>
);
