export const Social = () => {
  return (
    <div className="code-gradient round p-0.5 shadow-light dark:shadow-dark">
      <div className="bg-functionless-white dark:bg-functionless-code round flex flex-col items-center space-y-6 p-8">
        <h5>Connect with us</h5>
        <button className="bg-functionless-github social-button">
          <img src="/img/social/github.svg" className="icon-large mr-2" />
          Star us on Github
        </button>

        <button className="bg-functionless-discord social-button">
          <img src="/img/social/discord.svg" className="icon-large mr-2" />
          Join our Discord
        </button>

        <button className="bg-functionless-twitter social-button">
          <img src="/img/social/twitter.svg" className="icon-large mr-2" />
          Follow us on Twitter
        </button>
      </div>
    </div>
  );
};
