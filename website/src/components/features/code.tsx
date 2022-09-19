import { Tab } from "@headlessui/react";
import IamPolicy from "@site/content/features/code/iam-policy.mdx";
import Output from "@site/content/features/code/output.mdx";
import FunctionlessTableFunction from "@site/content/features/code/table-function.mdx";
import { Fragment, PropsWithChildren } from "react";
import { tab1, tab2, tab3 } from "../../../content/features/code/code";
import { Code } from "../code";

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
          <Code
            fileName="functionless.ts"
            language="typescript"
            introDelayMs={250}
          >
            <FunctionlessTableFunction />
          </Code>
        </div>
        <div className="col-span-2 -ml-7 -mt-12">
          <Code fileName="iam.json" language="json" introDelayMs={3000}>
            <IamPolicy />
          </Code>
        </div>
        <div className="col-span-2 -mr-7 -mt-16">
          <Code fileName="output.json" language="json" introDelayMs={4000}>
            <Output />
          </Code>
        </div>
      </Tab.Panel>
      <Tab.Panel></Tab.Panel>
      <Tab.Panel></Tab.Panel>
    </Tab.Panels>
  </Tab.Group>
);
