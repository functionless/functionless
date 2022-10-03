/** @type {import("prism-react-renderer").PrismTheme} */
const theme = {
  plain: {
    color: "#f8f8f2",
    backgroundColor: "#002333",
  },
  styles: [
    {
      types: ["changed"],
      style: {
        color: "rgb(162, 191, 252)",
        fontStyle: "italic",
      },
    },
    {
      types: ["deleted"],
      style: {
        color: "#f92672",
        fontStyle: "italic",
      },
    },
    {
      types: ["inserted"],
      style: {
        color: "rgb(173, 219, 103)",
        fontStyle: "italic",
      },
    },
    {
      types: ["comment"],
      style: {
        color: "#8292a2",
        fontStyle: "italic",
      },
    },
    {
      types: ["string", "url"],
      style: {
        color: "#14CC92",
      },
    },
    {
      types: ["variable"],
      style: {
        color: "#f8f8f2",
      },
    },
    {
      types: ["number"],
      style: {
        color: "#ae81ff",
      },
    },
    {
      types: ["class-name"],
      style: {
        color: "#B986FF",
      },
    },
    {
      types: ["builtin", "char", "constant", "function"],
      style: {
        color: "#ffbc42",
      },
    },
    {
      types: ["punctuation"],
      style: {
        color: "#f8f8f2",
      },
    },
    {
      types: ["selector", "doctype"],
      style: {
        color: "#a6e22e",
        fontStyle: "italic",
      },
    },
    {
      types: ["tag", "operator", "keyword"],
      style: {
        color: "#32B7FF",
      },
    },
    {
      types: ["boolean"],
      style: {
        color: "#ae81ff",
      },
    },
    {
      types: ["namespace"],
      style: {
        color: "rgb(178, 204, 214)",
        opacity: 0.7,
      },
    },
    {
      types: ["tag", "property"],
      style: {
        color: "#32B7FF",
      },
    },
    {
      types: ["attr-name"],
      style: {
        color: "#a6e22e !important",
      },
    },
    {
      types: ["doctype"],
      style: {
        color: "#8292a2",
      },
    },
    {
      types: ["rule"],
      style: {
        color: "#e6db74",
      },
    },
  ],
};

module.exports = theme;
