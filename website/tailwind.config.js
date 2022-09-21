/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  corePlugins: {
    // preflight: false, // TODO: Added to style default docusaurus components
  },
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      padding: {
        4.5: "18px",
      },
      boxShadow: {
        dark: "0px 0px 24px 8px rgba(50,183,255,0.16)",
        light: "0px 0px 24px 8px rgba(0,0,0,0.12)",
      },
      animation: {
        "fade-in": "fadeIn 0.05s linear 0s 1 normal forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
      },
      colors: {
        blue: {
          50: "#E2F5FF",
          100: "#B5E5FF",
          200: "#84D5FF",
          300: "#53C4FF",
          400: "#32B7FF",
          500: "#21AAFD",
          600: "#219CEE",
          700: "#2189D9",
          800: "#1E78C5",
          900: "#1D57A2",
        },
        purple: {
          50: "#F4EBFF",
          100: "#E1CDFE",
          200: "#CDABFF",
          300: "#B986FF",
          400: "#A767FD",
          500: "#954BF5",
          600: "#8A45EE",
          700: "#7B3CE4",
          800: "#6E36DC",
          900: "#5928CD",
        },
        green: {
          50: "#DFF6EC",
          100: "#B1E9CF",
          200: "#78DAB1",
          300: "#14CC92",
          400: "#00C07A",
          500: "#00B364",
          600: "#00A459",
          700: "#00924C",
          800: "#00803F",
          900: "#006029",
        },
        yellow: {
          50: "#FFF4DF",
          100: "#FFE3AF",
          200: "#FFD07B",
          300: "#FFBC42",
          400: "#FFAE03",
          500: "#FF9F00",
          600: "#FD9300",
          700: "#F88300",
          800: "#F27200",
          900: "#EB5700",
        },
        gray: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
        },
        functionless: {
          black: "#01121C",
          white: "#FFFFFF",
          blue: "#32B7FF",
          purple: "#B986FF",
          green: "#14CC92",
          yellow: "#FFBC42",
          border: "#E5E7EB",
          code: "#002333",
          "dark-border": "#18394D",
          "dark-bg": "#01121C",
          "dark-bg-tinted": "#01121CCC",
          "dark-bg-alternate": "#021A29",
          "dark-high": "#FFFFFF",
          "dark-medium": "#B3BABF",
          bg: "#FFFFFF",
          "bg-tinted": "#FFFFFFCC",
          "bg-alternate": "#F6F6F6",
          high: "#01121C",
          medium: "#374151",
          discord: "#4A61FC",
          github: "#01121C",
          twitter: "#1D9BF0",
        },
      },
      fontFamily: {
        display: ["Public Sans"],
        body: ["Inter"],
        mono: ["Roboto Mono"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/aspect-ratio"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/line-clamp"),
    require("tailwind-children"),
  ],
};
