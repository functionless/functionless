import { discordUrl, twitterUrl } from "../site";

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
];
