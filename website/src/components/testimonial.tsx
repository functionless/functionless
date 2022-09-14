type Props = {
  avatar?: string;
  name?: string;
  handle?: string;
  href?: string;
  body?: string;
  icon?: string;
};

export const Testimonial = ({
  avatar = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
  name = "Jani M",
  handle = "@jani.m",
  href = "https://twitter.com/jani.m/123",
  body = "Nullam risus blandit ac aliquam justo ipsum. Quam mauris volutpat massa dictumst amet. Sapien tortor lacus arcu.",
  icon = "/img/social/twitter.svg",
}: Props) => {
  return (
    <a
      href={href}
      rel="noopener noreferrer"
      className="no-underline hover:no-underline"
    >
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
    </a>
  );
};
