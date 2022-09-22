// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const codeTheme = require("./src/theme/code-theme");
const path = require("path");

const url =
  process.env.CONTEXT === "deploy-preview" && process.env.DEPLOY_PRIME_URL
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
      "./src/plugins/docusaurus-plugin-content-blog",
      {
        showReadingTime: true,
        editUrl:
          "https://github.com/functionless/functionless/edit/main/website/",
      },
    ],
    async function myPlugin(context, options) {
      return {
        name: "docusaurus-tailwindcss",
        configurePostCss(postcssOptions) {
          // Appends TailwindCSS and AutoPrefixer.
          postcssOptions.plugins.push(require("tailwindcss"));
          postcssOptions.plugins.push(require("autoprefixer"));
          return postcssOptions;
        },
      };
    },
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
  stylesheets: [
    "https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap",
    "https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap",
    "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@100;200;300;400;500;600;700;800;900&display=swap",
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
        blog: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
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
        disableSwitch: false,
      },
      prism: {
        additionalLanguages: ["graphql"],
        theme: codeTheme,
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
            label: "Docs",
          },
          { to: "/blog", label: "Blog", position: "left" },
          {
            to: "/team",
            label: "Team",
            position: "left",
          },
          {
            href: "https://discord.gg/VRqHbjrbfC",
            html: '<img src="/img/social/discord.svg" />',
            position: "right",
          },
          {
            href: "https://twitter.com/_functionless",
            html: '<img src="/img/social/twitter.svg" />',
            position: "right",
          },
          {
            href: "https://github.com/functionless/functionless",
            html: '<img src="/img/social/github.svg" />',
            position: "right",
          },
        ],
      },
      footer: {},
      algolia: {
        // The application ID provided by Algolia
        appId: "YOUR_APP_ID",

        // Public API key: it is safe to commit it
        apiKey: "YOUR_SEARCH_API_KEY",

        indexName: "YOUR_INDEX_NAME",

        // Optional: see doc section below
        contextualSearch: true,

        // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
        externalUrlRegex: "[]",

        // Optional: Algolia search parameters
        searchParameters: {},

        // Optional: path for search page that enabled by default (`false` to disable it)
        searchPagePath: "search",

        //... other Algolia params
      },
    }),
};

module.exports = config;
