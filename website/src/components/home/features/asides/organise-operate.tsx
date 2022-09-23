import Hello from "@site/src/content/home/features/snippets/hello.mdx";
import InvokeHello from "@site/src/content/home/features/snippets/invoke-hello.mdx";
import { Code } from "../../code";
import { VisibilityWindow } from "../../visibilityWindow";

export const Aside = () => (
  <VisibilityWindow visibiltyThreshold={0.5} delayMs={250}>
    {(visible: boolean) => (
      <div className="flex flex-col gap-8">
        <Code
          animate={visible}
          fileName="src/my-stack/hello.ts"
          language="typescript"
          introDelayMs={250}
        >
          <Hello />
        </Code>
        <Code
          animate={visible}
          fileName="zsh"
          language="bash"
          introDelayMs={2000}
        >
          <InvokeHello />
        </Code>
      </div>
    )}
  </VisibilityWindow>
);
