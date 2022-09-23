import AppsyncResolver from "@site/src/content/home/features/snippets/appsync-resolver.mdx";
import GetUserQuery from "@site/src/content/home/features/snippets/get-user-query.mdx";
import GetUserResolver from "@site/src/content/home/features/snippets/get-user-resolver.mdx";
import StateMachine from "@site/src/content/home/features/snippets/state-machine.mdx";
import StepFunction from "@site/src/content/home/features/snippets/step-function.mdx";
import { Code } from "../../code";
import { VisibilityWindow } from "../../visibilityWindow";
import { AsideTabs } from "./tabs";

export const Aside = () => (
  <AsideTabs>
    {[
      {
        title: "Step Function",
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
                    <StepFunction />
                  </Code>
                </div>
                <div className="col-span-4 ml-7 -mr-7 -mt-16">
                  <Code
                    fileName="state-machine.json"
                    language="json"
                    introDelayMs={2500}
                    animate={visible}
                  >
                    <StateMachine />
                  </Code>
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
                  <Code
                    fileName="get-user-resolver.vtl"
                    language="json"
                    introDelayMs={2500}
                    animate={visible}
                  >
                    <GetUserResolver />
                  </Code>
                </div>
                <div className="col-span-2 ml-7 -mr-7 -mt-16">
                  <Code
                    fileName="get-user-query.gql"
                    language="json"
                    introDelayMs={3500}
                    animate={visible}
                  >
                    <GetUserQuery />
                  </Code>
                </div>
              </div>
            )}
          </VisibilityWindow>
        ),
      },
      {
        title: "Event Bridge Rule",
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
                  <Code
                    fileName="get-user-resolver.vtl"
                    language="json"
                    introDelayMs={2500}
                    animate={visible}
                  >
                    <GetUserResolver />
                  </Code>
                </div>
                <div className="col-span-2 ml-7 -mr-7 -mt-16">
                  <Code
                    fileName="get-user-query.gql"
                    language="json"
                    introDelayMs={3500}
                    animate={visible}
                  >
                    <GetUserQuery />
                  </Code>
                </div>
              </div>
            )}
          </VisibilityWindow>
        ),
      },
    ]}
  </AsideTabs>
);
