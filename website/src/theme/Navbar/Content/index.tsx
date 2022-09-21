import Link from "@docusaurus/Link";
import { useNavbarMobileSidebar } from "@docusaurus/theme-common/internal";
import { main, MainItem, social, SocialItem } from "@site/src/content/nav";
import NavbarLogo from "@theme/Navbar/Logo";
import NavbarMobileSidebarToggle from "@theme/Navbar/MobileSidebar/Toggle";
import NavbarSearch from "@theme/Navbar/Search";
import SearchBar from "@theme/SearchBar";
import GitHubButton from "react-github-btn";

export const MainNavItem = ({ item }: { item: MainItem }) => (
  <Link to={item.to} title={item.title} className="font-medium text-lg">
    {item.title}
  </Link>
);
export const SocialNavItem = ({ item }: { item: SocialItem }) => (
  <Link href={item.href} title={item.title}>
    <img src={item.icon} />
  </Link>
);

export default function NavbarContent(): JSX.Element {
  const mobileSidebar = useNavbarMobileSidebar();

  return (
    <div className="grid grid-cols-3 justify-between w-full">
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

      <div className="col-span-2 md:col-span-1 px-4 ml-8 md:ml-0">
        <div className="hidden lg:flex search-bar">
          <NavbarSearch>
            <SearchBar />
          </NavbarSearch>
        </div>
      </div>
      <div className="col-span-1 gap-4 hidden md:flex items-center justify-end">
        {social.map((item) => (
          <SocialNavItem key={item.title} item={item} />
        ))}
        <div className="pt-1.5 hidden md:block">
          <GitHubButton
            href="https://github.com/functionless/functionless"
            data-color-scheme="no-preference: dark; light: light; dark: dark;"
            data-icon="octicon-star"
            data-size="small"
            data-show-count="true"
            aria-label="Star functionless/functionless on GitHub"
          >
            Star
          </GitHubButton>
        </div>

        {/* <NavbarColorModeToggle className="ml-6 hidden md:block" /> */}
      </div>
    </div>
  );
}
