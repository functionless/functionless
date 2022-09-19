export const FeaturesCore = () => {
  return (
    <section className="py-36 bg-functionless-bg dark:bg-functionless-dark-bg snap-start">
      <div className="container !max-w-screen-md flex flex-col items-center">
        <span className="over">WHY FUNCTIONLESS?</span>
        <h4 className="text-center mt-2">
          Our framework makes your Cloud Resources smarter.
        </h4>
      </div>
      <div className="!max-w-screen-xl container grid grid-cols-3 gap-11 mt-24">
        <div className="flex flex-col items-center">
          <img src="/img/shapes/7.svg" className="w-16" />
          <h6 className="mt-6 text-center">Unified Cloud Components</h6>
          <p className="text-center">
            Cloud Resources have both a runtime and deployment-time API that is
            traditionally considered separate. Smart Cloud Resources unify these
            two surface areas to enable composable, higher-order abstractions
            for the cloud.
          </p>
        </div>
        <div className="flex flex-col items-center">
          <img src="/img/shapes/3.svg" className="w-16" />
          <h6 className="mt-6 text-center">Secure by Default</h6>
          <p className="text-center">
            IAM Policies for your service’s IAM Roles are derived from your
            application logic to guarantee the granted permissions are only the
            minimal set. The best security auditor is a verifiable, proactive
            and fully automated compiler.
          </p>
        </div>
        <div className="flex flex-col items-center">
          <img src="/img/shapes/4.svg" className="w-16" />
          <h6 className="mt-6 text-center">Familiar Programming Constructs</h6>
          <p className="text-center">
            Building on the cloud should be no different than a local machine -
            just write and call functions, create classes and compose them
            together into an application. Cloud Resource configuration is the
            compiler’s job.
          </p>
        </div>
      </div>
    </section>
  );
};
