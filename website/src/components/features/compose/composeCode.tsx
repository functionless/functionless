import Compose from "@site/src/content/features/compose/compose.mdx";
import { useTimeline } from "@site/src/lib/useTimeline";
import { TimelineCode, VisibilityWindow } from "../../code";
import { composeTimeline } from "./timeline";

export const ComposeCode = () => (
  <VisibilityWindow delayMs={0} visibiltyThreshold={0.5}>
    {(visible) => (
      <TimelineCode
        animate={visible}
        fileName="functionless.ts"
        language="typescript"
        timeline={composeTimeline}
      >
        <Compose />
      </TimelineCode>
    )}
  </VisibilityWindow>
);
