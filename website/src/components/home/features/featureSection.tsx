import { Feature } from "@site/src/lib/feature";
import { useVisibleScrollCallback } from "@site/src/lib/useVisibility";
import clsx from "clsx";
import { useRef } from "react";
import { FeatureText } from "./featureText";

export const FeatureSection = ({
  side,
  title,
  points,
  aside,
  footer,
}: Feature) => {
  const childGrid = useRef<HTMLDivElement>(null);
  let lastCentering = useRef(-999);
  const lastScroll = useRef(new Date().getTime());
  const ref = useVisibleScrollCallback<HTMLDivElement>(
    0.0,
    ({ y, boundingRect }) => {
      const centering = (y - boundingRect.top) / 192;
      // const direction = lastCentering.current < centering ? 1 : -1;
      // const recentlyScrolled = new Date().getTime() - lastScroll.current < 2000;
      // console.log({ centering, lastCentering, direction });
      // if (
      //   (centering > -1 && centering < 0 && direction === 1) ||
      //   (centering > 0 && centering < 1 && direction === -1)
      // ) {
      //   if (!recentlyScrolled) {
      //     // lastCentering.current = centering;
      //     // lastScroll.current = new Date().getTime();
      //     // window.scrollTo({ top: boundingRect.top, behavior: "smooth" });
      //   }
      // } else {
      //   lastCentering.current = centering;
      // }
      console.log(centering);
      requestAnimationFrame(() => {
        if (ref.current) {
          const opacity = Math.pow(1 - Math.min(1, Math.abs(centering)), 2);
          ref.current!.style.setProperty(
            "opacity",
            (opacity < 0.5 ? 0 : 1).toString()
          );
          // if (childGrid.current) {
          //   const offset = y - boundingRect.top;
          //   childGrid.current.style.transform = `translateY(${offset}px)`;
          // }
        }
      });
    }
  );
  // const { ref, visible } = useVisibility<HTMLDivElement>(0.9, {
  //   singleShot: false,
  // });
  return (
    <div
      ref={ref}
      className={clsx(
        "transition duration-500 opacity-0 ease-in-out lg:h-48 lg:width-screen"
      )}
    >
      <div className=" lg:bg-functionless-code lg:fixed lg:top-0 lg:left-0 lg:width-full lg:height-screen lg:flex lg:items-center lg:justify-center">
        <div
          ref={childGrid}
          className="container grid grid-cols-1 lg:grid-cols-2  gap-y-8 lg:gap-x-11"
        >
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
      </div>
    </div>
  );
};
