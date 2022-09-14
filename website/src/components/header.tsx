/* This example requires Tailwind CSS v2.0+ */
import { Popover, Transition } from "@headlessui/react";
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Fragment } from "react";

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

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export const Header = () => {
  return (
    <Popover className="relative bg-functionless-white dark:bg-functionless-black">
      <div className="flex items-center justify-between px-4 py-6 sm:px-6 md:justify-start md:space-x-10">
        <div>
          <a href="#" className="flex">
            <span className="sr-only">Your Company</span>
            <img
              className="h-8 w-auto sm:h-10"
              src="/img/logo/light.svg"
              alt=""
            />
          </a>
        </div>
        <div className="-my-2 -mr-2 md:hidden">
          <Popover.Button className="inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
            <span className="sr-only">Open menu</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </Popover.Button>
        </div>
        <div className="hidden md:flex md:flex-1 md:items-center md:justify-between">
          <Popover.Group as="nav" className="flex space-x-10">
            <a
              href="/docs"
              className="text-functionless-black dark:text-functionless-white hover:no-underline hover:text-functionless-blue"
            >
              Docs
            </a>
            <a
              href="/blog"
              className="text-functionless-black dark:text-functionless-white hover:no-underline hover:text-functionless-blue"
            >
              Blog
            </a>
            <a
              href="/team"
              className="text-functionless-black dark:text-functionless-white hover:no-underline hover:text-functionless-blue"
            >
              Team
            </a>
          </Popover.Group>
          <div className="flex-1 justify-center flex">
            <div className="relative mt-1 w-64">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <MagnifyingGlassIcon className="icon-small absolute" />
              </div>
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 rounded-full h-14"
              />
              <div className="absolute inset-y-0 right-2 flex py-1.5 pr-1.5">
                <kbd className="inline-flex items-center px-2 text-base bg-transparent border-none shadow-none">
                  ⌘ K
                </kbd>
              </div>
            </div>
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
        </div>
      </div>

      <Transition
        as={Fragment}
        enter="duration-200 ease-out"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="duration-100 ease-in"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <Popover.Panel
          focus
          className="absolute inset-x-0 top-0 origin-top-right transform p-2 transition md:hidden"
        >
          <div className="divide-y-2 divide-gray-50 rounded-lg bg-functionless-white dark:bg-functionless-black shadow-lg ring-1 ring-black ring-opacity-5">
            <div className="px-5 pt-5 pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <img
                    className="h-8 w-auto"
                    src="/img/logo/light.svg"
                    alt="Your Company"
                  />
                </div>
                <div className="-mr-2">
                  <Popover.Button className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none ring-0 border-none bg-transparent">
                    <span className="sr-only">Close menu</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </Popover.Button>
                </div>
              </div>
              <div className="mt-6">
                <nav className="grid gap-6">
                  {[].map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      className="-m-3 flex items-center rounded-lg p-3 hover:bg-gray-50"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-indigo-500 text-white">
                        <item.icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div className="ml-4 text-base font-medium text-gray-900">
                        {item.name}
                      </div>
                    </a>
                  ))}
                </nav>
              </div>
            </div>
            <div className="py-6 px-5">
              <div className="grid grid-cols-2 gap-4">
                {[].map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="text-base font-medium text-gray-900 hover:text-gray-700"
                  >
                    {item.name}
                  </a>
                ))}
              </div>
              <div className="mt-6"></div>
            </div>
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
};
