type Props = {
  avatar?: string;
  name?: string;
  role?: string;
  twitter?: string;
  linkedin?: string;
};

export const Team = ({
  avatar = "/img/headshot.png",
  name = "Sam Sussman",
  role = "Engineer",
  twitter = "https://twitter.com/abc",
  linkedin = "https://linkedin.com/abc",
}: Props) => {
  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative overflow-hidden flex justify-center">
        <div className="absolute -z-0 h-full  w-full">
          <img
            src="/img/shapes/bg.png"
            className="w-full aspect-1 object-fit f-full p-8"
          />
        </div>
        <img src={avatar} className="w-full object-cover z-10" />
      </div>
      <div className="flex flex-col items-center space-y-1 mt-8">
        <h5 className="m-0">{name}</h5>
        <span className="body1 text-functionless-medium dark:text-functionless-dark-medium">
          {role}
        </span>
      </div>
      <div className="space-x-4 flex items-center mt-6">
        {twitter ? (
          <a href={twitter} rel="noopener noreferrer">
            <img src="/img/social/twitter.svg" className="icon" />
          </a>
        ) : (
          <></>
        )}
        {linkedin ? (
          <a href={linkedin} rel="noopener noreferrer">
            <img src="/img/social/linkedin.svg" className="icon" />
          </a>
        ) : (
          <></>
        )}
      </div>
    </div>
  );
};
