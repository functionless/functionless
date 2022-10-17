# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.28.5](https://github.com/functionless/functionless/compare/v0.28.4...v0.28.5) (2022-10-17)

### Bug Fixes

- create-functionless ts output config and gitignore ([#571](https://github.com/functionless/functionless/issues/571)) ([f2bbf85](https://github.com/functionless/functionless/commit/f2bbf851e1ec6599c313bcd60d9c558621a25775))

## [0.28.4](https://github.com/functionless/functionless/compare/v0.28.3...v0.28.4) (2022-10-17)

### Bug Fixes

- support lambda props and env ([#570](https://github.com/functionless/functionless/issues/570)) ([25bcf86](https://github.com/functionless/functionless/commit/25bcf8673dbbe438efa5159811841b39dd263bbb))

## [0.28.3](https://github.com/functionless/functionless/compare/v0.28.2...v0.28.3) (2022-10-15)

**Note:** Version bump only for package functionless-monorepo

## [0.28.2](https://github.com/functionless/functionless/compare/v0.28.1...v0.28.2) (2022-10-14)

**Note:** Version bump only for package functionless-monorepo

## [0.28.1](https://github.com/functionless/functionless/compare/v0.28.0...v0.28.1) (2022-10-14)

### Bug Fixes

- esbuild should output to lib ([#564](https://github.com/functionless/functionless/issues/564)) ([1e7689e](https://github.com/functionless/functionless/commit/1e7689e5604ae6d6568b49ef41425755496b642f))
- prevent overwrite on existing packages ([#566](https://github.com/functionless/functionless/issues/566)) ([b554167](https://github.com/functionless/functionless/commit/b554167088378f5666b3d31009b5a1b26496153d))

# [0.28.0](https://github.com/functionless/functionless/compare/v0.27.4...v0.28.0) (2022-10-14)

### Bug Fixes

- add test:smoke command ([#561](https://github.com/functionless/functionless/issues/561)) ([0bf017c](https://github.com/functionless/functionless/commit/0bf017c048eccf2893d1e854a8f9f169eab49a54))
- disable smoke test as it is entirely broken ([#562](https://github.com/functionless/functionless/issues/562)) ([b4013ad](https://github.com/functionless/functionless/commit/b4013ad7a5588578c6d6395cbf5a3a574455f4ad))

### chore

- refactor aws-constructs into individual packages ([#552](https://github.com/functionless/functionless/issues/552)) ([01a2c9f](https://github.com/functionless/functionless/commit/01a2c9ff714e811f679ab25d9d62722e535eaf6b))

### BREAKING CHANGES

- @functionless/aws-constructs package has been refactored into many service-specific packages.

## [0.27.4](https://github.com/functionless/functionless/compare/v0.27.3...v0.27.4) (2022-10-13)

### Bug Fixes

- update project to reflect lib as outdir ([#559](https://github.com/functionless/functionless/issues/559)) ([5a8e5bf](https://github.com/functionless/functionless/commit/5a8e5bf6d3e146f864e1cf9fe71e92ee78f4ab3b))

## [0.27.3](https://github.com/functionless/functionless/compare/v0.27.2...v0.27.3) (2022-10-12)

### Bug Fixes

- **website:** fix scrolling of docs sidebar when longer than screen height ([#556](https://github.com/functionless/functionless/issues/556)) ([60ebcd4](https://github.com/functionless/functionless/commit/60ebcd4ab58d7f8363cf9a646b4e74c98b2ece64))

## [0.27.2](https://github.com/functionless/functionless/compare/v0.27.1...v0.27.2) (2022-10-11)

**Note:** Version bump only for package functionless-monorepo

## [0.27.1](https://github.com/functionless/functionless/compare/v0.27.0...v0.27.1) (2022-10-07)

**Note:** Version bump only for package functionless-monorepo

# [0.27.0](https://github.com/functionless/functionless/compare/v0.26.0...v0.27.0) (2022-10-06)

### chore

- refactor AST code into @functionless/ast ([#541](https://github.com/functionless/functionless/issues/541)) ([8e7b596](https://github.com/functionless/functionless/commit/8e7b5965f39dd3be195c70c7e1bde984afef8aab))

### BREAKING CHANGES

- AST nodes moded to new package @functionless/ast

# [0.26.0](https://github.com/functionless/functionless/compare/v0.25.1...v0.26.0) (2022-10-06)

### chore

- @functionless/aws, util, aws-util ([#540](https://github.com/functionless/functionless/issues/540)) ([d72d0a0](https://github.com/functionless/functionless/commit/d72d0a0c2c9e5b004bad170b022f268510ebb637))

### BREAKING CHANGES

- move fl-exp/interface to @functionless/aws

## [0.25.1](https://github.com/functionless/functionless/compare/v0.25.0...v0.25.1) (2022-10-06)

**Note:** Version bump only for package functionless-monorepo

# [0.25.0](https://github.com/functionless/functionless/compare/v0.24.6...v0.25.0) (2022-10-06)

### chore

- @functionless/aws-constructs, register, jest and swc-config ([#542](https://github.com/functionless/functionless/issues/542)) ([6c9ac66](https://github.com/functionless/functionless/commit/6c9ac66b7ef6674f7666be918f1e7f04146827c3))

### BREAKING CHANGES

- functionless moved to @functionless/aws-constructs and functionless is now an aggregation package.

## [0.24.6](https://github.com/functionless/functionless/compare/v0.24.5...v0.24.6) (2022-10-06)

**Note:** Version bump only for package functionless-monorepo

## [0.24.5](https://github.com/functionless/functionless/compare/v0.24.4...v0.24.5) (2022-10-06)

**Note:** Version bump only for package functionless-monorepo

## [0.24.4](https://github.com/functionless/functionless/compare/v0.24.3...v0.24.4) (2022-10-06)

### Bug Fixes

- reset versions in imported packages and run build on PR ([#543](https://github.com/functionless/functionless/issues/543)) ([9f54974](https://github.com/functionless/functionless/commit/9f549743050666a9ee7b259076fdde1079121ccf))

## [0.24.3](https://github.com/functionless/functionless/compare/v0.24.2...v0.24.3) (2022-10-05)

### Bug Fixes

- use turbo repo for task orchestration ([#535](https://github.com/functionless/functionless/issues/535)) ([b34e41a](https://github.com/functionless/functionless/commit/b34e41ac95c782539bdcc65cf6a10202bf3f31fe))

## [0.24.2](https://github.com/functionless/functionless/compare/v0.24.1...v0.24.2) (2022-10-05)

**Note:** Version bump only for package functionless-monorepo

## [0.24.1](https://github.com/functionless/functionless/compare/v0.24.0...v0.24.1) (2022-10-05)

### Bug Fixes

- update snapshots ([#532](https://github.com/functionless/functionless/issues/532)) ([0208138](https://github.com/functionless/functionless/commit/0208138fd46ea11d9c35990cf741fa424078b65a))

# [0.24.0](https://github.com/functionless/functionless/compare/v0.23.6...v0.24.0) (2022-10-04)

### Bug Fixes

- convert to turborepo monorepo ([#530](https://github.com/functionless/functionless/issues/530)) ([b6eb3d6](https://github.com/functionless/functionless/commit/b6eb3d6bc017ad4f83cf059708ac13d804f40a0b))
- release task failing due to missing projen dep ([#531](https://github.com/functionless/functionless/issues/531)) ([0e77293](https://github.com/functionless/functionless/commit/0e77293ef68388652c6c274184ea4e10fa1767c1))

### Features

- use lerna for versioning and publishing ([#534](https://github.com/functionless/functionless/issues/534)) ([af9c746](https://github.com/functionless/functionless/commit/af9c7468e5bca9e1780a033102fc985e5f92d88b))
