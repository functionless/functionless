import { Feature } from "@site/src/lib/feature";
import { Observable } from "@site/src/lib/observable";
import {
  ScrollParams,
  useVisibleScrollCallback,
} from "@site/src/lib/useVisibility";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

export const FeatureSection = ({
  side,
  title,
  points,
  aside,
  footer,
  height,
  scrollObservable,
}: Feature & {
  height: number;
  scrollObservable: Observable<ScrollParams>;
}) => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const ref = useVisibleScrollCallback<HTMLDivElement>(
    0,
    ({ y: scrollY, boundingRect }) => {
      requestAnimationFrame(() => {
        if (titleRef.current && bodyRef.current) {
          const baseFactor = boundingRect.y - scrollY;
          const transform = baseFactor / (boundingRect.height / 50);
          const titleOpacity =
            1 - Math.min(1, baseFactor / (boundingRect.height / 4));
          const bodyOpacity =
            1 - Math.min(1, baseFactor / (boundingRect.height / 10));
          titleRef.current.style.transform = `translateY(${Math.max(
            transform,
            0
          )}px)`;
          titleRef.current.style.opacity = titleOpacity.toString();
          bodyRef.current.style.opacity = bodyOpacity.toString();
        }
      });
    },
    []
  );
  // useEffect(() => {
  //   const key = scrollObservable.subscribe(
  //     ({ y: scrollY, boundingRect }) => {}
  //   );
  //   return () => {
  //     scrollObservable.unsubscribe(key);
  //   };
  // }, [titleRef.current, bodyRef.current]);
  return (
    <div style={{ height: `${height}px` }}>
      <div className="sticky top-20 h-screen overflow-hidden">
        <div ref={ref} className="h-full flex justify-center items-center">
          <div className="container grid grid-cols-1 lg:grid-cols-2  gap-y-8 lg:gap-x-11">
            <div
              className={clsx(
                "col-span-2 lg:col-span-1 lg:row-start-1",
                side === "left" ? "lg:col-start-1" : "lg:col-start-2"
              )}
            >
              <div>
                <h4 ref={titleRef}>{title}</h4>
                <div ref={bodyRef}>
                  {points.map(({ title, body }) => (
                    <div className="mt-10" key={title}>
                      <h5 className="m-0">{title}</h5>
                      <p className="body1 text-functionless-medium dark:text-functionless-dark-medium mt-2">
                        {body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
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
    </div>
  );
};
