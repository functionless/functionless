export const title = "TWEETS";

export interface Testimonial {
  avatar: string;
  name: string;
  handle: string;
  href: string;
  body: string;
  icon: string;
}

export const testimonials: Testimonial[] = [
  {
    avatar: "/img/tweets/petehanssens.jpg",
    name: "Peter Hanssens",
    handle: "@petehanssens",
    href: "https://twitter.com",
    body: "I gotta say, this blows me away… the #cdk has been impressing me for a while now but this hands down just saves so much time and effort… so clean… just so awesome… how can we get started with this?",
    icon: "/img/social/twitter.svg",
  },
  {
    avatar: "/img/tweets/loujaybee.jpg",
    name: "Lou",
    handle: "@loujaybee",
    href: "https://twitter.com",
    body: "I gotta say, this blows me away… the #cdk has been impressing me for a while now but this hands down just saves so much time and effort… so clean… just so awesome… how can we get started with this?",
    icon: "/img/social/twitter.svg",
  },
  {
    avatar: "/img/tweets/s0enke.jpg",
    name: "Sönke Ruempler",
    handle: "@s0enke",
    href: "https://twitter.com",
    body: "WOW, no more fiddling around with Choice, Map, etcpp: With @_functionless, you can write AWS Step Functions in pure TypeScript. Also integrates with CDK. functionless.org",
    icon: "/img/social/twitter.svg",
  },
];
