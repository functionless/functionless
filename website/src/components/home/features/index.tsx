import { Observable } from "@site/src/lib/observable";
import {
  ScrollParams,
  useVisibility,
  useVisibleScrollCallback,
} from "@site/src/lib/useVisibility";
import { useRef } from "react";
import { features } from "../../../content/home/features";
import { FeatureSection } from "./featureSection";

export const Features = () => {
  const scrollObservable = useRef(new Observable<ScrollParams>());
  const ref = useVisibleScrollCallback(
    0,
    (params) => {
      scrollObservable.current.onNext(params);
    },
    [scrollObservable.current]
  );

  return (
    <section ref={ref} className="py-16 home-features">
      {features.map((feature) => (
        <FeatureSection
          {...feature}
          height={window.innerHeight * features.length}
          scrollObservable={scrollObservable.current}
        />
      ))}

      <div className="sticky top-0" />
    </section>
  );
};
