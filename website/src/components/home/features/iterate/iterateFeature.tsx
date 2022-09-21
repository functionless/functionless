import { iterate } from "@site/src/content/features/iterate/iterate";
import { FeatureSection } from "../featureSection";
import { IterateCode } from "./iterateCode";

export const IterateFeature = () => (
  <FeatureSection feature={iterate} aside={<IterateCode />} />
);
