import Link from "@docusaurus/Link";
import Logo from "@theme/Logo";

export default function NavbarLogo(): JSX.Element {
  return (
    <Link href="/" className="flex-shrink-0">
      <img
        className="w-full h-8 sm:h-10 mr-8"
        src="/img/logo/light.svg"
        alt="Functionless logo"
      />
    </Link>
  );
}
