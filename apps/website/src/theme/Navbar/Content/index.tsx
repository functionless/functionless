import Link from "@docusaurus/Link";
import { main, MainItem, social, SocialItem } from "@site/src/content/home/nav";
import { githubUrl } from "@site/src/content/site";
import NavbarLogo from "@theme/Navbar/Logo";
import NavbarMobileSidebarToggle from "@theme/Navbar/MobileSidebar/Toggle";
import GitHubButton from "react-github-btn";

export const MainNavItem = ({ item }: { item: MainItem }) => (
  <Link to={item.to} title={item.title} className="font-medium text-lg">
    {item.title}
  </Link>
);
export const SocialNavItem = ({ item }: { item: SocialItem }) => (
  <Link
    href={item.href}
    title={item.title}
    className="shrink-0 hover:bg-functionless-blue p-2 transition rounded-full hidden md:block"
  >
    <img src={item.icon} />
  </Link>
);

export default function NavbarContent(): JSX.Element {
  return (
    <div className="flex 2xl:grid 2xl:grid-cols-3 justify-between w-full">
      <div className="flex col-span-1 items-center gap-4">
        <div className="block md:hidden">
          <NavbarMobileSidebarToggle />
        </div>
        <NavbarLogo />
        <div className="flex-1 gap-8 hidden md:flex items-center">
          {main.map((item) => (
            <MainNavItem key={item.title} item={item} />
          ))}
        </div>
      </div>

      <div className="col-span-1 px-4 ml-16 lg:ml-0 search-bar hidden lg:flex lg:w-96 xl:justify-self-center">
        {/* <NavbarSearch>
          <SearchBar />
        </NavbarSearch> */}
      </div>
      <div className="col-span-1 gap-2 items-center justify-end flex">
        {social.map((item) => (
          <SocialNavItem key={item.title} item={item} />
        ))}
        <div className="pt-1.5 ml-2">
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

        {/* <NavbarColorModeToggle className="ml-6 hidden md:block" /> */}
      </div>
    </div>
  );
}
