import { Tab } from "@headlessui/react";
import { Fragment, PropsWithChildren, ReactElement } from "react";

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
        <Tab.Panel key={title}>{panel as any}</Tab.Panel>
      ))}
    </Tab.Panels>
  </Tab.Group>
);
