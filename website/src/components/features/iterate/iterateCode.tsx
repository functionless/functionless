import StepFunction1 from "@site/src/content/features/iterate/step-function-1.mdx";
import StepFunction2 from "@site/src/content/features/iterate/step-function-2.mdx";
import { Code } from "../../code";
import { VisibilityWindow } from "../../visibilityWindow";

export const IterateCode = () => (
  <VisibilityWindow visibiltyThreshold={0.5} delayMs={250}>
    {(visible: boolean) => (
      <div className="flex flex-col gap-8">
        <Code
          animate={visible}
          fileName="step-function-1.ts"
          language="typescript"
          introDelayMs={250}
        >
          <StepFunction1 />
        </Code>
        <Code
          animate={visible}
          fileName="step-function-2.ts"
          language="typescript"
          introDelayMs={250}
        >
          <StepFunction2 />
        </Code>
      </div>
    )}
  </VisibilityWindow>
);
