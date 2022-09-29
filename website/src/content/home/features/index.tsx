import { Aside as AsideDevelopNaturally } from "@site/src/components/home/features/asides/develop-naturally";
import { Aside as AsideOrganiseOperate } from "@site/src/components/home/features/asides/organise-operate";
import { Aside as AsideUpgrade } from "@site/src/components/home/features/asides/upgrade";
import { Feature } from "@site/src/lib/feature";

export const features: Feature[] = [
  {
    key: "organise-and-operate",
    side: "left",
    title: "Organize and Operate",
    points: [
      {
        title: "Easy-to-follow conventions",
        body: "Structure your cloud stacks and resources with file system conventions optimized for simplicity and consistency.",
      },
      {
        title: "Application-aware CLI",
        body: "Interact with cloud resources using an intuitive and extensible CLI that understands your application's architecture.",
      },
    ],
    aside: AsideOrganiseOperate,
  },
  {
    key: "develop-naturally",
    side: "right",
    title: "Develop Naturally",
    points: [
      {
        title: "First-class cloud resources",
        body: "Import and interact with your cloud resources like ordinary functions - there’s no need for plumbing code or configuration.",
      },
      {
        title: "Automated IAM policies",
        body: "Our compiler derives minimal IAM Policies from your code, ensuring you only have access to what you need.",
      },
    ],
    aside: AsideDevelopNaturally,
  },
  {
    key: "upgrade",
    side: "left",
    title: 'Upgrade to "Functionless"',
    points: [
      {
        title: "Never compromise on architectural decisions",
        body: "Leverage the scalability and reliability of AWS Step Functions, Appsync and Event Bridge without learning domain specific languages.",
      },
      {
        title: "End-to-end type safety",
        body: "Catch bugs before they occur and enjoy Intellisense in your IDE with type-safety that works across service boundaries and runtime environments.",
      },
    ],
    aside: AsideUpgrade,
  },
];
