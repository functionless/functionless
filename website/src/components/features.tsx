import { ReactElement } from "react";
import { code } from "../content/features/code/code";
import { compose } from "../content/features/compose/compose";
import { title, subtitle } from "../content/features/features";
import { Feature } from "../lib/feature";
import { Code } from "./code";
import { FeatureText } from "./feature";
import { CodeFeature } from "./features/code";
import { ComposeCode } from "./features/compose/composeCode";
import { Diagram } from "./features/compose/diagram";

export const Features = () => {
  return (
    <section className="py-36 bg-functionless-bg-alternate dark:bg-functionless-dark-bg-alternate home-features snap-start">
      <div className="!max-w-screen-md container text-center">
        <span className="over">{title}</span>
      </div>
      <div className="!max-w-screen-md container flex flex-col items-center">
        <h3 className="text-center mt-2">{subtitle}</h3>
      </div>
      <FeatureSection feature={code} aside={<CodeFeature />} />
      <FeatureSection
        feature={compose}
        aside={<ComposeCode />}
        footer={<Diagram />}
      />
      {/*
      <div className="grid grid-cols-1 md:grid-cols-2 container !max-w-screen-xl py-36 gap-11">
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
      <div className="grid grid-cols-1 md:grid-cols-2 container !max-w-screen-xl py-36 gap-11">
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
  </div>*/}
    </section>
  );
};

const FeatureSection = ({
  feature,
  aside,
  footer,
}: {
  feature: Feature;
  aside: ReactElement;
  footer?: ReactElement;
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 container !max-w-screen-xl my-36 gap-11 snap-start scroll-m-28">
    <FeatureText {...feature} />
    {aside}
    <div className="col-span-2">{footer}</div>
  </div>
);
