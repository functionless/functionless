import { Tab } from "@headlessui/react";
import {
  ChevronLeftIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/20/solid";
import { Fragment } from "react";
import { Code } from "../components/code";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { Social } from "../components/social";
import { Subscribe } from "../components/subscribe";
import { Team } from "../components/team";
import { Testimonial } from "../components/testimonial";

const StyleGuide = () => {
  return (
    <div className="min-h-screen bg-functionless-bg dark:bg-functionless-dark-bg">
      <div className="container py-12 space-y-14">
        <div>
          <h5>Text</h5>
          <div className="space-y-7">
            <h1>h1</h1>
            <h2>h2</h2>
            <h3>h3</h3>
            <h4>h4</h4>
            <h5>h5</h5>
            <h6>h6</h6>
            <label>Label</label>
            <div className="subtitle1">Subtitle 1</div>
            <div className="subtitle2">Subtitle 2</div>
            <p className="body1">Body 1</p>
            <p className="body2">Body 2</p>
            <div className="over">Overline</div>
          </div>
        </div>
        <div>
          <h5>Buttons</h5>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <button className="solid-button-large">
                Solid Button Large
                <ChevronLeftIcon className="icon ml-2" />
              </button>
            </div>
            <div>
              <button className="solid-button">
                Solid Button <ChevronLeftIcon className="icon ml-2" />
              </button>
            </div>
            <div>
              <button className="solid-button-small">
                Solid Button Small
                <ChevronLeftIcon className="icon ml-2" />
              </button>
            </div>
            <div>
              <button className="outline-button-large">
                Outline Button Large
                <ChevronLeftIcon className="icon ml-2" />
              </button>
            </div>
            <div>
              <button className="outline-button">
                Outline Button <ChevronLeftIcon className="icon ml-2" />
              </button>
            </div>
            <div>
              <button className="outline-button-small">
                Outline Button Small
                <ChevronLeftIcon className="icon ml-2" />
              </button>
            </div>
            <div>
              <button className="text-button-large">
                Text Button Large
                <ChevronLeftIcon className="icon ml-2" />
              </button>
            </div>
            <div>
              <button className="text-button">
                Text Button <ChevronLeftIcon className="icon ml-2" />
              </button>
            </div>
            <div>
              <button className="text-button-small">
                Text Button Small
                <ChevronLeftIcon className="icon ml-2" />
              </button>
            </div>
            <div>
              <button className="bg-functionless-github social-button">
                <img src="/img/social/github.svg" className="icon-large mr-2" />
                Star us on Github
              </button>
            </div>
            <div>
              <button className="bg-functionless-discord social-button">
                <img
                  src="/img/social/discord.svg"
                  className="icon-large mr-2"
                />
                Join our Discord
              </button>
            </div>
            <div>
              <button className="bg-functionless-twitter social-button">
                <img
                  src="/img/social/twitter.svg"
                  className="icon-large mr-2"
                />
                Follow us on Twitter
              </button>
            </div>
          </div>
        </div>
        <div>
          <h5>Chips</h5>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <span className="blue-chip">Blue chip</span>
            </div>
            <div>
              <span className="blue-chip">
                Blue chip
                <ChevronLeftIcon className="icon-small ml-1.5" />
              </span>
            </div>
            <div>
              <span className="purple-chip">Purple chip</span>
            </div>
            <div>
              <span className="purple-chip">
                Purple chip
                <ChevronLeftIcon className="icon-small ml-1.5" />
              </span>
            </div>
            <div>
              <span className="green-chip">Green chip</span>
            </div>
            <div>
              <span className="green-chip">
                Green chip
                <ChevronLeftIcon className="icon-small ml-1.5" />
              </span>
            </div>
            <div>
              <span className="yellow-chip">Yellow chip</span>
            </div>
            <div>
              <span className="yellow-chip">
                Yellow chip
                <ChevronLeftIcon className="icon-small ml-1.5" />
              </span>
            </div>
          </div>
        </div>
        <div>
          <h5>Inputs</h5>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <input type="text" placeholder="Text" className="round" />
            </div>
            <div>
              <input type="number" placeholder="Number" className="round" />
            </div>
            <div>
              <input type="email" placeholder="Email" className="round" />
            </div>
            <div>
              <input type="password" placeholder="Password" className="round" />
            </div>
            <div>
              <input
                type="datetime-local"
                placeholder="Date & Time"
                className="round"
              />
            </div>
            <div>
              <textarea placeholder="Text area" className="round" />
            </div>
            <div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter email address"
                  className="px-6 py-18 h-14 rounded-full"
                />
                <div className="absolute inset-y-1 right-1">
                  <button className="solid-button-small">Subscribe</button>
                </div>
              </div>
            </div>
            <div>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
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
          </div>
        </div>
        <div>
          <h5>Selections</h5>
          <div>
            <Tab.Group>
              <Tab.List>
                <Tab as={Fragment}>
                  {({ selected }) => (
                    <button
                      className={selected ? "tab-active" : "tab-inactive"}
                    >
                      Lambda functions
                    </button>
                  )}
                </Tab>
                <Tab as={Fragment}>
                  {({ selected }) => (
                    <button
                      className={selected ? "tab-active" : "tab-inactive"}
                    >
                      Step functions
                    </button>
                  )}
                </Tab>
                <Tab as={Fragment}>
                  {({ selected }) => (
                    <button
                      className={selected ? "tab-active" : "tab-inactive"}
                    >
                      Appsync resolvers
                    </button>
                  )}
                </Tab>
              </Tab.List>
            </Tab.Group>
          </div>
        </div>
        <div>
          <h5>Selections</h5>
          <div></div>
        </div>
        <div>
          <h5>Dark Colors</h5>
          <div className="grid grid-cols-5 gap-4">
            <div className="w-full aspect-1 bg-functionless-dark-bg"></div>
            <div className="w-full aspect-1 bg-functionless-dark-bg-alternate"></div>
            <div className="w-full aspect-1 bg-functionless-dark-high"></div>
            <div className="w-full aspect-1 bg-functionless-dark-medium"></div>
            <div className="w-full aspect-1 bg-functionless-dark-border"></div>
          </div>
        </div>
        <div>
          <h5>Light Colors</h5>
          <div className="grid grid-cols-5 gap-4">
            <div className="w-full aspect-1 bg-functionless-bg"></div>
            <div className="w-full aspect-1 bg-functionless-bg-alternate"></div>
            <div className="w-full aspect-1 bg-functionless-high"></div>
            <div className="w-full aspect-1 bg-functionless-medium"></div>
            <div className="w-full aspect-1 bg-functionless-border"></div>
          </div>
        </div>
        <div>
          <h5>Accent Colors</h5>
          <div className="grid grid-cols-5 gap-4">
            <div className="w-full aspect-1 bg-functionless-blue"></div>
            <div className="w-full aspect-1 bg-functionless-purple"></div>
            <div className="w-full aspect-1 bg-functionless-green"></div>
            <div className="w-full aspect-1 bg-functionless-yellow"></div>
            <div className="w-full aspect-1 bg-functionless-code"></div>
          </div>
        </div>
        <div>
          <h5>Gradients</h5>
          <div className="grid grid-cols-5 gap-4">
            <div className="w-full aspect-1 code-gradient"></div>
          </div>
        </div>
        <div>
          <h5>Shadows</h5>
          <div className="grid grid-cols-5 gap-4">
            <div className="w-full aspect-1 shadow-dark"></div>
            <div className="w-full aspect-1 shadow-light"></div>
          </div>
        </div>
        <div>
          <h5>Cards</h5>
          <div className="grid grid-cols-2 gap-11">
            <div>
              <Social />
            </div>
            <div>
              <Testimonial />
            </div>
            <div className="col-span-2">
              <Subscribe />
            </div>
            <div>
              <Team />
            </div>
            <div>
              <Code />
            </div>
          </div>
        </div>
        <div>
          <h5>Navigation</h5>
          <div className="space-y-7">
            <Header />
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StyleGuide;
