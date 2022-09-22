import { Feature } from "@site/src/lib/feature";
import { ReactElement } from "react";
import { FeatureText } from "./featureText";

export const FeatureSection = ({
  feature,
  aside,
  footer,
}: {
  feature: Feature;
  aside: ReactElement;
  footer?: ReactElement;
}) => (
  <div className="grid grid-cols-2 container md:mt-36 gap-11 scroll-snap-point">
    <div className="col-span-2 lg:col-span-1">
      <FeatureText {...feature} />
    </div>

    <div className="col-span-2 lg:col-span-1">{aside}</div>
    <div className="col-span-2">{footer}</div>
  </div>
);
