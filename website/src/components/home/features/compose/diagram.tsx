import Events from "@site/static/img/compose/events.svg";
import Orders from "@site/static/img/compose/orders.svg";
import Process from "@site/static/img/compose/process.svg";
import clsx from "clsx";
import { Window } from "../../window";
import { composeTimeline } from "./timeline";

export const Diagram = ({ visible }: { visible: boolean }) => (
  <div
    className={clsx(
      "flex justify-center transition duration-300 scale-[0.4] sm:scale-50 md:scale-[0.65] lg:scale-75 xl:scale-100",
      visible
        ? "opacity-100 translate-x-0 scale-100"
        : "opacity-0 translate-y-10 scale-75"
    )}
  >
    <Window>
      <div className="flex justify-center items-end py-4 px-8">
        <TimelineImage visible={visible} introMs={composeTimeline.events}>
          <Events />
        </TimelineImage>
        <TimelineImage visible={visible} introMs={composeTimeline.orders}>
          <Orders />
        </TimelineImage>
        <TimelineImage visible={visible} introMs={composeTimeline.processOrder}>
          <Process />
        </TimelineImage>
      </div>
    </Window>
  </div>
);

const TimelineImage = ({
  visible,
  introMs,
  children,
}: React.PropsWithChildren<{ visible: boolean; introMs: number }>) => (
  <div
    className={clsx("opacity-0", visible && "animate-fade-in")}
    style={{
      animationDelay: `${introMs + 1000}ms`,
      animationDuration: "200ms",
    }}
  >
    {children}
  </div>
);
