import Link from "@docusaurus/Link";
import type { Testimonial } from "@site/src/content/home/testimonials";

export const TestimonialBlock = ({
  avatar,
  name,
  handle,
  href,
  body,
  icon,
}: Testimonial) => {
  return (
    <Link href={href} rel="noopener noreferrer">
      <div className="w-full code-gradient p-0.5 round">
        <div className="round bg-functionless-white dark:bg-functionless-black px-6 py-8 text-functionless-black dark:text-functionless-white">
          <div className="flex space-x-4 items-center">
            <img
              className="inline-block h-10 w-10 rounded-full"
              src={avatar}
              alt={name}
            />
            <div className="flex-1 flex flex-col space-y-0.5">
              <span className="subtitle1">{name}</span>
              <span className="body2 text-functionless-medium dark:text-functionless-dark-medium">
                {handle}
              </span>
            </div>
            <img src={icon} className="w-6 text-functionless-twitter" />
          </div>
          <p className="body1 mt-6">{body}</p>
        </div>
      </div>
    </Link>
  );
};
