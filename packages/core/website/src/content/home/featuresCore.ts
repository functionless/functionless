export const title = "WHY FUNCTIONLESS?";
export const subtitle = "Our framework makes your Cloud Resources smarter.";

export interface FeatureCore {
  icon: string;
  title: string;
  body: string;
}
export const features = [
  {
    icon: "/img/shapes/7.svg",
    title: "Unified Cloud Components",
    body: "Cloud Resources have both a runtime and deployment-time API that is traditionally considered separate. Smart Cloud Resources unify these two surface areas to enable composable, higher-order abstractions for the cloud.",
  },
  {
    icon: "/img/shapes/3.svg",
    title: "Secure by Default",
    body: "IAM Policies for your service’s IAM Roles are derived from your application logic to guarantee the granted permissions are only the minimal set. The best security auditor is a verifiable, proactive and fully automated compiler.",
  },
  {
    icon: "/img/shapes/4.svg",
    title: "Familiar Programming Constructs",
    body: "Building on the cloud should be no different than a local machine - just write and call functions, create classes and compose them together into an application. Cloud Resource configuration is the compiler’s job.",
  },
];
