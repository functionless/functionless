import { code } from "@site/src/content/features/code/code";
import { FeatureSection } from "../featureSection";
import { CodeTabs } from "./codeTabs";

export const CodeFeature = () => (
  <FeatureSection feature={code} aside={<CodeTabs />} />
);
