import Link from "@docusaurus/Link";
import { main, social } from "@site/src/content/home/nav";
import { githubUrl } from "@site/src/content/site";
import GitHubButton from "react-github-btn";
import NavbarLogo from "../Navbar/Logo";

/* This example requires Tailwind CSS v2.0+ */
const Footer = () => {
  return (
    <footer className="bg-functionless-bg dark:bg-functionless-dark-bg">
      <div className="tw-container overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
        <nav
          className="grid grid-cols-1 md:grid-cols-3 gap-7 items-center"
          aria-label="Footer"
        >
          <div className="justify-self-start">
            <NavbarLogo />
          </div>
          <div className="flex md:justify-start justify-center gap-x-12">
            {main.map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="dark:text-functionless-white text-functionless-black hover:no-underline hover:text-functionless-blue"
              >
                {item.title}
              </Link>
            ))}
          </div>
          <div className="flex justify-center md:justify-end space-x-6">
            {social.map((item) => (
              <Link key={item.title} href={item.href} className="shrink-0">
                <img src={item.icon} className="icon" />
              </Link>
            ))}
            <GitHubButton
              href={githubUrl}
              data-color-scheme="no-preference: dark; light: light; dark: dark;"
              data-icon="octicon-star"
              data-size="small"
              data-show-count="true"
              aria-label="Star functionless on GitHub"
            >
              Star
            </GitHubButton>
          </div>
        </nav>
        <p className="mt-8 text-center text-base text-gray-400">
          &copy; {new Date().getFullYear()} Functionless Corp. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
