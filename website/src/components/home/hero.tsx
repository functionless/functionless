import Link from "@docusaurus/Link";
import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import {
  body,
  docsLink,
  githubLink,
  title1,
  title2,
} from "@site/src/content/home/hero";
import clsx from "clsx";
import ky from "ky";
import { useEffect, useState } from "react";
import { githubUrl } from "../../content/site";

interface LatestRelease {
  html_url: string;
  name: string;
}
export const Hero = () => {
  const [latestRelease, setLatestRelease] = useState<LatestRelease>();
  useEffect(() => {
    void ky
      .get(
        "https://api.github.com/repos/functionless/functionless/releases/latest"
      )
      .json<LatestRelease>()
      .then(setLatestRelease);
  }, []);
  return (
    <section className="relative pb-2 bg-[url('/img/lines.svg')] bg-no-repeat bg-bottom mb-24">
      <div className="px-4 mx-auto max-w-screen-md pt-16 lg:pt-28 pb-16 z-20">
        <Link
          className={clsx(
            "blue-chip transition ease-in",
            latestRelease
              ? "opacity-1 scale-100"
              : "opacity-0 scale-75 translate-y-10"
          )}
          href={latestRelease?.html_url}
        >
          {latestRelease?.name} released
          <ChevronLeftIcon className="icon ml-2" />
        </Link>
        <h1 className="text-4xl lg:text-5xl my-6 flex flex-col lg:block">
          <span className="lg:after:content-['_']">{title1}</span>
          <span>{title2}</span>
        </h1>
        <p
          className="body1 text-functionless-medium dark:text-functionless-dark-medium my-6"
          dangerouslySetInnerHTML={{ __html: body }}
        />
        <div className="gap-4 md:gap-7 pt-5 flex flex-col md:flex-row items-stretch md:items-center">
          <Link to={docsLink.to}>
            <button className="solid-button w-full flex flex-row justify-center items-center">
              <span>{docsLink.title}</span>
              <ChevronLeftIcon className="icon ml-2" />
            </button>
          </Link>
          <Link href={githubUrl}>
            <button className="social-button bg-functionless-github border-functionless-dark-border border w-full">
              <img src="/img/social/github.svg" className="icon mr-2" />
              {githubLink}
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
};
