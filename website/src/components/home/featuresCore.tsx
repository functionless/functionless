import { features, subtitle, title } from "@site/src/content/home/featuresCore";
import { VisibilityWindow } from "./visibilityWindow";

export const FeaturesCore = () => {
  return (
    <section className="py-36 bg-functionless-bg dark:bg-functionless-dark-bg">
      <div className="max-w-screen-md px-4 mx-auto flex flex-col items-center">
        <span className="over">{title}</span>
        <h3 className="text-center mt-2">{subtitle}</h3>
      </div>
      <div className="tw-container grid grid-cols-1 md:grid-cols-3 gap-11 mt-16 mb-6 md:mt-40 md:mb-12">
        {features.map(({ icon, title, body }, i) => (
          <VisibilityWindow
            key={title}
            delayMs={i * 250}
            visibiltyThreshold={0.2}
          >
            {() => (
              <div className="flex flex-col items-center col-span-1 my-6">
                <img src={icon} className="w-16" />
                <h6 className="mt-6 mb-4 text-center">{title}</h6>
                <p className="text-center">{body}</p>
              </div>
            )}
          </VisibilityWindow>
        ))}
      </div>
    </section>
  );
};
