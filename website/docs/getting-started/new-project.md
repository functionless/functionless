---
sidebar_position: 0
---

# Creating a new project

To create a new project, run the following command.
```sh
npx projen new --from functionless-projen
```

This will create a new folder containing a CDK application with Functionless installed using the [Projen](https://github.com/projen/projen) template tool.

# Deploy to AWS

Functionless is a library that integrates directly into a standard CDK application. To deploy, first set up your AWS CLI and AWS account for CDK development (see the official [AWS CDK docs](TODO)), and then use the `cdk` CLI as usual: 
```bash
cdk deploy
```

For convenience, your new project comes with a `deploy` script:
```bash
# if using yarn
yarn deploy

# if using NPM
npm run deploy
```

# Manual Install

To understand the Functionless configuration or manually integrate into an existing CDK application without projen, see the [Add to an existing CDK project](./manual-install.md) documentation.