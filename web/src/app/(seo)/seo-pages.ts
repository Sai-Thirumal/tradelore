export type SeoPage = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  image?: {
    src: string;
    alt: string;
  };
  sections: {
    heading: string;
    body: string[];
  }[];
  faqs?: {
    question: string;
    answer: string;
  }[];
};

export const siteUrl = "https://www.tradelore.co.in";

export const seoPages = [
  {
    slug: "product",
    title: "Trading Journal Software for Indian Traders",
    description: "See how TradeLore combines broker import, journaling, trade replay, and performance analytics for active Indian traders.",
    h1: "One workflow for importing, journaling, replaying, and reviewing trades",
    intro: "TradeLore is a trading journal and analytics workspace built around the real trading day: import trades, add context, replay decisions, and review performance with costs included.",
    image: {
      src: "/tradelore-dashboard.png",
      alt: "TradeLore dashboard showing net P&L, win rate, charts, and trading calendar",
    },
    sections: [
      {
        heading: "Built around the trading day",
        body: [
          "Start with a pre-market plan, import executed trades after the session, review entries and exits, and turn repeated mistakes into playbook rules.",
          "The product connects journaling and analytics instead of leaving notes, broker reports, and chart reviews scattered across different tools.",
        ],
      },
      {
        heading: "What TradeLore tracks",
        body: [
          "TradeLore helps review net P&L, win rate, profit factor, average winner, average loser, streaks, holding duration, instruments, and journal consistency.",
          "Broker data is used for journaling and analytics. TradeLore does not place, modify, or cancel orders on your behalf.",
        ],
      },
    ],
  },
  {
    slug: "trading-journal-india",
    title: "Trading Journal for Indian F&O Traders",
    description: "Import Indian broker trades, journal decisions, replay entries and exits, and analyse net P&L, win rate, profit factor, and trading patterns.",
    h1: "A trading journal built for Indian traders",
    intro: "TradeLore helps Indian traders move beyond broker P&L reports by combining imported trades, pre-market plans, post-trade notes, chart review, and performance analytics.",
    image: {
      src: "/tradelore-journal.png",
      alt: "TradeLore journal screen with pre-market plan and post-trade review fields",
    },
    sections: [
      {
        heading: "Why broker reports are not enough",
        body: [
          "Broker statements show what happened. A journal explains why it happened, whether the trade followed a plan, and what needs to change before the next session.",
          "TradeLore keeps trade data, notes, playbooks, and reports in one place so review becomes part of the workflow instead of an afterthought.",
        ],
      },
      {
        heading: "Indian market workflows",
        body: [
          "TradeLore supports broker-led workflows for Indian traders, including equities and derivatives workflows where net performance matters more than gross P&L.",
          "You can review trades by instrument, time, weekday, holding period, playbook, and journal completion to find patterns that are easy to miss in raw tradebooks.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can TradeLore replace my broker report?",
        answer: "No. Broker reports remain the source for official statements. TradeLore helps you journal and analyse trading behavior on top of imported trade data.",
      },
      {
        question: "Does TradeLore place trades?",
        answer: "No. TradeLore imports broker data for journaling and analytics. It does not place, modify, or cancel orders.",
      },
    ],
  },
  {
    slug: "futures-options-trading-journal",
    title: "F&O Trading Journal for Indian Traders",
    description: "Journal futures and options trades with broker imports, net P&L review, post-trade notes, replay, and performance analytics.",
    h1: "Review F&O trades with context, costs, and repeatable rules",
    intro: "F&O traders need more than a daily P&L number. TradeLore helps connect each derivatives trade to the plan, execution, review notes, and performance patterns.",
    image: {
      src: "/tradelore-reports.png",
      alt: "TradeLore reports screen showing trading performance analytics",
    },
    sections: [
      {
        heading: "Designed for derivatives review",
        body: [
          "Use TradeLore to review entries, exits, position outcomes, instrument behavior, and whether the trade matched the setup you intended to take.",
          "Grouping executions into completed trades makes it easier to study a decision instead of scanning raw order rows.",
        ],
      },
      {
        heading: "Find the patterns that matter",
        body: [
          "Review F&O performance by day, time, symbol, holding duration, playbook, and journal quality.",
          "The goal is not just to record trades. It is to make repeated mistakes and repeatable strengths visible.",
        ],
      },
    ],
  },
  {
    slug: "options-trading-journal-india",
    title: "Options Trading Journal India",
    description: "Journal Indian options trades, review entries and exits, track net P&L, and analyse trading behavior with TradeLore.",
    h1: "An options trading journal for Indian market workflows",
    intro: "TradeLore gives options traders a structured place to review the plan, execution, outcome, and behavior behind each session.",
    image: {
      src: "/tradelore-trade-detail.png",
      alt: "TradeLore trade detail screen with chart, journal, and execution review",
    },
    sections: [
      {
        heading: "Capture the reason behind the trade",
        body: [
          "Options trades can move quickly, especially around index contracts and expiry sessions. TradeLore helps preserve the reason for entry, invalidation, risk, and review notes.",
          "Post-trade review turns the session into evidence instead of relying on memory.",
        ],
      },
      {
        heading: "Analyse execution quality",
        body: [
          "Use reports and trade replay to compare planned behavior against actual execution.",
          "Over time, the journal helps show whether losses came from the setup, the execution, risk control, or avoidable behavior.",
        ],
      },
    ],
  },
  {
    slug: "brokers",
    title: "Supported Broker Integrations",
    description: "TradeLore connects with Zerodha, Upstox, Dhan, Angel One, and Delta Exchange for trading journal and analytics workflows.",
    h1: "Supported brokers for TradeLore",
    intro: "Connect your broker data to TradeLore so executed trades can become structured journal entries, replays, and performance reports.",
    sections: [
      {
        heading: "Available broker workflows",
        body: [
          "TradeLore supports Zerodha, Upstox, Dhan, Angel One, and Delta Exchange workflows for importing trade data into your journal and analytics workspace.",
          "TradeLore imports broker data for journaling and analytics. It does not place, modify, or cancel orders.",
        ],
      },
      {
        heading: "Private by design",
        body: [
          "Broker settings, imported trades, dashboard reports, journal entries, and user data remain behind authentication and are marked noindex.",
          "Public broker pages explain the workflow. They do not expose account data or private app screens.",
        ],
      },
    ],
  },
  {
    slug: "brokers/zerodha",
    title: "Zerodha Trading Journal and Trade Analytics",
    description: "Connect Zerodha to TradeLore to import executed trades, journal decisions, replay trades, and review performance analytics.",
    h1: "Turn your Zerodha trades into a structured trading journal",
    intro: "TradeLore connects Zerodha trade data with journaling, trade replay, and reports so each session can be reviewed with context.",
    image: {
      src: "/brokers/kite.png",
      alt: "Zerodha Kite broker logo",
    },
    sections: [
      {
        heading: "Zerodha workflow",
        body: [
          "Connect Zerodha through the broker setup flow, import executed orders, and let TradeLore match fills into completed trades for review.",
          "Use the journal to capture pre-market intent, post-trade observations, and setup quality alongside imported trade data.",
        ],
      },
      {
        heading: "Read-only analytics",
        body: [
          "TradeLore uses broker data for journaling and analytics. It does not place, modify, or cancel orders.",
          "Review net performance, trading streaks, instruments, timing, and playbook behavior after import.",
        ],
      },
    ],
  },
  {
    slug: "brokers/upstox",
    title: "Upstox Trading Journal and Trade Analytics",
    description: "Connect Upstox to TradeLore to import historical trades, journal decisions, and review trading performance.",
    h1: "Review your Upstox trades in TradeLore",
    intro: "TradeLore helps Upstox traders turn imported trades into journal entries, chart reviews, and performance reports.",
    image: {
      src: "/brokers/upstox.png",
      alt: "Upstox broker logo",
    },
    sections: [
      {
        heading: "Upstox import workflow",
        body: [
          "Connect your Upstox account through the broker setup flow and sync historical trades into TradeLore.",
          "Imported trades can be reviewed with notes, playbooks, charts, and performance metrics.",
        ],
      },
      {
        heading: "What TradeLore does",
        body: [
          "TradeLore imports Upstox trade data for journaling and analytics. It does not place, modify, or cancel orders.",
          "Use the reports to study consistency, timing, instruments, and post-trade review quality.",
        ],
      },
    ],
  },
  {
    slug: "brokers/dhan",
    title: "Dhan Trading Journal and Trade Analytics",
    description: "Connect Dhan to TradeLore to import trade book data, journal your decisions, and review trading analytics.",
    h1: "Turn your Dhan trade book into a trading journal",
    intro: "TradeLore connects Dhan trade data with journal notes, trade replay, and analytics for structured review.",
    image: {
      src: "/brokers/dhan.png",
      alt: "Dhan broker logo",
    },
    sections: [
      {
        heading: "Dhan workflow",
        body: [
          "Use the Dhan broker setup flow to connect trade data and sync the trade book into TradeLore.",
          "TradeLore then helps organise executions into reviewable trades with notes and analytics.",
        ],
      },
      {
        heading: "Journaling and analytics only",
        body: [
          "TradeLore imports Dhan data for journaling and analytics. It does not place, modify, or cancel orders.",
          "Review behavior, trade quality, timing, and recurring mistakes with reports built for repeated review.",
        ],
      },
    ],
  },
  {
    slug: "brokers/angel-one",
    title: "Angel One Trading Journal and Trade Analytics",
    description: "Connect Angel One to TradeLore to import trade data, journal your trades, and analyse performance patterns.",
    h1: "Review Angel One trades with TradeLore",
    intro: "TradeLore helps Angel One traders bring trade data into a structured journal and analytics workflow.",
    image: {
      src: "/brokers/angel-one.png",
      alt: "Angel One broker logo",
    },
    sections: [
      {
        heading: "Angel One workflow",
        body: [
          "Use the Angel One broker setup flow to connect trade data for journaling and analytics.",
          "Once imported, trades can be reviewed with context, setup notes, replay, and performance reports.",
        ],
      },
      {
        heading: "No order placement",
        body: [
          "TradeLore imports Angel One data for journaling and analytics. It does not place, modify, or cancel orders.",
          "The focus is review: what you planned, what you executed, and what pattern repeated.",
        ],
      },
    ],
  },
  {
    slug: "brokers/delta-exchange",
    title: "Delta Exchange Trading Journal and Trade Analytics",
    description: "Connect Delta Exchange to TradeLore to import fills, funding history, product metadata, and review crypto derivatives performance.",
    h1: "Journal and review Delta Exchange trades",
    intro: "TradeLore helps Delta Exchange traders import fills and review crypto derivatives performance with journaling and analytics.",
    image: {
      src: "/brokers/delta-exchange.png",
      alt: "Delta Exchange broker logo",
    },
    sections: [
      {
        heading: "Delta Exchange workflow",
        body: [
          "Connect Delta Exchange with a read-only API workflow so TradeLore can import fills, product metadata, and funding history for review.",
          "Use trade detail screens, notes, and reports to study execution and performance over time.",
        ],
      },
      {
        heading: "Analytics, not execution",
        body: [
          "TradeLore does not place orders or withdraw funds. It uses Delta Exchange data for journaling and analytics.",
          "Reports help review net outcomes, timing, instruments, streaks, and repeated behavior.",
        ],
      },
    ],
  },
  {
    slug: "features/automated-trade-import",
    title: "Automated Trade Import",
    description: "Import broker trades into TradeLore so your trading journal and analytics stay ready for review.",
    h1: "Import trades without rebuilding your day by hand",
    intro: "TradeLore imports broker trade data and turns executions into reviewable trades for journaling, replay, and analytics.",
    image: {
      src: "/tradelore-trade-log.png",
      alt: "TradeLore trade log with imported trades",
    },
    sections: [
      {
        heading: "From executions to review",
        body: [
          "Raw broker order rows are hard to review. TradeLore turns imported data into a workflow built around completed trades and daily review.",
          "That gives your journal useful context without manual spreadsheet maintenance.",
        ],
      },
      {
        heading: "Broker data stays private",
        body: [
          "Imported trades and account-specific broker settings remain behind login and are marked noindex.",
          "Public pages explain the product; private pages hold your data.",
        ],
      },
    ],
  },
  {
    slug: "features/trading-journal",
    title: "Trading Journal for Pre-Market and Post-Trade Review",
    description: "Use TradeLore to plan before the session, journal trades after execution, and build a repeatable review habit.",
    h1: "Journal the plan, the trade, and the lesson",
    intro: "TradeLore gives traders a structured journal for pre-market planning, live notes, and post-trade review.",
    image: {
      src: "/tradelore-journal.png",
      alt: "TradeLore journal with pre-market and post-trade sections",
    },
    sections: [
      {
        heading: "Pre-market planning",
        body: [
          "Capture bias, levels, risk, and planned behavior before the session starts.",
          "Keeping plans beside imported trades makes it easier to compare intent with execution.",
        ],
      },
      {
        heading: "Post-trade review",
        body: [
          "Review what happened, what you followed, what you broke, and what belongs in your playbook.",
          "The journal is strongest when it becomes a repeatable process, not a once-a-month note dump.",
        ],
      },
    ],
  },
  {
    slug: "features/trade-replay",
    title: "Trade Replay and Chart Review",
    description: "Replay trades with chart context, executions, and journal notes so entries and exits are easier to review.",
    h1: "Replay trades with the context that mattered",
    intro: "TradeLore connects chart review, executions, and journal notes so you can study decisions instead of only outcomes.",
    image: {
      src: "/tradelore-trade-detail.png",
      alt: "TradeLore trade replay screen with chart and journal notes",
    },
    sections: [
      {
        heading: "Review entries and exits",
        body: [
          "Trade replay helps you inspect where the trade started, where it ended, and what the chart looked like around the decision.",
          "Pairing the replay with notes makes it easier to separate a good process from a lucky or unlucky result.",
        ],
      },
      {
        heading: "Use replay for playbook improvement",
        body: [
          "Study repeated setups, missed exits, late entries, and avoidable trades with the context preserved.",
          "The best use of replay is simple: find one behavior to repeat and one behavior to stop.",
        ],
      },
    ],
  },
  {
    slug: "features/trading-analytics",
    title: "Trading Performance Analytics",
    description: "Analyse net P&L, win rate, profit factor, streaks, timing, instruments, and playbooks with TradeLore.",
    h1: "Trading analytics that explain more than P&L",
    intro: "TradeLore reports help traders understand performance by behavior, timing, instruments, playbooks, and journal consistency.",
    image: {
      src: "/tradelore-reports.png",
      alt: "TradeLore analytics reports showing performance breakdowns",
    },
    sections: [
      {
        heading: "Metrics that support decisions",
        body: [
          "Review net P&L, win rate, profit factor, average winner, average loser, cumulative performance, and trading streaks.",
          "Then break performance down by weekday, time, instrument, holding duration, and playbook.",
        ],
      },
      {
        heading: "Find what to change",
        body: [
          "Good analytics should lead to action. TradeLore helps surface patterns that can become rules, watchlists, or risk limits.",
          "The point is not more charts. It is clearer review.",
        ],
      },
    ],
  },
  {
    slug: "pricing",
    title: "TradeLore Pricing",
    description: "TradeLore Pro starts with a one-month free demo, followed by the ₹199/month launch price (normally ₹299/month).",
    h1: "One month free, then ₹199/month",
    intro: "TradeLore Pro is currently ₹199/month as a launch offer, reduced from the normal ₹299/month price. Keep the launch price while your subscription stays active.",
    sections: [
      {
        heading: "Launch offer",
        body: [
          "Your first month is free. After the demo, TradeLore Pro is ₹199 per month during the launch offer, instead of the normal ₹299 per month.",
          "Subscriptions are monthly. You can manage your subscription from Billing in the app.",
        ],
      },
      {
        heading: "What is included",
        body: [
          "TradeLore includes broker import workflows, journaling, trade replay, reports, and broker settings inside the authenticated app.",
          "Pricing and checkout are shown inside the product so plan status and eligibility stay tied to your account.",
        ],
      },
      {
        heading: "Who it is for",
        body: [
          "TradeLore is for active traders who want a review process beyond broker statements or manual spreadsheets.",
          "The product is a journal and analytics companion. It is not investment advice and it does not execute trades.",
        ],
      },
    ],
  },
  {
    slug: "security",
    title: "TradeLore Security and Broker Data Privacy",
    description: "Learn how TradeLore handles broker data, private journal pages, authentication, and read-only analytics workflows.",
    h1: "Security and privacy for your trading journal",
    intro: "TradeLore keeps account-specific broker settings, imported trades, journal entries, and reports behind authentication and out of search indexes.",
    sections: [
      {
        heading: "Private app pages stay private",
        body: [
          "Dashboard, trade detail, journal, reports, settings, auth callback, and API routes are not SEO pages.",
          "Those routes remain authenticated or noindex so search engines index public product information, not private trading data.",
        ],
      },
      {
        heading: "Broker data is for review",
        body: [
          "TradeLore uses broker data for journaling and analytics workflows.",
          "TradeLore does not place, modify, or cancel orders on your behalf, and Delta Exchange workflows do not withdraw funds.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can search engines see my dashboard?",
        answer: "No. Dashboard, trade, journal, reports, and settings routes are private app surfaces and are marked noindex.",
      },
      {
        question: "Does TradeLore place trades?",
        answer: "No. TradeLore is for journaling and analytics. It does not place, modify, or cancel orders.",
      },
    ],
  },
  {
    slug: "about",
    title: "About TradeLore",
    description: "TradeLore is a trading journal and analytics product for Indian traders who want a better review process.",
    h1: "TradeLore helps traders build a better review habit",
    intro: "TradeLore exists to make trading review easier, more structured, and more honest than scattered notes and broker statements.",
    sections: [
      {
        heading: "What TradeLore believes",
        body: [
          "A useful journal should connect the plan, the execution, the result, and the lesson.",
          "TradeLore is built around that loop: import, journal, replay, review, improve.",
        ],
      },
      {
        heading: "What TradeLore is not",
        body: [
          "TradeLore is not investment advice, a signal service, or an order execution tool.",
          "It is a trading journal and analytics companion for traders who want to study their own behavior and performance.",
        ],
      },
    ],
  },
] as const satisfies readonly SeoPage[];

export function getSeoPage(slug: string): SeoPage | undefined {
  return seoPages.find((page) => page.slug === slug);
}
