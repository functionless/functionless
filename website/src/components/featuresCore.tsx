import { Feature } from "./feature";

export const FeaturesCore = () => {
  return (
    <section className="py-36 bg-functionless-bg dark:bg-functionless-dark-bg">
      <div className="container max-w-screen-md flex flex-col items-center">
        <span className="over">WHY FUNCTIONLESS?</span>
        <h4 className="text-center mt-2">
          Our framework makes your Cloud Resources smarter.
        </h4>
      </div>
      <div className="max-w-screen-xl container grid grid-cols-1 md:grid-cols-3 gap-11 mt-24">
        <Feature
          image="/img/shapes/7.svg"
          title="Unified Cloud Components"
          desc="Cloud Resources have both a runtime and deployment-time API that is
            traditionally considered separate. Smart Cloud Resources unify these
            two surface areas to enable composable, higher-order abstractions
            for the cloud."
        />
        <Feature
          image="/img/shapes/3.svg"
          title="Secure by Default"
          desc="IAM Policies for your service’s IAM Roles are derived from your
            application logic to guarantee the granted permissions are only the
            minimal set. The best security auditor is a verifiable, proactive
            and fully automated compiler."
        />
        <Feature
          image="/img/shapes/4.svg"
          title="Familiar Programming Constructs"
          desc="Building on the cloud should be no different than a local machine -
            just write and call functions, create classes and compose them
            together into an application. Cloud Resource configuration is the
            compiler’s job."
        />
      </div>
    </section>
  );
};
