import Compose from "@site/src/content/features/compose/compose.mdx";
import { useTimeline } from "@site/src/lib/useTimeline";
import { useMemo } from "react";
import { TimelineCode, VisibilityWindow } from "../code";

const composeTimeline = {
  events: 500,
  orders: 2000,
  processOrder: 5000,
} as const;

const ComposeCode = () => (
  <VisibilityWindow delayMs={0} visibiltyThreshold={0.5}>
    <TimelineCode
      fileName="functionless.ts"
      language="typescript"
      timeline={composeTimeline}
    >
      <Compose />
    </TimelineCode>
  </VisibilityWindow>
);

export const ComposeFeature = () => {
  const elapsedTimeline = useTimeline(composeTimeline);
  //We memo compose to stop it re-rendering every time the timeline updates
  const memodCompose = useMemo(ComposeCode, []);

  return <div>{memodCompose}</div>;
};
