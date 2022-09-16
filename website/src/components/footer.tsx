/* This example requires Tailwind CSS v2.0+ */
const navigation = {
  main: [
    { name: "Docs", href: "/docs" },
    { name: "Blog", href: "/blog" },
    { name: "Team", href: "/team" },
  ],
  social: [
    {
      name: "Discord",
      href: "/",
      icon: "/img/social/discord.svg",
    },
    {
      name: "Twitter",
      href: "/",
      icon: "/img/social/twitter.svg",
    },
    {
      name: "Github",
      href: "/",
      icon: "/img/social/github.svg",
    },
  ],
};

export const Footer = () => {
  return (
    <footer className="bg-functionless-bg dark:bg-functionless-dark-bg">
      <div className="mx-auto !max-w-7xl overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
        <nav
          className="grid grid-cols-1 md:grid-cols-3 gap-7 items-center"
          aria-label="Footer"
        >
          <img src="/img/logo/light.svg" className="h-12" />
          <div className="flex justify-start md:justify-center space-x-4">
            {navigation.main.map((item) => (
              <div key={item.name} className="">
                <a
                  href={item.href}
                  className="dark:text-functionless-white text-functionless-black hover:no-underline hover:text-functionless-blue"
                >
                  {item.name}
                </a>
              </div>
            ))}
          </div>
          <div className="flex justify-start md:justify-end space-x-6">
            {navigation.social.map((item) => (
              <a key={item.name} href={item.href}>
                <span className="sr-only">{item.name}</span>
                <img src={item.icon} className="icon" />
              </a>
            ))}
            <iframe
              src="https://ghbtns.com/github-btn.html?user=functionless&repo=functionless&type=star&count=true&size=small"
              frameBorder={0}
              scrolling="0"
              width="150"
              height="20"
              title="GitHub"
            ></iframe>
          </div>
        </nav>
        <p className="mt-8 md:text-center text-base text-gray-400">
          &copy; {new Date().getFullYear()} Functionless Corp. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
};
