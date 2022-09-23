import GetUser from "@site/src/content/home/features/snippets/get-user.mdx";
import { Code } from "../../code";
import { VisibilityWindow } from "../../visibilityWindow";

export const Aside = () => (
  <VisibilityWindow visibiltyThreshold={0.5} delayMs={250}>
    {(visible: boolean) => (
      <div className="flex flex-col gap-8">
        <Code
          animate={visible}
          fileName="src/user-service/get-user.ts"
          language="typescript"
          introDelayMs={250}
        >
          <GetUser />
        </Code>
      </div>
    )}
  </VisibilityWindow>
);
