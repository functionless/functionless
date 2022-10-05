import AppsyncResolver from "@site/src/content/home/features/snippets/appsync-resolver.mdx";
import GetUserQuery from "@site/src/content/home/features/snippets/get-user-query.mdx";
import GetUserResolver from "@site/src/content/home/features/snippets/get-user-resolver.mdx";
import StateMachine from "@site/src/content/home/features/snippets/state-machine.mdx";
import StepFunction from "@site/src/content/home/features/snippets/step-function.mdx";
import { clamp } from "@site/src/lib/clamp";
import { useVisibility } from "@site/src/lib/useVisibility";
import { Code, Terminal } from "../../code";
import { VisibilityWindow } from "../../visibilityWindow";
import { AsideTabs } from "./tabs";

export const Aside = ({ scrollFactor }: { scrollFactor: number }) => {
  const { ref } = useVisibility<HTMLDivElement>(0, {
    singleShot: false,
  });
  const translateFactor = clamp(scrollFactor, 0.5);
  return (
    <div
      ref={ref}
      style={{
        opacity: translateFactor,
      }}
    >
      <AsideTabs>
        {[
          {
            title: "Step Function",
            panel: (
              <VisibilityWindow delayMs={250} visibiltyThreshold={0.2}>
                {(visible) => (
                  <div className="grid grid-cols-4 gap-8">
                    <div
                      className="col-span-4"
                      style={{
                        transform: `translate(${
                          (1 - translateFactor) * 100
                        }px, ${
                          (1 - translateFactor) * 10
                        }px) scale(${scrollFactor}, ${scrollFactor})`,
                      }}
                    >
                      <Code
                        fileName="src/user-service/get-user.ts"
                        language="typescript"
                        introDelayMs={250}
                        animate={visible}
                      >
                        <StepFunction />
                      </Code>
                    </div>
                    <div
                      className="col-span-4 ml-7 -mr-7 -mt-16"
                      style={{
                        opacity: translateFactor,
                        transform: `translate(0px, ${
                          translateFactor * 10
                        }px) scale(${scrollFactor}, ${scrollFactor})`,
                      }}
                    >
                      <Terminal
                        title="cat state-machine.json"
                        language="json"
                        introDelayMs={1500}
                        animate={visible}
                      >
                        <StateMachine />
                      </Terminal>
                    </div>
                  </div>
                )}
              </VisibilityWindow>
            ),
          },
          {
            title: "Appsync Resolver",
            panel: (
              <VisibilityWindow delayMs={250} visibiltyThreshold={0.2}>
                {(visible) => (
                  <div className="grid grid-cols-4 gap-8">
                    <div className="col-span-4">
                      <Code
                        fileName="src/user-service/get-user.ts"
                        language="typescript"
                        introDelayMs={250}
                        animate={visible}
                      >
                        <AppsyncResolver />
                      </Code>
                    </div>
                    <div className="col-span-2 -ml-7 -mt-16">
                      <Terminal
                        title="cat get-user-resolver.vtl"
                        language="json"
                        introDelayMs={2500}
                        animate={visible}
                      >
                        <GetUserResolver />
                      </Terminal>
                    </div>
                    <div className="col-span-2 ml-7 -mr-7 -mt-16">
                      <Terminal
                        title="cat get-user-query.gql"
                        language="json"
                        introDelayMs={3500}
                        animate={visible}
                      >
                        <GetUserQuery />
                      </Terminal>
                    </div>
                  </div>
                )}
              </VisibilityWindow>
            ),
          },
        ]}
      </AsideTabs>
    </div>
  );
};
