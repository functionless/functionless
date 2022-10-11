export const config = {
  jsc: {
    parser: {
      syntax: "typescript",
      dynamicImport: false,
      decorators: false,
      hidden: {
        jest: true,
      },
    },
    transform: undefined,
    target: "es2022",
    loose: false,
    externalHelpers: false,
    experimental: {
      plugins: [["@functionless/ast-reflection", {}]],
    },
  },
  minify: true,
  sourceMaps: "inline",
  module: {
    type: "commonjs",
  },
} as const;
