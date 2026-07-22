import { siteUrl } from "../(seo)/seo-pages";

export type BlogContentBlock =
  | { type: "paragraphs"; paragraphs: readonly string[] }
  | { type: "list"; items: readonly string[] }
  | { type: "table"; headers: readonly string[]; rows: readonly (readonly string[])[] };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category: string;
  author: string;
  published: boolean;
  publishedAt: string;
  modifiedAt: string;
  readingTime: string;
  intro: string;
  sections: readonly {
    id: string;
    heading: string;
    content: readonly BlogContentBlock[];
  }[];
  relatedSlugs: readonly string[];
  internalLinks: readonly { label: string; href: string }[];
};

export const blogPosts = [
  {
    slug: "a-simple-trading-review-loop",
    title: "A Simple Trading Review Loop: Plan, Journal, Replay, Improve",
    description: "A practical framework for connecting your trading plan, imported trades, journal notes, replay, and performance review.",
    category: "Trading journal",
    author: "TradeLore",
    published: false,
    publishedAt: "2026-07-22",
    modifiedAt: "2026-07-22",
    readingTime: "5 min read",
    intro: "A useful trading review does not need more scattered notes. It needs a repeatable loop that connects what you planned, what you executed, and what you learned.",
    sections: [
      {
        id: "start-with-the-plan",
        heading: "Start with the plan",
        content: [
          {
            type: "paragraphs",
            paragraphs: [
              "Before a session, write down the setup you are willing to take, the condition that would invalidate it, and the behavior you want to avoid. This gives the later review something concrete to compare against.",
              "The plan does not need to predict the market. It needs to make your intended decision visible before the outcome is known.",
            ],
          },
          {
            type: "list",
            items: ["What setup is valid today?", "What would make the trade invalid?", "What behavior would make the session worse?"] ,
          },
        ],
      },
      {
        id: "review-the-execution",
        heading: "Review the execution",
        content: [
          {
            type: "paragraphs",
            paragraphs: [
              "After the session, bring the executed trades together with the plan. TradeLore supports broker imports and CSV workflows, then gives you a place to add journal context around the trade.",
              "Look at the decision, not just the result. A winning trade can still break the plan, and a losing trade can still follow it cleanly.",
            ],
          },
          {
            type: "table",
            headers: ["Review question", "What to record"],
            rows: [
              ["Did the setup match the plan?", "The condition that justified entry"],
              ["Was execution controlled?", "Entry, exit, sizing, and avoidable deviations"],
              ["What repeats?", "A behavior to continue or change"],
            ],
          },
        ],
      },
      {
        id: "turn-observations-into-rules",
        heading: "Turn observations into rules",
        content: [
          {
            type: "paragraphs",
            paragraphs: [
              "Replay and reports are most useful when they lead to one small change. Review timing, instruments, holding duration, playbooks, and journal consistency to find a pattern worth testing.",
              "Keep the next rule specific enough to check in the next session. The goal is a tighter feedback loop, not a longer list of vague reminders.",
            ],
          },
        ],
      },
    ],
    relatedSlugs: [],
    internalLinks: [
      { label: "See the TradeLore product workflow", href: "/product" },
      { label: "Explore trading performance analytics", href: "/features/trading-analytics" },
    ],
  },
] as const satisfies readonly BlogPost[];

export const publishedBlogPosts = blogPosts.filter((post) => post.published);

export function getPublishedBlogPost(slug: string) {
  return publishedBlogPosts.find((post) => post.slug === slug);
}

export function blogUrl(slug?: string) {
  return `${siteUrl}/blog${slug ? `/${slug}` : ""}`;
}
