import Link from "@docusaurus/Link";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { body, docsButton, title } from "@site/src//content/home/cta";
import { Social } from "./social";

export const CTA = () => {
  return (
    <section className="bg-functionless-bg-alternate dark:bg-functionless-dark-bg-alternate py-36">
      <div className="grid grid-cols-1 md:grid-cols-2 tw-container gap-16 items-center">
        <div>
          <h3 className="m-0">{title}</h3>
          <p className="body1 my-4">{body}</p>

          <Link to={docsButton.to}>
            <button className="solid-button mt-4">
              {docsButton.title} <ChevronLeftIcon className="icon ml-2" />
            </button>
          </Link>
        </div>
        <div>
          <Social />
        </div>
      </div>
    </section>
  );
};
