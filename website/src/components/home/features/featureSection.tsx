import { clamp } from "@site/src/lib/clamp";
import { Feature } from "@site/src/lib/feature";
import { useVisibleScroll } from "@site/src/lib/useVisibility";
import clsx from "clsx";

export const FeatureSection = ({
  side,
  title,
  points,
  aside,
  footer,
  height,
}: Feature & {
  height: number;
}) => {
  const { ref, boundingRect } = useVisibleScroll<HTMLDivElement>(0);
  console.log(boundingRect.top);
  const _scrollFactor = boundingRect.top / boundingRect.height;
  const scrollFactor = Math.abs(
    isNaN(_scrollFactor) ? 0 : 1 - Math.abs(_scrollFactor)
  );
  const transform = (1 - clamp(scrollFactor, 0.25)) * 50;
  const titleOpacity = clamp(scrollFactor, 0.25);
  const bodyOpacity = clamp(scrollFactor, 0.125);
  return (
    <div style={{ height: `${height}px` }}>
      <div ref={ref} className="sticky top-0 h-screen overflow-hidden">
        <div className="h-full mt-6 lg:mt-20 flex justify-center items-center">
          <div className="container grid grid-cols-1 lg:grid-cols-2  gap-y-8 lg:gap-x-11">
            <div
              className={clsx(
                "col-span-2 lg:col-span-1 lg:row-start-1",
                side === "left" ? "lg:col-start-1" : "lg:col-start-2"
              )}
            >
              <div>
                <h4
                  style={{
                    transform: `translateY(${Math.max(transform, 0)}px)`,
                    opacity: titleOpacity,
                  }}
                >
                  {title}
                </h4>
                <div
                  style={{
                    opacity: bodyOpacity,
                  }}
                >
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
              {aside({ scrollFactor })}
            </div>
            <div className="col-span-2">{footer?.()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
