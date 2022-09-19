import Events from "@site/src/content/features/compose/events.mdx";
import Orders from "@site/src/content/features/compose/orders.mdx";
import { useTimeline } from "@site/src/lib/useTimeline";
import { ReactElement } from "react";
import { Code } from "../code";

const composeTimeline = {
  events: 250,
  orders: 2000,
} as const;

const CodeStage = ({
  timeline,
}: {
  timeline: Array<keyof typeof composeTimeline>;
}): ReactElement => {
  switch (timeline.at(-1)) {
    case "events":
      return <Events />;
    case "orders":
      return <Orders />;
    default:
      return <></>;
  }
};

export const ComposeFeature = () => {
  const timeline = useTimeline(composeTimeline);
  console.log(timeline);

  return (
    <Code
      fileName="functionless.ts"
      language="typescript"
      introDelayMs={250}
      triggerVisibility={0.5}
    >
      <CodeStage timeline={timeline} />
    </Code>
  );
};
