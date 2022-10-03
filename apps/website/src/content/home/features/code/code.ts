import type { Feature } from "@site/src/lib/feature";

export const tab1 = "Lambda function";
export const tab2 = "Step function";
export const tab3 = "Appsync resolver";

export const code: Feature = {
  title: "Code",
  points: [
    {
      title: "Infrastructure from code",
      body: "Build functionless architectures using TypeScript syntax instead of cumbersome and error-prone service-specific domain specific languages.",
    },
    {
      title: "Automated IAM policies",
      body: "The best security auditor is no auditor - our compiler derives minimal IAM Policies from your code.",
    },
  ],
};
