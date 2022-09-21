import {
  button,
  description,
  emailPlaceholder,
  title,
} from "@site/src/content/home/subscribe";

export const Subscribe = () => {
  return (
    <section className="snap-start container code-gradient p-0.5 round shadow-light dark:shadow-dark my-36">
      <div className="round bg-functionless-white dark:bg-functionless-code">
        <div className="grid grid-cols-1 md:grid-cols-2  gap-12 md:gap-28 items-center p-10">
          <div>
            <h4 className="mb-4">{title}</h4>
            <p className="body1 text-functionless-medium dark:text-functionless-dark-medium">
              {description}
            </p>
          </div>
          <div>
            <div className="relative">
              <input
                type="text"
                placeholder={emailPlaceholder}
                className="px-6 py-18 h-14 rounded-full"
              />
              <div className="absolute inset-y-1 right-1">
                <button className="solid-button-small">{button}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
