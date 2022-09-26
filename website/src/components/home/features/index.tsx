import { features } from "../../../content/home/features";
import { FeatureSection } from "./featureSection";

export const Features = () => {
  return (
    <section className="py-16 bg-functionless-bg-alternate dark:bg-functionless-dark-bg-alternate home-features sticky top-0">
      {features.map((feature) => (
        <FeatureSection {...feature} />
      ))}

      <div className="sticky top-0 h-48" />
    </section>
  );
};
