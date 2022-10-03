import Link from "@docusaurus/Link";
import {
  discordButtonTitle,
  githubButtonTitle,
  title,
  twitterButtonTitle,
} from "@site/src/content/home/social";
import { discordUrl, githubUrl, twitterUrl } from "@site/src/content/site";

export const Social = () => {
  return (
    <div className="code-gradient round p-0.5 shadow-light dark:shadow-dark">
      <div className="bg-functionless-white dark:bg-functionless-code round flex flex-col space-y-6 p-8 items-stretch">
        <h5>{title}</h5>

        <Link to={githubUrl} className="flex">
          <button className="bg-functionless-github social-button">
            <img src="/img/social/github.svg" className="icon-large mr-2" />
            {githubButtonTitle}
          </button>
        </Link>

        <Link to={discordUrl} className="flex">
          <button className="bg-functionless-discord social-button">
            <img src="/img/social/discord.svg" className="icon-large mr-2" />
            {discordButtonTitle}
          </button>
        </Link>

        <Link to={twitterUrl} className="flex">
          <button className="bg-functionless-twitter social-button">
            <img src="/img/social/twitter.svg" className="icon-large mr-2" />
            {twitterButtonTitle}
          </button>
        </Link>
      </div>
    </div>
  );
};
