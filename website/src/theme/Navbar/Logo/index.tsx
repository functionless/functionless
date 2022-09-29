import Link from "@docusaurus/Link";

export default function NavbarLogo(): JSX.Element {
  return (
    <Link href="/" className="flex w-full">
      <img
        className="w-32 sm:w-full h-8 sm:h-10 mr-8"
        src="/img/logo/light.svg"
        alt="Functionless logo"
      />
    </Link>
  );
}
