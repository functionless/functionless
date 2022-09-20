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
  <div className="grid grid-cols-1 md:grid-cols-2 container !max-w-screen-xl my-36 gap-11 snap-start scroll-m-28">
    <FeatureText {...feature} />
    {aside}
    <div className="col-span-2">{footer}</div>
  </div>
);
