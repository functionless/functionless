import Shape1 from "@site/static/img/shapes/1.svg";
import Shape2 from "@site/static/img/shapes/2.svg";
import Shape3 from "@site/static/img/shapes/3.svg";
import { Window } from "../../window";
import { composeTimeline } from "./timeline";

export const Diagram = () => (
  <div className="flex justify-center">
    <Window>
      <TimelineImage introMs={composeTimeline.events}>
        <Shape1 />
      </TimelineImage>
      <TimelineImage introMs={composeTimeline.orders}>
        <Shape2 />
      </TimelineImage>
      <TimelineImage introMs={composeTimeline.processOrder}>
        <Shape3 />
      </TimelineImage>
    </Window>
  </div>
);

const TimelineImage = ({
  introMs,
  children,
}: React.PropsWithChildren<{ introMs: number }>) => (
  <div
    className="animate-fade-in opacity-0"
    style={{
      animationDelay: `${introMs + 1000}ms`,
      animationDuration: "200ms",
    }}
  >
    {children}
  </div>
);
