import Link from "@docusaurus/Link";
// @ts-expect-error - types are not exported for internals
import { useNavbarMobileSidebar } from "@docusaurus/theme-common/internal";
import { main, MainItem, social, SocialItem } from "@site/src/content/home/nav";

export const MainNavItem = ({ item }: { item: MainItem }) => {
  const mobileSidebar = useNavbarMobileSidebar();
  return (
    <Link
      to={item.to}
      title={item.title}
      onClick={() => mobileSidebar.toggle()}
      className="font-medium text-lg "
    >
      {item.title}
    </Link>
  );
};

export const SocialNavItem = ({ item }: { item: SocialItem }) => {
  const mobileSidebar = useNavbarMobileSidebar();
  return (
    <Link
      href={item.href}
      title={item.title}
      onClick={() => mobileSidebar.toggle()}
      className="shrink-0 hover:bg-functionless-blue p-2 transition rounded-full"
    >
      <img className="w-8" src={item.icon} />
    </Link>
  );
};
// The primary menu displays the navbar items
export default function NavbarMobilePrimaryMenu() {
  // TODO how can the order be defined for mobile?

  return (
    <div className="container my-6">
      <ul>
        {main.map((item) => (
          <MainNavItem item={item} key={item.title} />
        ))}
      </ul>
      <ul className="flex -ml-2 my-32">
        {social.map((item) => (
          <SocialNavItem item={item} key={item.title} />
        ))}
      </ul>
    </div>
  );
}
