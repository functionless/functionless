// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");
const path = require("path");

const url =
  process.env.CONTEXT === "deploy-preview"
    ? process.env.DEPLOY_PRIME_URL
    : "https://functionless.org";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Functionless",
  tagline: "Unified Infrastructure and Application Code",
  // use the deploy url when building for preview
  // https://docs.netlify.com/configure-builds/environment-variables/#read-only-variables
  url,
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/Logo-fav.svg",
  organizationName: "functionless",
  projectName: "functionless",

  // see: https://www.npmjs.com/package/docusaurus-plugin-typedoc
  // options: https://github.com/tgreyuk/typedoc-plugin-markdown/blob/master/packages/docusaurus-plugin-typedoc/src/options.ts#L3-L26
  plugins: [
    [
      "docusaurus-plugin-typedoc",
      // Plugin / TypeDoc options
      {
        entryPoints: ["../src/index.ts"],
        tsconfig: "../tsconfig.json",
        sidebar: {
          categoryLabel: "API Reference",
          position: 10,
        },
      },
    ],
    function () {
      return {
        name: "functionless-error-code-docs",
        loadContent: () =>
          // run the compile-error-code-page CLI after typedoc is run by `docusaurus-plugin-typedoc`
          require(path.join(
            __dirname,
            "..",
            "scripts",
            "compile-error-code-page"
          )),
      };
    },
  ],

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl:
            "https://github.com/functionless/functionless/edit/main/website/",
          remarkPlugins: [require("mdx-mermaid")],
        },
        blog: {
          showReadingTime: true,
          editUrl:
            "https://github.com/functionless/functionless/edit/main/website/",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],
  // https://buttons.github.io/
  scripts: [
    { src: "https://buttons.github.io/buttons.js", async: true, defer: true },
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // default page image, override using frontMatter `image`
      // https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs#markdown-front-matter
      image: "img/logo.png",
      metadata: [
        { property: "og:type", content: "article" },
        { property: "og:image:width", content: "233" },
        { property: "og:image:height", content: "200" },
        { property: "og:image:secure_url", content: `${url}/img/logo.png` },
      ],
      // light color mode disabled for now
      colorMode: {
        defaultMode: "dark",
        disableSwitch: true,
      },
      prism: {
        additionalLanguages: ["graphql"],
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
      navbar: {
        title: "Functionless",
        logo: {
          alt: "λ<",
          src: "img/Logo.svg",
          srcDark: "img/Logo-dark.svg",
        },
        items: [
          {
            type: "doc",
            docId: "what-is-functionless",
            position: "left",
            label: "Documentation",
          },
          { to: "/blog", label: "Blog", position: "left" },
          {
            href: "https://github.com/functionless/functionless",
            position: "right",
            className: "header-github-link",
            "aria-label": "GitHub Repository",
          },
          {
            href: "https://discord.gg/VRqHbjrbfC",
            position: "right",
            className: "navbar-community-menu",
            "aria-label": "Discord Community",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              {
                label: "Introduction",
                to: "/docs/what-is-functionless",
              },
            ],
          },
          // {
          //   title: "Community",
          //   items: [
          //     {
          //       label: "Stack Overflow",
          //       href: "https://stackoverflow.com/questions/tagged/docusaurus",
          //     },
          //     {
          //       label: "Discord",
          //       href: "https://discordapp.com/invite/docusaurus",
          //     },
          //     {
          //       label: "Twitter",
          //       href: "https://twitter.com/docusaurus",
          //     },
          //   ],
          // },
          {
            title: "More",
            items: [
              {
                label: "Blog",
                to: "/blog",
              },
              {
                label: "GitHub",
                href: "https://github.com/functionless/functionless",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Functionless`,
      },
    }),
};

module.exports = config;
