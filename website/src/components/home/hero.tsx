import Link from "@docusaurus/Link";
import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import {
  body,
  docsLink,
  githubLink,
  title,
  versionRelease,
} from "@site/src/content/home/hero";
import { githubUrl } from "../../content/site";

export const Hero = () => {
  return (
    <section className="relative pb-2 min-h-screen">
      <div className="bg-[url('/img/lines.svg')] bg-no-repeat w-full h-full bg-bottom">
        <div className="container !max-w-screen-sm pt-28 pb-16 z-20">
          <span className="blue-chip">
            {versionRelease}
            <ChevronLeftIcon className="icon ml-2" />
          </span>
          <h2 className="my-4">{title}</h2>
          <p className="body1 text-functionless-medium dark:text-functionless-dark-medium my-6">
            {body}
          </p>
          <div className="space-x-7 pt-5 flex items-center">
            <Link to={docsLink.to}>
              <button className="solid-button">
                {docsLink.title}
                <ChevronLeftIcon className="icon ml-2" />
              </button>
            </Link>
            <Link href={githubUrl}>
              <button className="social-button w-auto bg-transparent">
                <img src="/img/social/github.svg" className="icon mr-2" />
                {githubLink}
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
