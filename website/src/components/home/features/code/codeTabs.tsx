import { Tab } from "@headlessui/react";
import { tab1, tab2, tab3 } from "@site/src/content/home/features/code/code";
import IamPolicy from "@site/src/content/home/features/code/iam-policy.mdx";
import Output from "@site/src/content/home/features/code/output.mdx";
import FunctionlessTableFunction from "@site/src/content/home/features/code/table-function.mdx";
import { Fragment, PropsWithChildren } from "react";
import { Code } from "../../code";
import { VisibilityWindow } from "../../visibilityWindow";

const ButtonTab = ({ children }: PropsWithChildren<{}>) => (
  <Tab as={Fragment}>
    {({ selected }) => (
      <button className={selected ? "tab-active" : "tab-inactive"}>
        {children}
      </button>
    )}
  </Tab>
);

export const CodeTabs = () => (
  <Tab.Group as="div">
    <Tab.List>
      <ButtonTab>{tab1}</ButtonTab>
      <ButtonTab>{tab2}</ButtonTab>
      <ButtonTab>{tab3}</ButtonTab>
    </Tab.List>
    <Tab.Panels className={"mt-8"}>
      <Tab.Panel as="div" className="grid grid-cols-4 gap-8">
        <div className="col-span-4">
          <VisibilityWindow visibiltyThreshold={0.5} delayMs={250}>
            {(visible: boolean) => (
              <Code
                animate={visible}
                fileName="functionless.ts"
                language="typescript"
                introDelayMs={250}
              >
                <FunctionlessTableFunction />
              </Code>
            )}
          </VisibilityWindow>
        </div>
        <div className="col-span-2 -ml-7 -mt-12">
          <VisibilityWindow visibiltyThreshold={0.1} delayMs={2500}>
            {(visible: boolean) => (
              <Code
                animate={visible}
                fileName="iam.json"
                language="json"
                introDelayMs={2500}
              >
                <IamPolicy />
              </Code>
            )}
          </VisibilityWindow>
        </div>
        <div className="col-span-2 mr-4 lg:-mr-7 -mt-16">
          <VisibilityWindow visibiltyThreshold={0.1} delayMs={3500}>
            {(visible: boolean) => (
              <Code
                animate={visible}
                fileName="output.json"
                language="json"
                introDelayMs={3500}
              >
                <Output />
              </Code>
            )}
          </VisibilityWindow>
        </div>
      </Tab.Panel>
      <Tab.Panel></Tab.Panel>
      <Tab.Panel></Tab.Panel>
    </Tab.Panels>
  </Tab.Group>
);
