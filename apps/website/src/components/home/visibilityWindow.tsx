import clsx from "clsx";
import { ReactElement, useEffect } from "react";
import { useVisibility } from "../../lib/useVisibility";

export const VisibilityWindow = ({
  children,
  visibiltyThreshold,
  delayMs,
  onVisibilityChanged,
  singleShot = true,
}: {
  visibiltyThreshold: number;
  delayMs: number;
  onVisibilityChanged?: (visible: boolean) => void;
  children: (visible: boolean) => ReactElement;
  singleShot?: boolean;
}) => {
  const { ref, visible } = useVisibility<HTMLDivElement>(visibiltyThreshold, { singleShot });

  useEffect(() => {
    onVisibilityChanged?.(visible);
  }, [visible]);

  return (
    <div ref={ref}>
      <div
        className={clsx(
          "transition duration-300",
          visible
            ? "opacity-100 translate-x-0 scale-100"
            : "opacity-0 translate-y-10 scale-75"
        )}
        style={{
          transitionDelay: `${visible ? delayMs : 0}ms`,
        }}
      >
        {children(visible)}
      </div>
    </div>
  );
};
