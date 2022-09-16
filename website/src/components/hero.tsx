import { ChevronLeftIcon } from "@heroicons/react/20/solid";

export const Hero = () => {
  return (
    <section className="relative pb-24">
      <div className="bg-[url('/img/lines.svg')] bg-no-repeat w-full h-full bg-bottom">
        <div className="container !max-w-screen-sm pt-28 pb-16 z-20">
          <span className="blue-chip">
            v1.02.5 Released <ChevronLeftIcon className="icon ml-2" />
          </span>
          <h2 className="mt-3">Code the Cloud</h2>
          <p className="body1 text-functionless-medium dark:text-functionless-dark-medium">
            Develop APIs, Functions, Workflows and Event-Driven Architectures
            with “Smart Cloud Resources” that have best practices built-in.
            Least-privilege IAM Policies, environment variables, SDK clients and
            Domain Specific Languages are automatically configured.
          </p>
          <div className="space-x-7 pt-5 flex items-center">
            <button className="solid-button">
              Read Docs <ChevronLeftIcon className="icon ml-2" />
            </button>
            <button className="social-button w-auto bg-transparent">
              <img src="/img/social/github.svg" className="icon mr-2" />
              Star us on Github
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
