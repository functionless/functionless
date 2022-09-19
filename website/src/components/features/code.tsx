import { Tab } from "@headlessui/react";
import { Fragment, PropsWithChildren } from "react";
import { tab1, tab2, tab3 } from "../../content/features/code/code";
import IamPolicy from "../../content/features/code/iam-policy.mdx";
import Output from "../../content/features/code/output.mdx";
import FunctionlessTableFunction from "../../content/features/code/table-function.mdx";
import { Code, VisibilityWindow } from "../code";

const ButtonTab = ({ children }: PropsWithChildren<{}>) => (
  <Tab as={Fragment}>
    {({ selected }) => (
      <button className={selected ? "tab-active" : "tab-inactive"}>
        {children}
      </button>
    )}
  </Tab>
);

export const CodeFeature = () => (
  <Tab.Group as={"div"}>
    <Tab.List>
      <ButtonTab>{tab1}</ButtonTab>
      <ButtonTab>{tab2}</ButtonTab>
      <ButtonTab>{tab3}</ButtonTab>
    </Tab.List>
    <Tab.Panels className="mt-8">
      <Tab.Panel className="grid grid-cols-4 gap-8">
        <div className="col-span-4">
          <VisibilityWindow visibiltyThreshold={0.5} delayMs={250}>
            <Code
              fileName="functionless.ts"
              language="typescript"
              introDelayMs={250}
            >
              <FunctionlessTableFunction />
            </Code>
          </VisibilityWindow>
        </div>
        <div className="col-span-2 -ml-7 -mt-12">
          <VisibilityWindow visibiltyThreshold={0.1} delayMs={2500}>
            <Code fileName="iam.json" language="json" introDelayMs={2500}>
              <IamPolicy />
            </Code>
          </VisibilityWindow>
        </div>
        <div className="col-span-2 -mr-7 -mt-16">
          <VisibilityWindow visibiltyThreshold={0.1} delayMs={3500}>
            <Code fileName="output.json" language="json" introDelayMs={3500}>
              <Output />
            </Code>
          </VisibilityWindow>
        </div>
      </Tab.Panel>
      <Tab.Panel></Tab.Panel>
      <Tab.Panel></Tab.Panel>
    </Tab.Panels>
  </Tab.Group>
);
