<div align="center">
  <a href="https://functionless.org">
    <img src="assets/logo-small.svg" />
  </a>
  <br />
  <h1>Functionless</h1>
  <h3>
  Build Code-first, Cloud-native applications<br />with serverless <b>Components</b> and easy-to-follow <b>Conventions</b>.
  </h3>
  <a href="https://badge.fury.io/js/functionless.svg">
    <img src="https://badge.fury.io/js/functionless.svg" />
  </a>
  <a href="https://github.com/functionless/functionless/blob/main/LICENSE">
    <img alt="MIT License" src="https://img.shields.io/github/license/functionless/functionless" />
  </a>
  <a href="https://discord.gg/VRqHbjrbfC">
    <img alt="Discord" src="https://img.shields.io/discord/985291961885949973?color=7389D8&label&logo=discord&logoColor=ffffff" />
  </a>
  <a href="https://twitter.com/_functionless">
    <img alt="Twitter" src="https://img.shields.io/twitter/url.svg?label=%40_fucntionless&style=social&url=https%3A%2F%2Ftwitter.com%2F_fucntionless" />
  </a>
</div>

---

> 🛠&nbsp; Functionless is in pre-release - come chat to us on Discord!

---

## Overview

**[Website](https://functionless.org/) • [API Docs](https://functionless.org/docs/what-is-functionless) • [Getting Started](https://functionless.org/docs/getting-started/setup)**

Functionless is a full-stack framework that enables you to easily build type-safe cloud applications on AWS serverless without writing CloudFormation or complex infrastructure configuration.

- 🪂&nbsp; Type-safe AWS cloud resources such as Rest APIs, GraphQL APIs, Lambda Functions, DynamoDB Tables, Step Functions, Event Bridge, and more.
- 👨‍💻&nbsp; Local development experience for AWS serverless.
- 🐞&nbsp; Instant feedback with step-through debugger.
- 🧙&nbsp; Architecture-aware CLI for operating, maintaining and testing cloud resources.
- 🔐&nbsp; Guaranteed least-privilege automatically derived IAM Policies.
- 🎢&nbsp; NextJS-like file system conventions for CloudFormation Stacks and APIs.
- 🧩&nbsp; Build and share custom re-usable cloud components.

## Quick Start

```sh
# create a new project
npx create-functionless@latest
cd <project-name>

# deploy to AWS
npx fl deploy

# open my-function in the AWS console
npx fl ./src/my-function console

# run your application locally
npx fl local
```

## Why Functionless?

Functionless re-imagines Infrastructure-as-Code (IaC) as Infrastructure-from-Code (IfC). Enjoy a streamlined developer experience for full stack developers without giving up control of your AWS infrastructure.

### 🧠 Intuitive

We provide guardrails to accelerate development of serverless applications. Use simple file system conventions to organize your cloud resources such as Stacks, APIs, Functions, Workflows, Databases, and more.

### 🚀 Productive

Designed for instant feedback. Catch errors in real-time before deployment with type-safe Runtime APIs; test and debug locally; automate operational tasks with an application-aware CLI experience.

![Type-safe Cloud Resources](assets/type-safe.gif)

### 👮‍♀️ Secure

Built with safety and security in mind. Our compiler automatically guarantees your serverless Resources are configured with IAM Policies that only have access to what they need - no more and no less.

### 💪 Powerful

Build and share custom components and integrate them into your application. Each component exposes a Runtime and Operational interface for production-ready use.
