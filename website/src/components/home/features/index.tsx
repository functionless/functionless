import useIsBrowser from "@docusaurus/useIsBrowser";
import { features } from "../../../content/home/features";
import { FeatureSection } from "./featureSection";

const scrollFactor = 0.55;

export const Features = () => {
  const isBrowser = useIsBrowser();
  return (
    <section className="py-16 home-features">
      {features.map((feature) => (
        <FeatureSection
          {...feature}
          height={
            isBrowser ? window.innerHeight * features.length * scrollFactor : 0
          }
        />
      ))}
    </section>
  );
};
