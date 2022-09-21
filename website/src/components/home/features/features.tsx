import { title, subtitle } from "../../../content/features/features";
import { CodeFeature } from "./code/codeFeature";
import { ComposeFeature } from "./compose/composeFeature";
import { IterateFeature } from "./iterate/iterateFeature";

export const Features = () => {
  return (
    <section className="py-36 bg-functionless-bg-alternate dark:bg-functionless-dark-bg-alternate home-features snap-start">
      <div className="!max-w-screen-md container text-center">
        <span className="over">{title}</span>
      </div>
      <div className="!max-w-screen-md container flex flex-col items-center">
        <h3 className="text-center mt-2">{subtitle}</h3>
      </div>
      <CodeFeature />
      <ComposeFeature />
      <IterateFeature />
    </section>
  );
};
