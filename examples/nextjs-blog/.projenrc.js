const { FunctionlessProject } = require("@functionless/projen");
const project = new FunctionlessProject({
  cdkVersion: "2.1.0",
  defaultReleaseBranch: "main",
  scripts: {
    "next:dev": "next dev",
    "next:build": "next build",
    "next:start": "next start",
    "next:lint": "next lint",
  },
  deps: ["classnames", "next", "react", "react-dom"],
  devDeps: [
    "@types/classnames",
    "@types/react",
    "@functionless/projen",
    "tailwindcss",
    "postcss",
    "autoprefixer",
  ],
  eslint: false,
  eslintOptions: {
    ignorePatterns: ["**/*"],
  },
  name: "nextjs-blog",
  tsconfig: {
    compilerOptions: {
      rootDir: ".",
      jsx: "react",
    },
    include: [
      "next-env.d.ts",
      "public/**/*.tsx",
      "pages/**/*.tsx",
      "components/**/*.tsx",
    ],
  },
});
project.synth();
