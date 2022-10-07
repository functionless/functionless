import Compose from "@site/src/content/home/features/compose/compose.mdx";
import { TimelineCode } from "../../code";
import { VisibilityWindow } from "../../visibilityWindow";
import { composeTimeline } from "./timeline";

export const ComposeCode = ({
  onVisibilityChanged,
}: {
  onVisibilityChanged: (visible: boolean) => void;
}) => (
  <VisibilityWindow
    delayMs={0}
    visibiltyThreshold={0.5}
    onVisibilityChanged={onVisibilityChanged}
  >
    {(visible) => (
      <TimelineCode
        animate={visible}
        fileName="functionless.ts"
        language="typescript"
        timeline={composeTimeline}
        showLineNumbers={false}
      >
        <Compose />
      </TimelineCode>
    )}
  </VisibilityWindow>
);
