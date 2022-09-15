import { useThemeConfig } from "@docusaurus/theme-common";
import {
  splitNavbarItems,
  useNavbarMobileSidebar,
  // @ts-ignore "internal doesnt resolve"
} from "@docusaurus/theme-common/internal";
import NavbarColorModeToggle from "@theme/Navbar/ColorModeToggle";
import NavbarLogo from "@theme/Navbar/Logo";
import NavbarMobileSidebarToggle from "@theme/Navbar/MobileSidebar/Toggle";
import NavbarSearch from "@theme/Navbar/Search";
import NavbarItem, { type Props as NavbarItemConfig } from "@theme/NavbarItem";
import SearchBar from "@theme/SearchBar";
import { type ReactNode } from "react";
import GitHubButton from "react-github-btn";

function useNavbarItems() {
  // TODO temporary casting until ThemeConfig type is improved
  return useThemeConfig().navbar.items as NavbarItemConfig[];
}

function NavbarItems({ items }: { items: NavbarItemConfig[] }): JSX.Element {
  return (
    <>
      {items.map((item, i) => (
        <NavbarItem {...item} key={i} />
      ))}
    </>
  );
}

function NavbarContentLayout({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="navbar__inner grid grid-cols-3">
      <div className="navbar__items col-span-1 gap-1">{left}</div>

      <div className="navbar__items col-span-2 md:col-span-1 px-4 ml-8 md:ml-0 search-bar">
        <NavbarSearch>
          <SearchBar />
        </NavbarSearch>
      </div>
      <div className="navbar__items navbar__items--right col-span-1 gap-1 hidden md:flex">
        {right}
      </div>
    </div>
  );
}

export default function NavbarContent(): JSX.Element {
  const mobileSidebar = useNavbarMobileSidebar();

  const items = useNavbarItems();
  const [leftItems, rightItems] = splitNavbarItems(items);

  return (
    <NavbarContentLayout
      left={
        // TODO stop hardcoding items?
        <>
          {!mobileSidebar.disabled && <NavbarMobileSidebarToggle />}
          <NavbarLogo />
          <NavbarItems items={leftItems} />
        </>
      }
      right={
        // TODO stop hardcoding items?
        // Ask the user to add the respective navbar items => more flexible
        <>
          <NavbarItems items={rightItems} />
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

          <NavbarColorModeToggle className="ml-6 hidden md:block" />
        </>
      }
    />
  );
}
