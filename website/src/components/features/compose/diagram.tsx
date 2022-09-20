import Events from "@site/static/img/compose/events.svg";
import Orders from "@site/static/img/compose/orders.svg";
import Process from "@site/static/img/compose/process.svg";
import clsx from "clsx";
import { Window } from "../../window";
import { composeTimeline } from "./timeline";

export const Diagram = ({ showContents }: { showContents: boolean }) => (
  <div className="flex justify-center">
    <Window>
      <div className="flex justify-center items-end py-4 px-8">
        <TimelineImage visible={showContents} introMs={composeTimeline.events}>
          <Events />
        </TimelineImage>
        <TimelineImage visible={showContents} introMs={composeTimeline.orders}>
          <Orders />
        </TimelineImage>
        <TimelineImage
          visible={showContents}
          introMs={composeTimeline.processOrder}
        >
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
