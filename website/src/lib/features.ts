
import { Feature } from "./feature";

export const organizeAndOperate: Feature = {
  title: "Organize and operate",
  points: [{
    title: "Easy-to-follow conventions",
    body: "Structure your cloud stacks and resources with file system conventions optimized for simplicity and consistency."
  }, {
    title: "Application-aware CLI",
    body: "Interact with cloud resources using an intuitive and extensible CLI that understands your application's architecture."
  }]
}

export const codeTheWayYouThink: Feature = {
  title: "Develop naturally",
  points: [
    {
      title: "First-class cloud resources",
      body: "Import and interact with your cloud resources like ordinary functions - there’s no need for plumbing code or configuration.",
    },
    {
      title: "Automated IAM policies",
      body: "Our compiler derives minimal IAM Policies from your code, ensuring you only have access to what you need.",
    },
  ]
};

export const upgradeFromServerlessToFunctionless: Feature = {
  title: 'Upgrade to "functionless"',
  points: [
    {
      title: "Never compromise on architectural decisions",
      body: "Leverage the scalability and reliability of AWS Step Functions, Appsync and Event Bridge without learning domain specific languages.",
    },
    {
      title: "End-to-end type safety",
      body: "Catch bugs before they occur and enjoy Intellisense in your IDE with type-safety that works across service boundaries and runtime environments.",
    },
  ]
};

export const extendAndCompose: Feature = {
  title: "Extend and Compose",
  points: [
    {
      title: "Build, share and re-use",
      body: "Build custom components with their own runtime API and a purpose-built CLI experience for operators.",
    },
    {
      title: "CDK-compatible",
      body: "Integrate any AWS service or CDK Construct library into your application - always choose the right service for the job and never be forced by your framework.",
    },
  ]
};

