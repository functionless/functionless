import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { Social } from "./social";

export const CTA = () => {
  return (
    <section className="bg-functionless-bg-alternate dark:bg-functionless-dark-bg-alternate py-36 snap-start">
      <div className="grid grid-cols-1 md:grid-cols-2 container !max-w-screen-xl py-36 gap-16 items-center">
        <div>
          <h3 className="m-0">Experience Functionless</h3>
          <p className="body1 mt-2">
            Functionless is an open source framework. Build your first cloud
            application today - all you need is an AWS account.
          </p>
          <button className="solid-button mt-4">
            Read Docs <ChevronLeftIcon className="icon ml-2" />
          </button>
        </div>
        <div>
          <Social />
        </div>
      </div>
    </section>
  );
};
