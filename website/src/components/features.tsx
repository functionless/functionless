import { Tab } from "@headlessui/react";
import { Fragment } from "react";

import { Code } from "./code";
import FunctionlessTableFunction from "./snippets/functionless-table-function.mdx";

export const Features = () => {
  return (
    <section className="py-36 bg-functionless-bg-alternate dark:bg-functionless-dark-bg-alternate home-features">
      <div className="max-w-screen-md container flex flex-col items-center">
        <span className="over">FEATURES</span>
        <h3 className="text-center mt-2">
          Build Reliable and Scalable systems with Smart Resources.
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 container max-w-screen-xl py-36 gap-11">
        <div>
          <h4>Code</h4>
          <div className="mt-10">
            <h5 className="m-0">Infrastructure from code</h5>
            <p className="body1 text-functionless-medium dark:text-functionless-dark-medium mt-2">
              Build functionless architectures using TypeScript syntax instead
              of cumbersome and error-prone service-specific domain specific
              languages.
            </p>
          </div>
          <div className="mt-10">
            <h5 className="m-0">Automated IAM policies</h5>
            <p className="body1 text-functionless-medium dark:text-functionless-dark-medium mt-2">
              The best security auditor is no auditor - our compiler derives
              minimal IAM Policies from your code.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-8">
          <Tab.Group as={"div"} className="col-span-4">
            <Tab.List>
              <Tab as={Fragment}>
                {({ selected }) => (
                  <button className={selected ? "tab-active" : "tab-inactive"}>
                    Lambda function
                  </button>
                )}
              </Tab>
              <Tab as={Fragment}>
                {({ selected }) => (
                  <button className={selected ? "tab-active" : "tab-inactive"}>
                    Step function
                  </button>
                )}
              </Tab>
              <Tab as={Fragment}>
                {({ selected }) => (
                  <button className={selected ? "tab-active" : "tab-inactive"}>
                    Appsync resolver
                  </button>
                )}
              </Tab>
            </Tab.List>
          </Tab.Group>
          <div className="col-span-4">
            <Code fileName="functionless.ts">
              <FunctionlessTableFunction />
            </Code>
          </div>
          <div className="col-span-2 -ml-7 -mt-12"></div>
          <div className="col-span-2 -mr-7 -mt-16"></div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 container max-w-screen-xl py-36 gap-11">
        <div>
          <h4>Compose</h4>
          <div className="mt-10">
            <h5 className="m-0">Realtime feedback</h5>
            <p className="body1 text-functionless-medium dark:text-functionless-dark-medium mt-2">
              Catch bugs before they occur and enjoy Intellisense in your IDE
              with type-safety that works across service boundaries.
            </p>
          </div>
          <div className="mt-10">
            <h5 className="m-0">Debug Locally</h5>
            <p className="body1 text-functionless-medium dark:text-functionless-dark-medium mt-2">
              Coming Soon!
            </p>
          </div>
        </div>
        <div>
          <Code />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 container max-w-screen-xl py-36 gap-11">
        <div>
          <h4>Iterate</h4>
          <div className="mt-10">
            <h5 className="m-0">Realtime feedback</h5>
            <p className="body1 text-functionless-medium dark:text-functionless-dark-medium mt-2">
              Catch bugs before they occur and enjoy Intellisense in your IDE
              with type-safety that works across service boundaries.
            </p>
          </div>
          <div className="mt-10">
            <h5 className="m-0">Debug Locally</h5>
            <p className="body1 text-functionless-medium dark:text-functionless-dark-medium mt-2">
              Coming Soon!
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-11">
          <Code />
          <Code />
        </div>
      </div>
    </section>
  );
};
