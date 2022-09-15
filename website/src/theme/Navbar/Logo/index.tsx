import Link from "@docusaurus/Link";
import Logo from "@theme/Logo";
import React from "react";

export default function NavbarLogo(): JSX.Element {
  return (
    <Link href="/">
      <img
        className="h-8 w-auto sm:h-10 mr-8"
        src="/img/logo/light.svg"
        alt="Functionless logo"
      />
    </Link>
  );
}
