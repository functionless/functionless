import { features } from "../../../content/home/features";
import { FeatureSection } from "./featureSection";

export const Features = () => {
  return (
    <section className="py-16 home-features">
      {features.map((feature) => (
        <FeatureSection {...feature} />
      ))}
    </section>
  );
};
