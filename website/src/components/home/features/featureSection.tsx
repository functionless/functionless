import { Feature } from "@site/src/lib/feature";
import clsx from "clsx";
import { FeatureText } from "./featureText";

export const FeatureSection = ({
  side,
  title,
  points,
  aside,
  footer,
}: Feature) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 tw-container xl:max-w-screen-xl lg:mt-24 lg:gap-11 gap-y-8">
    <div
      className={clsx(
        "col-span-2 lg:col-span-1 lg:row-start-1",
        side === "left" ? "lg:col-start-1" : "lg:col-start-2"
      )}
    >
      <FeatureText title={title} points={points} />
    </div>

    <div
      className={clsx(
        "hidden md:block col-span-2 lg:col-span-1 lg:row-start-1 my-8 lg:mt-0",
        side === "left" ? "lg:col-start-2" : "lg:col-start-1"
      )}
    >
      {aside()}
    </div>
    <div className="col-span-2">{footer?.()}</div>
  </div>
);
