import { Tab } from "@headlessui/react";
import { Fragment, PropsWithChildren } from "react";
import { Code } from "../../code";

import AppsyncReslver from "./appsync-resolver.mdx";
import ASL from "./asl.mdx";
import GQL from "./gql.mdx";
import StepFunction from "./step-function.mdx";
import VTL from "./vtl.mdx";

const ButtonTab = ({ children }: PropsWithChildren<{}>) => (
  <Tab as={Fragment}>
    {({ selected }) => (
      <button className={selected ? "tab-active" : "tab-inactive"}>
        {children}
      </button>
    )}
  </Tab>
);

export const UpgradeToFunctionlessCode = () => (
  <Tab.Group as={"div"}>
    <Tab.List>
      <ButtonTab>Step Function</ButtonTab>
      <ButtonTab>Appsync Resolver</ButtonTab>
      <ButtonTab>Event Bridge Rule</ButtonTab>
    </Tab.List>
    <Tab.Panels className="mt-8">
      <Tab.Panel>
        <StepFunctionExample />
      </Tab.Panel>
      <Tab.Panel>
        <AppsyncResolverExample />
      </Tab.Panel>
      <Tab.Panel>
        <AppsyncResolverExample />
      </Tab.Panel>
    </Tab.Panels>
  </Tab.Group>
);

const StepFunctionExample = () => (
  <div className="grid grid-cols-4 gap-8">
    <div className="col-span-4">
      <Code
        fileName="src/user-service/get-user.ts"
        language="typescript"
        introDelayMs={250}
      >
        <StepFunction />
      </Code>
    </div>
    <div className="col-span-4 ml-7 -mr-7 -mt-16">
      <Code fileName="state-machine.json" language="json" introDelayMs={2500}>
        <ASL />
      </Code>
    </div>
  </div>
);

export const AppsyncResolverExample = () => (
  <div className="grid grid-cols-4 gap-8">
    <div className="col-span-4">
      <Code
        fileName="src/user-service/get-user.ts"
        language="typescript"
        introDelayMs={250}
      >
        <AppsyncReslver />
      </Code>
    </div>
    <div className="col-span-2 -ml-7 -mt-16">
      <Code
        fileName="get-user-resolver.vtl"
        language="json"
        introDelayMs={2500}
      >
        <VTL />
      </Code>
    </div>
    <div className="col-span-2 ml-7 -mr-7 -mt-16">
      <Code fileName="get-user-query.gql" language="json" introDelayMs={3500}>
        <GQL />
      </Code>
    </div>
  </div>
);
