import { discordUrl, githubUrl, twitterUrl } from "../site";

export interface MainItem {
  to: string;
  title: string;
}

export interface SocialItem {
  href: string;
  icon: string;
  title: string;
}

export const main = [
  {
    to: "/docs/what-is-functionless",
    title: "Docs",
  },
  { to: "/blog", title: "Blog" },
  {
    to: "/team",
    title: "Team",
  },
];

export const social = [
  {
    title: "Discord",
    href: discordUrl,
    icon: "/img/social/discord.svg",
  },
  {
    title: "Twitter",
    href: twitterUrl,
    icon: "/img/social/twitter.svg",
  },
  {
    title: "Github",
    href: githubUrl,
    icon: "/img/social/github.svg",
  },
];
