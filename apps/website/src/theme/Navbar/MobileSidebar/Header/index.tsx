// @ts-expect-error - types are not exported for internals
import { useNavbarMobileSidebar } from "@docusaurus/theme-common/internal";
import IconClose from "@theme/Icon/Close";
import NavbarLogo from "@theme/Navbar/Logo";

function CloseButton() {
  const mobileSidebar = useNavbarMobileSidebar();
  return (
    <button
      type="button"
      className="clean-btn navbar-sidebar__close"
      onClick={() => mobileSidebar.toggle()}
    >
      <IconClose color="var(--ifm-color-emphasis-600)" />
    </button>
  );
}

export default function NavbarMobileSidebarHeader() {
  return (
    <div className="navbar-sidebar__brand my-4">
      <NavbarLogo />
      <CloseButton />
    </div>
  );
}
