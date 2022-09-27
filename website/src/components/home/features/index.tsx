import { features } from "../../../content/home/features";
import { FeatureSection } from "./featureSection";

export const Features = () => (
  <section className="py-16 home-features">
    {features.map((feature) => (
      <FeatureSection
        {...feature}
        height={window.innerHeight * features.length}
      />
    ))}
  </section>
);
