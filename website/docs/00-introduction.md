---
sidebar_position: 0
---

# What is Functionless?

Functionless is a Typescript compiler plugin and a set of CDK constructs for configuring various AWS services with their own domain specific languages using familiar Typescript syntax. Before Functionless, you had to define VTL templates for AppSync, ASL for StepFunctions and EventBridge patterns for EventBridge. Now, you can write replace all these with plain Typescript!

Under the hood the Functionless compiler plugin will convert the Typescript code you write down to the appropriate target language. It supports most typical language constructs - loops, conditionals, etc - and will error when something isn't supported. The goal is to make it as easy as possible to write code that just works.
