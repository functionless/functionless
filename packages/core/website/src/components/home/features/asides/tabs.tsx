import { Tab } from "@headlessui/react";
import { tab1, tab2, tab3 } from "@site/src/content/home/features/code/code";
import IamPolicy from "@site/src/content/home/features/code/iam-policy.mdx";
import Output from "@site/src/content/home/features/code/output.mdx";
import FunctionlessTableFunction from "@site/src/content/home/features/code/table-function.mdx";
import { Fragment, PropsWithChildren, ReactElement } from "react";
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

export interface Tab {
  title: string;
  panel: ReactElement;
}

export const AsideTabs = ({ children: tabs }: { children: Tab[] }) => (
  <Tab.Group as="div">
    <Tab.List>
      {tabs.map(({ title }) => (
        <ButtonTab key={title}>{title}</ButtonTab>
      ))}
    </Tab.List>
    <Tab.Panels className={"mt-8"}>
      {tabs.map(({ title, panel }) => (
        <Tab.Panel key={title}>{panel}</Tab.Panel>
      ))}
    </Tab.Panels>
  </Tab.Group>
);
