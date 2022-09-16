import { code } from "../lib/features";
import { FeatureText } from "./feature";
import { CodeFeature } from "./features/code/code";

export const Features = () => {
  return (
    <section className="py-36 bg-functionless-bg-alternate dark:bg-functionless-dark-bg-alternate home-features overflow-hidden">
      <div className="max-w-screen-md container text-center">
        <span className="over">FEATURES</span>
      </div>
      <div className="max-w-screen-md container flex flex-col items-center">
        <h3 className="text-center mt-2">
          Build Reliable and Scalable systems with Smart Resources.
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 container max-w-screen-xl py-36 gap-11">
        <FeatureText {...code} />
        <CodeFeature />
      </div>
      {/* iv>
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
      </div> */}
    </section>
  );
};
