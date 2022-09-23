import Hello from "@site/src/content/home/features/snippets/hello.mdx";
import InvokeHello from "@site/src/content/home/features/snippets/invoke-hello.mdx";
import { Code, Terminal } from "../../code";
import { VisibilityWindow } from "../../visibilityWindow";

export const Aside = () => (
  <VisibilityWindow visibiltyThreshold={0.5} delayMs={250}>
    {(visible: boolean) => (
      <div className="flex flex-col">
        <Code
          animate={visible}
          fileName="src/my-stack/hello.ts"
          language="typescript"
          introDelayMs={250}
        >
          <Hello />
        </Code>
        <div className="-mt-8 ml-28 mr-24">
          <Terminal
            animate={visible}
            title="zsh - functionless"
            language="bash"
            introDelayMs={1500}
          >
            <InvokeHello />
          </Terminal>
        </div>
      </div>
    )}
  </VisibilityWindow>
);
