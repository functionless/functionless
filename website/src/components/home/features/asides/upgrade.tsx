import AppsyncResolver from "@site/src/content/home/features/snippets/appsync-resolver.mdx";
import GetUserQuery from "@site/src/content/home/features/snippets/get-user-query.mdx";
import GetUserResolver from "@site/src/content/home/features/snippets/get-user-resolver.mdx";
import StateMachine from "@site/src/content/home/features/snippets/state-machine.mdx";
import StepFunction from "@site/src/content/home/features/snippets/step-function.mdx";
import { Code, Terminal } from "../../code";
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
);
