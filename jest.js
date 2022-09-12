const swcJest = require("@swc/jest");

function createTransformer() {
  return swcJest.createTransformer({
    jsc: {
      parser: {
        syntax: "typescript",
        dynamicImport: false,
        decorators: false,
        hidden: {
          jest: true,
        },
      },
      transform: null,
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
  });
}

module.exports = { createTransformer };
