exports.config = {
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
  minify: false,
  sourceMaps: "inline",
  inlineSourcesContent: false,
  module: {
    type: "commonjs",
  },
};
