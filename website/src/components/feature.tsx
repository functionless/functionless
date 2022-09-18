import { Feature } from "../lib/feature";

export const FeatureText = ({ title, points }: Feature) => (
  <div>
    <h3>{title}</h3>
    {points.map(({ title, body }) => (
      <div className="mt-10" key={title}>
        <h6 className="m-0">{title}</h6>
        <p className="body1 text-functionless-medium dark:text-functionless-dark-medium mt-2">
          {body}
        </p>
      </div>
    ))}
    {/* <div className="grid grid-cols-4 gap-8">
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
      </div> */}
  </div>
);
