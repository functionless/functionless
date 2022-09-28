import useIsBrowser from "@docusaurus/useIsBrowser";
import { features } from "../../../content/home/features";
import { FeatureSection } from "./featureSection";

export const Features = () => {
  const isBrowser = useIsBrowser();
  return (
    <section className="py-16 home-features">
      {features.map((feature) => (
        <FeatureSection
          {...feature}
          height={isBrowser ? window.innerHeight * features.length : 0}
        />
      ))}
    </section>
  );
};
